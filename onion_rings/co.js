let co = require('co')
let o = ''
function* a(next){
	o = '1'
	yield next
	o += '5'
	console.log(o)
}
function* b(next){
	o += '2'
	yield next
	o += '4'
}
function* c(next){
	o += '3'
}
let f = function* () {
  let prev = null
  let middlewares = [a, b, c]
  let i = middlewares.length
  while(i--){
    prev = middlewares[i].call(null, prev)
  }
  yield prev
}
co(f)
