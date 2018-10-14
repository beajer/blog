import * as is from '../../dependencies/is'
import { makeIterator } from '../utils'

const done = value => ({ done: true, value })
export const qEnd = {}

export function safeName(patternOrChannel) {
  if (is.channel(patternOrChannel)) {
    return 'channel'
  }

  if (is.stringableFunc(patternOrChannel)) {
    return String(patternOrChannel)
  }

  if (is.func(patternOrChannel)) {
    return patternOrChannel.name
  }

  return String(patternOrChannel)
}

/**
 * 
 * @param {Object} fsm {
 *  q1(){},
 *  q2(){},
 *  ...
 * }
 * @param {*} startState 'q1'
 * @param {*} name 'fn.name'
 * 生成一个有限状态机iterator，
 * 通过startState与nextState控制流程，
 * 通过stateUpater向上层函数提供改变参数的能力
 * 返回值iterator作为给proc第二个参数iterator
 */
export default function fsmIterator(fsm, startState, name) {
  let stateUpdater,
    errorState,
    // {done: Boolean, value: Effect}
    effect,
    nextState = startState

  function next(arg, error) {
    if (nextState === qEnd) {
      return done(arg)
    }
    if (error && !errorState) {
      nextState = qEnd
      throw error
    } else {
      stateUpdater && stateUpdater(arg)
      const currentState = error ? fsm[errorState](error) : fsm[nextState]()
      ;({ nextState, effect, stateUpdater, errorState } = currentState)
      return nextState === qEnd ? done(arg) : effect
    }
  }

  return makeIterator(next, error => next(null, error), name)
}
