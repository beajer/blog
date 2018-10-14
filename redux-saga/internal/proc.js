import deferred from '../dependencies/deferred'
import * as is from '../dependencies/is'
import { CANCEL, IO, TERMINATE, TASK, TASK_CANCEL, SELF_CANCELLATION } from '../dependencies/symbols'
import * as effectTypes from './effectTypes'
import {
  noop,
  check,
  uid as nextEffectId,
  array,
  remove,
  assignWithSymbols,
  makeIterator,
  createSetContextWarning,
  shouldCancel,
  shouldTerminate,
  createAllStyleChildCallbacks,
  shouldComplete,
  asyncIteratorSymbol,
} from './utils'

import { getLocation, addSagaStack, sagaStackToString } from './error-utils'

import { asap, suspend, flush } from './scheduler'
import { channel, isEnd } from './channel'
import matcher from './matcher'

export function getMetaInfo(fn) {
  return {
    name: fn.name || 'anonymous',
    location: getLocation(fn),
  }
}

function getIteratorMetaInfo(iterator, fn) {
  if (iterator.isSagaIterator) {
    return { name: iterator.meta.name }
  }
  return getMetaInfo(fn)
}

/**
  Used to track a parent task and its forks
  In the new fork model, forked tasks are attached by default to their parent
  We model this using the concept of Parent task && main Task
  main task is the main flow of the current Generator, the parent tasks is the
  aggregation of the main tasks + all its forked tasks.
  Thus the whole model represents an execution tree with multiple branches (vs the
  linear execution tree in sequential (non parallel) programming)

  A parent tasks has the following semantics
  - It completes if all its forks either complete or all cancelled
  - If it's cancelled, all forks are cancelled as well
  - It aborts if any uncaught error bubbles up from forks
  - If it completes, the return value is the one returned by the main task
**/

/**
 * demo: 
 * function* Parent() { // mainTask
 *   const Child1 = yield fork(api.xxxx) // 100ms childTask1
 *   const Child2 = yield fork(api.yyyy) // 300ms childTask2
 *   yield delay(200) // 200ms 
 *   // mainTask.cont()
 * }
 * // 等待childTask均完成，调用cb，即end()
 */
function forkQueue(mainTask, onAbort, cb) {
  let tasks = [],
    result,
    completed = false
  addTask(mainTask)
  const getTasks = () => tasks
  const getTaskNames = () => tasks.map(t => t.meta.name)

  function abort(err) {
    onAbort()
    cancelAll()
    cb(err, true)
  }

  function addTask(task) {
    tasks.push(task)
    task.cont = (res, isErr) => {
      if (completed) {
        return
      }

      remove(tasks, task)
      task.cont = noop
      if (isErr) {
        abort(res)
      } else {
        if (task === mainTask) {
          result = res
        }
        if (!tasks.length) {
          completed = true
          cb(result)
        }
      }
    }
    // task.cont.cancel = task.cancel
  }

  function cancelAll() {
    if (completed) {
      return
    }
    completed = true
    tasks.forEach(t => {
      t.cont = noop
      t.cancel()
    })
    tasks = []
  }

  return {
    addTask,
    cancelAll,
    abort,
    getTasks,
    getTaskNames,
  }
}

/**
 * runForkEffect
 */
function createTaskIterator({ context, fn, args }) {
  // catch synchronous failures; see #152 and #441
  try {
    const result = fn.apply(context, args)

    // i.e. a generator function returns an iterator
    if (is.iterator(result)) {
      return result
    }

    const next = (value = result) => ({
      value,
      done: !is.promise(value),
    })

    return makeIterator(next)
  } catch (err) {
    // do not bubble up synchronous failures for detached forks
    // instead create a failed task. See #152 and #441
    return makeIterator(() => {
      throw err
    })
  }
}

