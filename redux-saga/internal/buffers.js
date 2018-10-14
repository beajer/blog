import { kTrue, noop } from './utils'

const BUFFER_OVERFLOW = "Channel's Buffer overflow!"

const ON_OVERFLOW_THROW = 1
const ON_OVERFLOW_DROP = 2
const ON_OVERFLOW_SLIDE = 3
const ON_OVERFLOW_EXPAND = 4

const zeroBuffer = { isEmpty: kTrue, put: noop, take: noop }

function ringBuffer(limit = 10, overflowAction) {
  let arr = new Array(limit)
  let length = 0
  let pushIndex = 0
  let popIndex = 0

  const push = it => {
    arr[pushIndex] = it
    pushIndex = (pushIndex + 1) % limit
    length++
  }

  const take = () => {
    if (length != 0) {
      let it = arr[popIndex]
      arr[popIndex] = null
      length--
      popIndex = (popIndex + 1) % limit
      return it
    }
  }

  const flush = () => {
    let items = []
    while (length) {
      items.push(take())
    }
    return items
  }

  return {
    /**
    * 对于buffer：
    * isEmpty: 判断数据是否为空
    * put: 将数据put到数据池，当超出空间限制时，允许有不同的行为
    * take: 从数据池中按时间顺序取出最久的数据
    * flush: 从数据池中按时间顺序依次取出数据，清空数据池
    */
    isEmpty: () => length == 0,
    put: it => {
      if (length < limit) {
        push(it)
      } else {
        let doubledLimit
        switch (overflowAction) {
          case ON_OVERFLOW_THROW:
            throw new Error(BUFFER_OVERFLOW)
          case ON_OVERFLOW_SLIDE:
            arr[pushIndex] = it
            pushIndex = (pushIndex + 1) % limit
            popIndex = pushIndex
            break
          case ON_OVERFLOW_EXPAND:
            doubledLimit = 2 * limit

            arr = flush()

            length = arr.length
            pushIndex = arr.length
            popIndex = 0

            arr.length = doubledLimit
            limit = doubledLimit

            push(it)
            break
          default:
          // DROP
        }
      }
    },
    take,
    flush,
  }
}
/**
 * 数据总是从通道读取到缓冲区中，将缓冲区中的内容写到到通道中。
 */
export const none = () => zeroBuffer
export const fixed = limit => ringBuffer(limit, ON_OVERFLOW_THROW)
export const dropping = limit => ringBuffer(limit, ON_OVERFLOW_DROP)
export const sliding = limit => ringBuffer(limit, ON_OVERFLOW_SLIDE)
export const expanding = initialSize => ringBuffer(initialSize, ON_OVERFLOW_EXPAND)
