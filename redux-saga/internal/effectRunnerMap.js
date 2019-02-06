import { SELF_CANCELLATION, TERMINATE } from '@redux-saga/symbols';
import * as is from '@redux-saga/is';
import * as effectTypes from './effectTypes';
import { channel, isEnd } from './channel';
// usage of proc here makes internal circular dependency
// this works fine, but it is a little bit unfortunate
import proc from './proc';
import resolvePromise from './resolvePromise';
import matcher from './matcher';
import { asap, immediately } from './scheduler';
import { current as currentEffectId } from './uid';
import {
  assignWithSymbols,
  createAllStyleChildCallbacks,
  createEmptyArray,
  makeIterator,
  noop,
  remove,
  shouldComplete,
  getMetaInfo
} from './utils';

function getIteratorMetaInfo(iterator, fn) {
  if (iterator.isSagaIterator) {
    return { name: iterator.meta.name };
  }
  return getMetaInfo(fn);
}

function createTaskIterator({ context, fn, args }) {
  // catch synchronous failures; see #152 and #441
  try {
    const result = fn.apply(context, args);

    // i.e. a generator function returns an iterator
    if (is.iterator(result)) {
      return result;
    }

    const next = (value = result) => ({
      value,
      done: !is.promise(value)
    });

    return makeIterator(next);
  } catch (err) {
    // do not bubble up synchronous failures for detached forks
    // instead create a failed task. See #152 and #441
    return makeIterator(() => {
      throw err;
    });
  }
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
function runPutEffect(env, { channel, action, resolve }, cb) {
  /**
      Schedule the put in case another saga is holding a lock.
      The put will be executed atomically. ie nested puts will execute after
      this put has terminated.
    **/
  asap(() => {
    let result;
    try {
      result = (channel ? channel.put : env.dispatch)(action);
    } catch (error) {
      cb(error, true);
      return;
    }
    // yield put.resove(promise)
    if (resolve && is.promise(result)) {
      resolvePromise(result, cb);
    } else {
      cb(result);
    }
  });
  // Put effects are non cancellables
}

/**
 * function* saga(){
 *    yield take('a')
 *    yield call(fn)
 * }
 *
 */
function runTakeEffect(env, { channel = env.channel, pattern, maybe }, cb) {
  const takeCb = input => {
    if (input instanceof Error) {
      cb(input, true);
      return;
    }
    // take.maybe(pattern)不会自动终止channel
    if (isEnd(input) && !maybe) {
      cb(TERMINATE);
      return;
    }
    cb(input);
  };
  /**
   * 直到当pattern匹配时，才会继续iterator.next(),并设置取消逻辑,
   * 所以在runChannelEffect例子中，fn1为阻塞调用(call)时，会阻塞fn2的执行
   */
  try {
    channel.take(takeCb, is.notUndef(pattern) ? matcher(pattern) : null);
  } catch (err) {
    cb(err, true);
    return;
  }
  // 绑定向下传播取消逻辑,cancel:将takeCb从chan.takers中移除
  cb.cancel = takeCb.cancel;
}

/**
 * yield call(fn, ...args)
 * fn为promise, iterator时，等待fn的结果完成
 * 所以是阻塞式调用
 */
function runCallEffect(env, { context, fn, args }, cb, { task }) {
  // catch synchronous failures; see #152
  try {
    const result = fn.apply(context, args);

    if (is.promise(result)) {
      resolvePromise(result, cb);
      return;
    }

    if (is.iterator(result)) {
      // resolveIterator(result, effectId, getMetaInfo(fn), cb);
      proc(
        env,
        result,
        task.context,
        currentEffectId,
        getMetaInfo(fn),
        /* isRoot */ false,
        cb
      );
      return;
    }

    cb(result);
  } catch (error) {
    cb(error, true);
  }
}

/**
 * fs.readFile(path [,option], callback); callback: (err, res) => fn(err, res)
 * yield cps(fs.readFile, ...args)
 * 让iterator能正确的理解error-first callbacks
 */
function runCPSEffect(env, { context, fn, args }, cb) {
  // CPS (ie node style functions) can define their own cancellation logic
  // by setting cancel field on the cb

  // catch synchronous failures; see #152
  try {
    const cpsCb = (err, res) => (is.undef(err) ? cb(res) : cb(err, true));
    fn.apply(context, args.concat(cpsCb));
    if (cpsCb.cancel) {
      cb.cancel = () => cpsCb.cancel();
    }
  } catch (error) {
    cb(error, true);
  }
}

/**
 * yield fork(fn, ...args) 另生成一个task, 不会阻塞iterator的执行，
 * 但会追踪forkTask的结果, yield spawn(fn, ...args)会被视为独立的顶级任务
 */
function runForkEffect(
  env,
  { context, fn, args, detached },
  cb,
  { task: parent }
) {
  const taskIterator = createTaskIterator({ context, fn, args });
  const meta = getIteratorMetaInfo(taskIterator, fn);

  immediately(() => {
    const child = proc(
      env,
      taskIterator,
      parent.context,
      currentEffectId,
      meta,
      detached,
      noop
    );
    // yield spawn(fn, ...args) 与父级任务独立
    if (detached) {
      cb(child);
    } else {
      // 父级任务将等待forkTask的结果，然后执行mainTsk.cont等
      if (child._isRunning) {
        parent.queue.addTask(child);
        cb(child);
      } else if (child.isAborted()) {
        parent.queue.abort(child.error());
      } else {
        cb(child);
      }
    }
  });
  // Fork effects are non cancellables
}

// yield join(...tasks)
function runJoinEffect(env, taskOrTasks, cb, { task }) {
  /**
   * 参见end函数
   * 每个task完成时，会调用task.joiners.forEach(j => j.cb(result, isErr))
   * 即调用childCallbacks[i],而所有的childCallbacks完成后，调用iterator.next(res, isError)
   * 所以该函数会阻塞iterator,等待tasks完成
   */
  const joinSingleTask = (taskToJoin, cb) => {
    if (taskToJoin.isRunning()) {
      const joiner = { task, cb };
      cb.cancel = () => remove(taskToJoin.joiners, joiner);
      taskToJoin.joiners.push(joiner);
    } else {
      if (taskToJoin.isAborted()) {
        cb(taskToJoin.error(), true);
      } else {
        cb(taskToJoin.result());
      }
    }
  };

  if (is.array(taskOrTasks)) {
    if (taskOrTasks.length === 0) {
      cb([]);
      return;
    }
    // 生成与taskOrTasks结构相应的fnOrFns和res, 当所有fnOrFns完成时,调用cb(res, isError)
    const childCallbacks = createAllStyleChildCallbacks(taskOrTasks, cb);
    taskOrTasks.forEach((t, i) => {
      joinSingleTask(t, childCallbacks[i]);
    });
  } else {
    joinSingleTask(taskOrTasks, cb);
  }
}

/**
 * 参见cancel方法，标记task已取消，
 * 清空forkQueue,并递归取消forkQueue中的task的下一步逻辑，
 * 结束task,并调用有可能通过task.toPromise().then的下一步逻辑
 */
function cancelSingleTask(taskToCancel) {
  if (taskToCancel.isRunning()) {
    taskToCancel.cancel();
  }
}

// yield cancel()
function runCancelEffect(env, taskOrTasks, cb, { task }) {
  if (taskOrTasks === SELF_CANCELLATION) {
    cancelSingleTask(task);
  } else if (is.array(taskOrTasks)) {
    taskOrTasks.forEach(cancelSingleTask);
  } else {
    cancelSingleTask(taskOrTasks);
  }
  cb();
  // cancel effects are non cancellables
}

/**
 * yield all([
 *   helloSaga(),
 *   watchIncrementAsync()
 * ])
 * 类似Promise.all([])
 */
function runAllEffect(env, effects, cb, { digestEffect }) {
  const effectId = currentEffectId;
  const keys = Object.keys(effects);
  if (keys.length === 0) {
    cb(is.array(effects) ? [] : {});
    return;
  }

  const childCallbacks = createAllStyleChildCallbacks(effects, cb);
  keys.forEach(key =>
    digestEffect(effects[key], effectId, childCallbacks[key], key)
  );
}

/**
 * 类似Promise.race();
 * 执行每个effect，只要有一个effect先执行完，取其结果调用iterator.next
 * 同时取消所有effect, 而effect.cancel在各自runSomeEffect中设置
 */
function runRaceEffect(env, effects, cb, { digestEffect }) {
  const effectId = currentEffectId;
  const keys = Object.keys(effects);
  const response = is.array(effects) ? createEmptyArray(keys.length) : {};
  const childCbs = {};
  let completed;

  keys.forEach(key => {
    const chCbAtKey = (res, isErr) => {
      if (completed) {
        return;
      }
      if (isErr || shouldComplete(res)) {
        // Race Auto cancellation
        cb.cancel();
        cb(res, isErr);
      } else {
        cb.cancel();
        completed = true;
        response = { [key]: res };
        cb(response);
      }
    };
    chCbAtKey.cancel = noop;
    childCbs[key] = chCbAtKey;
  });

  cb.cancel = () => {
    // prevents unnecessary cancellation
    if (!completed) {
      completed = true;
      keys.forEach(key => childCbs[key].cancel());
    }
  };
  keys.forEach(key => {
    if (completed) {
      return;
    }
    digestEffect(effects[key], effectId, childCbs[key], key);
  });
}

// const a = yield select(state => state.a)
function runSelectEffect(env, { selector, args }, cb) {
  try {
    const state = selector(env.getState(), ...args);
    cb(state);
  } catch (error) {
    cb(error, true);
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
function runChannelEffect(env, { pattern, buffer }, cb) {
  const chan = channel(buffer);
  const match = matcher(pattern);

  /**
   * action会同时被推送到env.stdChannel和channel里,
   * 所以当fn1为无阻塞调用(fork)时,fn1和fn2都会执行;
   * env.stdChannel中taker执行后会从takers里移除,
   * 所以每次重新生成一个taker插入到takers中，用于使chan能捕获每次action
   */
  const taker = action => {
    if (!isEnd(action)) {
      env.channel.take(taker, match);
    }
    chan.put(action);
  };

  const { close } = chan;

  chan.close = () => {
    taker.cancel();
    close();
  };

  env.channel.take(taker, match);
  // iterator.next(chan) 将chan暴露出去
  cb(chan);
}

// if(yield cancelled())
function runCancelledEffect(env, data, cb, { task }) {
  cb(task.isCancelled());
}

// channel为actionChannel生成的chan
function runFlushEffect(env, channel, cb) {
  channel.flush(cb);
}

function runGetContextEffect(env, props, cb, { task }) {
  cb(task.context[prop]);
}

function runSetContextEffect(env, props, cb, { task }) {
  assignWithSymbols(task.context, props);
  cb();
}

const effectRunnerMap = {
  [effectTypes.TAKE]: runTakeEffect,
  [effectTypes.PUT]: runPutEffect,
  [effectTypes.ALL]: runAllEffect,
  [effectTypes.RACE]: runRaceEffect,
  [effectTypes.CALL]: runCallEffect,
  [effectTypes.CPS]: runCPSEffect,
  [effectTypes.FORK]: runForkEffect,
  [effectTypes.JOIN]: runJoinEffect,
  [effectTypes.CANCEL]: runCancelEffect,
  [effectTypes.SELECT]: runSelectEffect,
  [effectTypes.ACTION_CHANNEL]: runChannelEffect,
  [effectTypes.CANCELLED]: runCancelledEffect,
  [effectTypes.FLUSH]: runFlushEffect,
  [effectTypes.GET_CONTEXT]: runGetContextEffect,
  [effectTypes.SET_CONTEXT]: runSetContextEffect
};

export default effectRunnerMap;
