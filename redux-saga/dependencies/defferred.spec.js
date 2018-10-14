let p = {}
p.promise = new Promise(resolve => {
  p.resolve = resolve
})
p.promise.then(d => console.log(d))
p.resolve(1)

// 与emitter类似，但任务会在事件循环中微队列执行
function emitter() {
  const subscribers = []

  function subscribe(sub) {
    subscribers.push(sub)
    return () => remove(subscribers, sub)
  }

  function emit(item) {
    const arr = subscribers.slice()
    // let p = Promise.resolve()
    for (let i = 0, len = arr.length; i < len; i++) {
      arr[i](item)
      // p.then(_ => arr[i](item))
    }
  }

  return {
    subscribe,
    emit,
  }
}
