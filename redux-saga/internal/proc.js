import * as is from '../dependencies/is';
import { IO, TASK_CANCEL } from '@redux-saga/symbols';
import { RUNNING, CANCELLED, ABORTED, DONE } from './task-status';
import effectRunnerMap from './effectRunnerMap';
import resolvePromise from './resolvePromise';
import nextEffectId from './uid';
import {
  asyncIteratorSymbol,
  noop,
  shouldCancel,
  shouldTerminate
} from './utils';
import newTask from './newTask';
import * as sagaError from './sagaError';

export default function proc(
  env,
  iterator,
  parentContext,
  parentEffectId,
  meta,
  isRoot,
  cont
) {
  if (process.env.NODE_ENV !== 'production' && iterator[asyncIteratorSymbol]) {
    throw new Error(
      "redux-saga doesn't support async generators, please use only regular ones"
    );
  }
  const finalRunEffect = env.finalizeRunEffect(runEffect);

  /**
    Tracks the current effect cancellation
    Each time the generator progresses. calling runEffect will set a new value
    on it. It allows propagating cancellation to child effects
  **/
  next.cancel = noop;

  /** Creates a main task to track the main flow **/
  const mainTask = {
    meta,
    cancel: cancelMain,
    status: RUNNING
  };
  /**
   Creates a new task descriptor for this generator.
   A task is the aggregation of it's mainTask and all it's forked tasks.
   **/
  const task = newTask(
    env,
    mainTask,
    parentContext,
    parentEffectId,
    meta,
    isRoot,
    cont
  );

  const executingContext = {
    task,
    digestEffect
  };
  /**
    cancellation of the main task. We'll simply resume the Generator with a TASK_CANCEL
  **/
  function cancelMain() {
    if (mainTask.status === RUNNING) {
      mainTask.status = CANCELLED;
      next(TASK_CANCEL);
    }
  }

  /**
    attaches cancellation logic to this task's continuation
    this will permit cancellation to propagate down the call chain
  **/
  cont.cancel = task.cancel;

  // kicks up the generator
  next();

  // then return the task descriptor to the caller
  return task;

  /**
   * This is the generator driver
   * It's a recursive async/continuation function which calls itself
   * until the generator terminates or throws
   * @param {internal commands(TASK_CANCEL | TERMINATE) | any} arg - value, generator will be resumed with.
   * @param {boolean} isErr - the flag shows if effect finished with an error
   *
   * receives either (command | effect result, false) or (any thrown thing, true)
   */
  function next(arg, isErr) {
    try {
      let result;
      if (isErr) {
        result = iterator.throw(arg);
        // user handled the error, we can clear bookkept values
        sagaError.clear();
      } else if (shouldCancel(arg)) {
        /**
          getting TASK_CANCEL automatically cancels the main task
          We can get this value here

          - By cancelling the parent task manually
          - By joining a Cancelled task
        **/
        mainTask.status = CANCELLED;
        /**
          Cancels the current effect; this will propagate the cancellation down to any called tasks
        **/
        next.cancel();
        /**
          If this Generator has a `return` method then invokes it
          This will jump to the finally block
        **/
        result = is.func(iterator.return)
          ? iterator.return(TASK_CANCEL)
          : { done: true, value: TASK_CANCEL };
      } else if (shouldTerminate(arg)) {
        // We get TERMINATE flag, i.e. by taking from a channel that ended using `take` (and not `takem` used to trap End of channels)
        result = is.func(iterator.return) ? iterator.return() : { done: true };
      } else {
        result = iterator.next(arg);
      }

      if (!result.done) {
        digestEffect(result.value, parentEffectId, next);
      } else {
        /**
          This Generator has ended, terminate the main task and notify the fork queue
        **/
        if (mainTask.status !== CANCELLED) {
          mainTask.status = DONE;
        }
        mainTask.cont(result.value);
      }
    } catch (error) {
      if (mainTask.status === CANCELLED) {
        throw error;
      }
      mainTask.status = ABORTED;

      mainTask.cont(error, true);
    }
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
      resolvePromise(effect, currCb);
    } else if (is.iterator(effect)) {
      proc(
        env,
        effect,
        task.context,
        effectId,
        meta,
        /* isRoot */ false,
        currCb
      );
    } else if (effect && effect[IO]) {
      const effectRunner = effectRunnerMap[effect.type];
      effectRunner(env, effect.payload, currCb, executingContext);
    } else {
      // anything else returned as is
      currCb(effect);
    }
  }

  /**
   * 为cb,即next绑定cancel逻辑，cancel逻辑向下传播
   */
  function digestEffect(effect, parentEffectId, cb, label = '') {
    const effectId = nextEffectId();
    env.sagaMonitor &&
      env.sagaMonitor.effectTriggered({
        effectId,
        parentEffectId,
        label,
        effect
      });

    /**
      completion callback and cancel callback are mutually exclusive
      We can't cancel an already completed effect
      And We can't complete an already cancelled effectId
    **/
    let effectSettled;

    // Completion callback passed to the appropriate effect runner
    function currCb(res, isErr) {
      if (effectSettled) {
        return;
      }

      effectSettled = true;
      cb.cancel = noop; // defensive measure
      if (env.sagaMonitor) {
        if (isErr) {
          env.sagaMonitor.effectRejected(effectId, res);
        } else {
          env.sagaMonitor.effectResolved(effectId, res);
        }
      }
      if (isErr) {
        sagaError.setCrashedEffect(effect)
      }
      cb(res, isErr);
    }
    // tracks down the current cancel
    currCb.cancel = noop;

    // setup cancellation logic on the parent cb
    cb.cancel = () => {
      // prevents cancelling an already completed effect
      if (effectSettled) {
        return;
      }

      effectSettled = true;
      /**
        propagates cancel downward
        catch uncaught cancellations errors; since we can no longer call the completion
        callback, log errors raised during cancellations into the console
      **/
      currCb.cancel();
      currCb.cancel = noop; // defensive measure

      env.sagaMonitor && env.sagaMonitor.effectCancelled(effectId);
    };

    finalRunEffect(effect, effectId, currCb);
  }
}
