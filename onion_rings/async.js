let sleep = (t) => {
  return new Promise((resolve, reject) => {
    setTimeout(()=>{
      console.log(t)
      resolve()
    }, 1000)
  }) 
}
let a = async (ctx, next) => {
  await sleep(1)
  await next()
  await sleep(5)
}
let b = async (ctx, next) => {
  await sleep(2)
  await next()
  await sleep(4)
}
let c = async (ctx, next) => {
  await sleep(3)
}
const middleware = [a, b, c]
var ctx = {}
// ctx指上下文
function compose(ctx, middlewares) {
  let i = 0
  return dispatch(0)
  function dispatch (i) {
    let fn = middlewares[i]
    return fn(ctx, function next () {
      return dispatch(i + 1)
    })
  }
}
let f = compose(ctx, middleware)
f.then((...args)=>{
  console.log(args)
})
