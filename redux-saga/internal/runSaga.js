import * as is from '../dependencies/is';
import { compose } from 'redux';
import {
  check,
  wrapSagaDispatch,
  noop,
  logError,
  identity,
  getMetaInfo,
} from './utils';
import proc from './proc';
import { stdChannel } from './channel';
import { immediately } from './scheduler';
import nextSagaId from './uid'
const RUN_SAGA_SIGNATURE = 'runSaga(options, saga, ...args)';
const NON_GENERATOR_ERR = `${RUN_SAGA_SIGNATURE}: saga argument must be a Generator function!`;

export function runSaga(
  {
    channel = stdChannel(),
    dispatch,
    getState,
    context = {},
    sagaMonitor,
    effectMiddlewares,
    onError = logError
  },
  saga,
  ...args
) {
  if (process.env.NODE_ENV !== 'production') {
    check(saga, is.func, NON_GENERATOR_ERR);
  }
  const iterator = saga(...args);

  if (process.env.NODE_ENV !== 'production') {
    check(iterator, is.iterator, NON_GENERATOR_ERR);
  }

  const effectId = nextSagaId();

  if (sagaMonitor) {
    // monitors are expected to have a certain interface, let's fill-in any missing ones
    sagaMonitor.rootSagaStarted = sagaMonitor.rootSagaStarted || noop;
    sagaMonitor.effectTriggered = sagaMonitor.effectTriggered || noop;
    sagaMonitor.effectResolved = sagaMonitor.effectResolved || noop;
    sagaMonitor.effectRejected = sagaMonitor.effectRejected || noop;
    sagaMonitor.effectCancelled = sagaMonitor.effectCancelled || noop;
    sagaMonitor.actionDispatched = sagaMonitor.actionDispatched || noop;

    sagaMonitor.rootSagaStarted({ effectId, saga, args });
  }

  if (process.env.NODE_ENV !== 'production') {
    if (is.notUndef(dispatch)) {
      check(dispatch, is.func, 'dispatch must be a function');
    }

    if (is.notUndef(getState)) {
      check(getState, is.func, 'getState must be a function');
    }

    if (is.notUndef(effectMiddlewares)) {
      const MIDDLEWARE_TYPE_ERROR =
        'effectMiddlewares must be an array of functions';
      check(effectMiddlewares, is.array, MIDDLEWARE_TYPE_ERROR);
      effectMiddlewares.forEach(effectMiddleware =>
        check(effectMiddleware, is.func, MIDDLEWARE_TYPE_ERROR)
      );
    }

    check(onError, is.func, 'onError passed to the redux-saga is not a function!')
  };

  let finalizeRunEffect;
  if (effectMiddlewares) {
    const middleware = compose(...effectMiddlewares);
    finalizeRunEffect = runEffect => {
      return (effect, effectId, currCb) => {
        const plainRunEffect = eff => runEffect(eff, effectId, currCb);
        return middleware(plainRunEffect)(effect);
      };
    };
  } else {
    finalizeRunEffect = identity;
  }

  /**
   * env.stdChannel集中管理所有对action监听的子saga,
   * 由rootSaga和任何childSaga中take(),actionChannel()产生的taker
   * 都将由env.stdChannel聚集统一管理
   */
  const env = {
    channel,
    dispatch: wrapSagaDispatch(dispatch),
    getState,
    sagaMonitor,
    onError,
    finalizeRunEffect
  };

  return immediately(() => {
    const task = proc(
      env,
      iterator,
      context,
      effectId,
      getMetaInfo(saga),
      /* isRoot */ true,
      noop
    );

    if (sagaMonitor) {
      sagaMonitor.effectResolved(effectId, task);
    }
    return task;
  });
}
