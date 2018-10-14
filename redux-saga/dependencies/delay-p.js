import { CANCEL } from './symbols'

export default function delayP(ms) {
  let timeoutId
  const promise = new Promise(resolve => {
    // setTimeout(_ => resolve(true), ms)
    timeoutId = setTimeout(resolve, ms, true)
  })

  promise[CANCEL] = () => {
    clearTimeout(timeoutId)
  }

  return promise
}
