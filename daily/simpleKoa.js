let co = require('co')
class MyKoa{
	constructor () {
		this.middlewares = []
	}

	use (generator) {
		this.middlewares.push(generator)
	}

	listen () {
		this._run()
	}

	_run () {
		const ctx = this
		const middlewares = ctx.middlewares
		co(function* () {
			let prev = null
			let i = middlewares.length

			while(i--){
				prev = middlewares[i].call(ctx, prev)
			}
			yield prev
		})
	}
}
var app = new MyKoa()
app.use(function* a(next){
	this.body = '1'
	yield next
	this.body += '5'
	console.log(this.body)
})
app.use(function* b(next){
	this.body += '2'
	yield next
	this.body += '4'
})
app.use(function* c(next){
	this.body += '3'
})
app.listen()