export default function proc(env, iterator, parentContext, parentEffectId, meta, cont) {
  if (process.env.NODE_ENV !== 'production' && iterator[asyncIteratorSymbol]) {
    throw new Error("redux-saga doesn't support async generators, please use only regular ones")
  }
  const taskContext = Object.create(parentContext)
  const finalRunEffect = env.finalizeRunEffect(runEffect)

  let crashedEffect = null
  const cancelledDueToErrorTasks = []
  /**
    Tracks the current effect cancellation
    Each time the generator progresses. calling runEffect will set a new value
    on it. It allows propagating cancellation to child effects
  **/
  next.cancel = noop

  /**
    Creates a new task descriptor for this generator, We'll also create a main task
    to track the main flow (besides other forked tasks)
  **/
  const task = newTask(parentEffectId, meta, cont)
  const mainTask = { meta, cancel: cancelMain, _isRunning: true, _isCancelled: false }

  const taskQueue = forkQueue(
    mainTask,
    function onAbort() {
      cancelledDueToErrorTasks.push(...taskQueue.getTaskNames())
    },
    end,
  )

  /**
    cancellation of the main task. We'll simply resume the Generator with a Cancel
  **/
  function cancelMain() {
    if (mainTask._isRunning && !mainTask._isCancelled) {
      mainTask._isCancelled = true
      next(TASK_CANCEL)
    }
  }

  /**
    This may be called by a parent generator to trigger/propagate cancellation
    cancel all pending tasks (including the main task), then end the current task.

    Cancellation propagates down to the whole execution tree holded by this Parent task
    It's also propagated to all joiners of this task and their execution tree/joiners

    Cancellation is noop for terminated/Cancelled tasks tasks
  **/
  function cancel() {
    /**
      We need to check both Running and Cancelled status
      Tasks can be Cancelled but still Running
    **/
    if (task._isRunning && !task._isCancelled) {
      task._isCancelled = true
      taskQueue.cancelAll()
      /**
        Ending with a Never result will propagate the Cancellation to all joiners
      **/
      end(TASK_CANCEL)
    }
  }
  /**
    attaches cancellation logic to this task's continuation
    this will permit cancellation to propagate down the call chain
  **/
  cont && (cont.cancel = cancel)

  // kicks up the generator
  next()

  // then return the task descriptor to the caller
  return task

  /**
    This is the generator driver
    It's a recursive async/continuation function which calls itself
    until the generator terminates or throws
  **/
  function next(arg, isErr) {
    // Preventive measure. If we end up here, then there is really something wrong
    if (!mainTask._isRunning) {
      throw new Error('Trying to resume an already finished generator')
    }

    try {
      let result
      if (isErr) {
        result = iterator.throw(arg)
      } else if (shouldCancel(arg)) {
        /**
          getting TASK_CANCEL automatically cancels the main task
          We can get this value here

          - By cancelling the parent task manually
          - By joining a Cancelled task
        **/
        mainTask._isCancelled = true
        /**
          Cancels the current effect; this will propagate the cancellation down to any called tasks
        **/
        next.cancel()
        /**
          If this Generator has a `return` method then invokes it
          This will jump to the finally block
        **/
        result = is.func(iterator.return) ? iterator.return(TASK_CANCEL) : { done: true, value: TASK_CANCEL }
      } else if (shouldTerminate(arg)) {
        // We get TERMINATE flag, i.e. by taking from a channel that ended using `take` (and not `takem` used to trap End of channels)
        result = is.func(iterator.return) ? iterator.return() : { done: true }
      } else {
        result = iterator.next(arg)
      }

      if (!result.done) {
        digestEffect(result.value, parentEffectId, '', next)
      } else {
        /**
          This Generator has ended, terminate the main task and notify the fork queue
        **/
        mainTask._isRunning = false
        mainTask.cont(result.value)
      }
    } catch (error) {
      if (mainTask._isCancelled) {
        env.logError(error)
      }
      mainTask._isRunning = false
      mainTask.cont(error, true)
    }
  }

  /**
   * 将task标记为完成时的状态，并调用task._deferredEnd, task.cont, task.joiners
   * @param {*} result 
   * @param {Boolean} isErr 
   */
  function end(result, isErr) {
    task._isRunning = false

    if (!isErr) {
      task._result = result
      task._deferredEnd && task._deferredEnd.resolve(result)
    } else {
      addSagaStack(result, {
        meta,
        effect: crashedEffect,
        cancelledTasks: cancelledDueToErrorTasks,
      })

      if (!task.cont) {
        if (result && result.sagaStack) {
          result.sagaStack = sagaStackToString(result.sagaStack)
        }

        if (env.onError) {
          env.onError(result)
        } else {
          // TODO: could we skip this when _deferredEnd is attached?
          env.logError(result)
        }
      }
      task._error = result
      task._isAborted = true
      task._deferredEnd && task._deferredEnd.reject(result)
    }
    task.cont && task.cont(result, isErr)
    task.joiners.forEach(j => j.cb(result, isErr))
    task.joiners = null
  }

  /**
   * 
   * @param {Object} effect 
   * @param {Number} effectId 
   * @param {Function} currCb 经过next.cancel处理后的next
   */
  function runEffect(effect, effectId, currCb) {
    /**
      each effect runner must attach its own logic of cancellation to the provided callback
      it allows this generator to propagate cancellation downward.
      每个effect运行时必须附加它自己的取消逻辑到被提供的回调函数(currCb)上,即设置currCb.cancel
      这允许这个迭代器向下传播取消逻辑

      ATTENTION! effect runners must setup the cancel logic by setting cb.cancel = [cancelMethod]
      And the setup must occur before calling the callback
      注意！effect运行时必须通过设置cb.cancel = fn来设置取消逻辑，并且这个设置必须发生在运行cb前

      This is a sort of inversion of control: called async functions are responsible
      of completing the flow by calling the provided continuation; while caller functions
      are responsible for aborting the current flow by calling the attached cancel function

      Library users can attach their own cancellation logic to promises by defining a
      promise[CANCEL] method in their returned promises
      ATTENTION! calling cancel must have no effect on an already completed or cancelled effect
    **/
    if (is.promise(effect)) {
      resolvePromise(effect, currCb)
    } else if (is.iterator(effect)) {
      resolveIterator(effect, effectId, meta, currCb)
    } else if (effect && effect[IO]) {
      const { type, payload } = effect
      if (type === effectTypes.TAKE) runTakeEffect(payload, currCb)
      else if (type === effectTypes.PUT) runPutEffect(payload, currCb)
      else if (type === effectTypes.ALL) runAllEffect(payload, effectId, currCb)
      else if (type === effectTypes.RACE) runRaceEffect(payload, effectId, currCb)
      else if (type === effectTypes.CALL) runCallEffect(payload, effectId, currCb)
      else if (type === effectTypes.CPS) runCPSEffect(payload, currCb)
      else if (type === effectTypes.FORK) runForkEffect(payload, effectId, currCb)
      else if (type === effectTypes.JOIN) runJoinEffect(payload, currCb)
      else if (type === effectTypes.CANCEL) runCancelEffect(payload, currCb)
      else if (type === effectTypes.SELECT) runSelectEffect(payload, currCb)
      else if (type === effectTypes.ACTION_CHANNEL) runChannelEffect(payload, currCb)
      else if (type === effectTypes.FLUSH) runFlushEffect(payload, currCb)
      else if (type === effectTypes.CANCELLED) runCancelledEffect(payload, currCb)
      else if (type === effectTypes.GET_CONTEXT) runGetContextEffect(payload, currCb)
      else if (type === effectTypes.SET_CONTEXT) runSetContextEffect(payload, currCb)
      else currCb(effect)
    } else {
      // anything else returned as is
      currCb(effect)
    }
  }

  /**
   * 为cb,即next绑定cancel逻辑，cancel逻辑向下传播 
   */
  function digestEffect(effect, parentEffectId, label = '', cb) {
    const effectId = nextEffectId()
    env.sagaMonitor && env.sagaMonitor.effectTriggered({ effectId, parentEffectId, label, effect })

    /**
      completion callback and cancel callback are mutually exclusive
      We can't cancel an already completed effect
      And We can't complete an already cancelled effectId
    **/
    let effectSettled

    // Completion callback passed to the appropriate effect runner
    function currCb(res, isErr) {
      if (effectSettled) {
        return
      }

      effectSettled = true
      cb.cancel = noop // defensive measure
      if (env.sagaMonitor) {
        if (isErr) {
          env.sagaMonitor.effectRejected(effectId, res)
        } else {
          env.sagaMonitor.effectResolved(effectId, res)
        }
      }
      if (isErr) {
        crashedEffect = effect
      }
      cb(res, isErr)
    }
    // tracks down the current cancel
    currCb.cancel = noop

    // setup cancellation logic on the parent cb
    cb.cancel = () => {
      // prevents cancelling an already completed effect
      if (effectSettled) {
        return
      }

      effectSettled = true
      /**
        propagates cancel downward
        catch uncaught cancellations errors; since we can no longer call the completion
        callback, log errors raised during cancellations into the console
      **/
      try {
        currCb.cancel()
      } catch (err) {
        env.logError(err)
      }
      currCb.cancel = noop // defensive measure

      env.sagaMonitor && env.sagaMonitor.effectCancelled(effectId)
    }

    finalRunEffect(effect, effectId, currCb)
  }

  /**
   * function *(){
   *  yield delay(1000)
   * },
   * 类似co, await
   */
  function resolvePromise(promise, cb) {
    const cancelPromise = promise[CANCEL]
    if (is.func(cancelPromise)) {
      cb.cancel = cancelPromise
    } else if (is.func(promise.abort)) {
      cb.cancel = () => promise.abort()
    }
    promise.then(cb, error => cb(error, true))
  }

  /**
   * let childSaga = function*(){ 
   *  yield take('a') a()
   *  return 'child'
   * }
   * function *rootSaga(){
   *   let c = yield childSaga()
   *   let other = yield other
   *   console.log(c)
   * }
   * childSaga()会阻塞mainTask, 相当于yield* childSaga()
   */
  function resolveIterator(iterator, effectId, meta, cb) {
    proc(env, iterator, taskContext, effectId, meta, cb)
  }

  /**
   * function* saga(){
   *    yield take('a')
   *    yield call(fn)
   * }
   * 
   */
  function runTakeEffect({ channel = env.stdChannel, pattern, maybe }, cb) {
    const takeCb = input => {
      if (input instanceof Error) {
        cb(input, true)
        return
      }
      // take.maybe(pattern)不会自动终止channel
      if (isEnd(input) && !maybe) {
        cb(TERMINATE)
        return
      }
      cb(input)
    }
    /**
     * 直到当pattern匹配时，才会继续iterator.next(),并设置取消逻辑,
     * 所以在runChannelEffect例子中，fn1为阻塞调用(call)时，会阻塞fn2的执行
     */
    try {
      channel.take(takeCb, is.notUndef(pattern) ? matcher(pattern) : null)
    } catch (err) {
      cb(err, true)
      return
    }
    // 绑定向下传播取消逻辑,cancel:将takeCb从chan.takers中移除
    cb.cancel = takeCb.cancel
  }

  /**
   * function* rootSaga() {
   *   yield fork(genA)
   *   yield fork(genB)
   * }
   * function* genA() {
   *   yield put({ type: 'A' })
   *   yield take('B')
   * }
   * function* genB() {
   *   yield take('A')
   *   yield put({ type: 'B' })
   * }
   *
   * 结合runForkEffect中的suspend, flush 
   * asap是防止在mainTask的不同forkTask内，内嵌的put被忽略；
   */
  function runPutEffect({ channel, action, resolve }, cb) {
    /**
      Schedule the put in case another saga is holding a lock.
      The put will be executed atomically. ie nested puts will execute after
      this put has terminated.
    **/
    asap(() => {
      let result
      try {
        result = (channel ? channel.put : env.dispatch)(action)
      } catch (error) {
        cb(error, true)
        return
      }
      // yield put.resove(promise)
      if (resolve && is.promise(result)) {
        resolvePromise(result, cb)
      } else {
        cb(result)
      }
    })
    // Put effects are non cancellables
  }

  /**
   * yield call(fn, ...args)
   * fn为promise, iterator时，等待fn的结果完成
   * 所以是阻塞式调用
   */
  function runCallEffect({ context, fn, args }, effectId, cb) {
    // catch synchronous failures; see #152
    try {
      const result = fn.apply(context, args)

      if (is.promise(result)) {
        resolvePromise(result, cb)
        return
      }

      if (is.iterator(result)) {
        resolveIterator(result, effectId, getMetaInfo(fn), cb)
        return
      }

      cb(result)
    } catch (error) {
      cb(error, true)
    }
  }

  /**
   * fs.readFile(path [,option], callback); callback: (err, res) => fn(err, res)
   * yield cps(fs.readFile, ...args)
   * 让iterator能正确的理解error-first callbacks
   */
  function runCPSEffect({ context, fn, args }, cb) {
    // CPS (ie node style functions) can define their own cancellation logic
    // by setting cancel field on the cb

    // catch synchronous failures; see #152
    try {
      const cpsCb = (err, res) => (is.undef(err) ? cb(res) : cb(err, true))
      fn.apply(context, args.concat(cpsCb))
      if (cpsCb.cancel) {
        cb.cancel = () => cpsCb.cancel()
      }
    } catch (error) {
      cb(error, true)
    }
  }

  /**
   * yield fork(fn, ...args) 另生成一个task, 不会阻塞iterator的执行，
   * 但会追踪forkTask的结果, yield spawn(fn, ...args)会被视为独立的顶级任务
   */
  function runForkEffect({ context, fn, args, detached }, effectId, cb) {
    const taskIterator = createTaskIterator({ context, fn, args })
    const meta = getIteratorMetaInfo(taskIterator, fn)
    try {
      suspend()
      const task = proc(env, taskIterator, taskContext, effectId, meta, detached ? null : noop)
      // yield spawn(fn, ...args) 与父级任务独立
      if (detached) {
        cb(task)
      } else {
      // 父级任务将等待forkTask的结果，然后执行mainTsk.cont等
        if (task._isRunning) {
          taskQueue.addTask(task)
          cb(task)
        } else if (task._error) {
          taskQueue.abort(task._error)
        } else {
          cb(task)
        }
      }
    } finally {
      flush()
    }
    // Fork effects are non cancellables
  }

  // yield join(...tasks)
  function runJoinEffect(taskOrTasks, cb) {
    if (is.array(taskOrTasks)) {
      if (taskOrTasks.length === 0) {
        cb([])
        return
      }
      // 生成与taskOrTasks结构相应的fnOrFns和res, 当所有fnOrFns完成时,调用cb(res, isError)
      const childCallbacks = createAllStyleChildCallbacks(taskOrTasks, cb)
      taskOrTasks.forEach((t, i) => {
        joinSingleTask(t, childCallbacks[i])
      })
    } else {
      joinSingleTask(taskOrTasks, cb)
    }
  }
  /**
   * 参见end函数
   * 每个task完成时，会调用task.joiners.forEach(j => j.cb(result, isErr))
   * 即调用childCallbacks[i],而所有的childCallbacks完成后，调用iterator.next(res, isError)
   * 所以该函数会阻塞iterator,等待tasks完成
   */
  function joinSingleTask(taskToJoin, cb) {
    if (taskToJoin.isRunning()) {
      const joiner = { task, cb }
      cb.cancel = () => remove(taskToJoin.joiners, joiner)
      taskToJoin.joiners.push(joiner)
    } else {
      if (taskToJoin.isAborted()) {
        cb(taskToJoin.error(), true)
      } else {
        cb(taskToJoin.result())
      }
    }
  }

  // yield cancel()
  function runCancelEffect(taskOrTasks, cb) {
    if (taskOrTasks === SELF_CANCELLATION) {
      cancelSingleTask(task)
    } else if (is.array(taskOrTasks)) {
      taskOrTasks.forEach(cancelSingleTask)
    } else {
      cancelSingleTask(taskOrTasks)
    }
    cb()
    // cancel effects are non cancellables
  }

  /**
   * 参见cancel方法，标记task已取消，
   * 清空forkQueue,并递归取消forkQueue中的task的下一步逻辑，
   * 结束task,并调用有可能通过task.toPromise().then的下一步逻辑
   */
  function cancelSingleTask(taskToCancel) {
    if (taskToCancel.isRunning()) {
      taskToCancel.cancel()
    }
  }

  /**
   * yield all([
   *   helloSaga(),
   *   watchIncrementAsync()
   * ])
   * 类似Promise.all([])
   */
  function runAllEffect(effects, effectId, cb) {
    const keys = Object.keys(effects)
    if (keys.length === 0) {
      cb(is.array(effects) ? [] : {})
      return
    }

    const childCallbacks = createAllStyleChildCallbacks(effects, cb)
    keys.forEach(key => digestEffect(effects[key], effectId, key, childCallbacks[key]))
  }

  /**
   * 类似Promise.race();
   * 执行每个effect，只要有一个effect先执行完，取其结果调用iterator.next
   * 同时取消所有effect, 而effect.cancel在各自runSomeEffect中设置
   */
  function runRaceEffect(effects, effectId, cb) {
    let completed
    const keys = Object.keys(effects)
    const childCbs = {}

    keys.forEach(key => {
      const chCbAtKey = (res, isErr) => {
        if (completed) {
          return
        }
        if (isErr || shouldComplete(res)) {
          // Race Auto cancellation
          cb.cancel()
          cb(res, isErr)
        } else {
          cb.cancel()
          completed = true
          const response = { [key]: res }
          cb(is.array(effects) ? array.from({ ...response, length: keys.length }) : response)
        }
      }
      chCbAtKey.cancel = noop
      childCbs[key] = chCbAtKey
    })

    cb.cancel = () => {
      // prevents unnecessary cancellation
      if (!completed) {
        completed = true
        keys.forEach(key => childCbs[key].cancel())
      }
    }
    keys.forEach(key => {
      if (completed) {
        return
      }
      digestEffect(effects[key], effectId, key, childCbs[key])
    })
  }

  // const a = yield select(state => state.a)
  function runSelectEffect({ selector, args }, cb) {
    try {
      const state = selector(env.getState(), ...args)
      cb(state)
    } catch (error) {
      cb(error, true)
    }
  }

  /**
   * function* rootSaga(){
   *   const chan = yield actionChannel(pattern, buffer=buffers.expanding())
   *   yield take(pattern)
   *   yield fork(fn1)
   *   while(true){
   *     yield take(chan)
   *     yield call(fn2)
   *     // yield fork(fn)
   *   }
   * }
   */
  function runChannelEffect({ pattern, buffer }, cb) {
    // TODO: rethink how END is handled
    const chan = channel(buffer)
    const match = matcher(pattern)

    /**
     * action会同时被推送到env.stdChannel和channel里,
     * 所以当fn1为无阻塞调用(fork)时,fn1和fn2都会执行;
     * env.stdChannel中taker执行后会从takers里移除,
     * 所以每次重新生成一个taker插入到takers中，用于使chan能捕获每次action
     */
    const taker = action => {
      if (!isEnd(action)) {
        env.stdChannel.take(taker, match)
      }
      chan.put(action)
    }

    const { close } = chan

    chan.close = () => {
      taker.cancel()
      close()
    }

    env.stdChannel.take(taker, match)
    // iterator.next(chan) 将chan暴露出去
    cb(chan)
  }

  // if(yield cancelled())
  function runCancelledEffect(data, cb) {
    cb(Boolean(mainTask._isCancelled))
  }

  // channel为actionChannel生成的chan
  function runFlushEffect(channel, cb) {
    channel.flush(cb)
  }

  function runGetContextEffect(prop, cb) {
    cb(taskContext[prop])
  }

  function runSetContextEffect(props, cb) {
    assignWithSymbols(taskContext, props)
    cb()
  }

  function newTask(id, meta, cont) {
    const task = {
      [TASK]: true,
      id,
      meta,
      _deferredEnd: null,
      toPromise() {
        if (task._deferredEnd) {
          return task._deferredEnd.promise
        }

        const def = deferred()
        task._deferredEnd = def

        if (!task._isRunning) {
          if (task._isAborted) {
            def.reject(task._error)
          } else {
            def.resolve(task._result)
          }
        }

        return def.promise
      },
      cont,
      joiners: [],
      cancel,
      _isRunning: true,
      _isCancelled: false,
      _isAborted: false,
      _result: undefined,
      _error: undefined,
      isRunning: () => task._isRunning,
      isCancelled: () => task._isCancelled,
      isAborted: () => task._isAborted,
      result: () => task._result,
      error: () => task._error,
      setContext(props) {
        if (process.env.NODE_ENV !== 'production') {
          check(props, is.object, createSetContextWarning('task', props))
        }

        assignWithSymbols(taskContext, props)
      },
    }
    return task
  }
}
