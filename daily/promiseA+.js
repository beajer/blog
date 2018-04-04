function Promise(executor){ //executor是一个执行器(函数)
	let _this = this
	_this.status = 'pending'
	_this.value = undefined
	_this.reason = undefined
	_this.onResolvedCallbacks = []
	_this.onRejectedCallbacks = []

	function resolve(value){
		if(_this.status === 'pending'){
			_this.status = 'resolved'
			_this.value = value
			_this.onResolvedCallbacks.forEach(function(fn){
				fn()
			})
		}
	}
	function reject(reason){
		if(_this.status === 'pending'){
			_this.status = 'rejected'
			_this.reason = reason
			_this.onRejectedCallbacks.forEach(function(fn){
				fn()
			})
		}
	}

	executor(resolve, reject)
}

Promise.prototype.then = function(onFullfilled, onRejected){
	onFullfilled = typeof onFullfilled === 'function' ? onFullfilled : function(value){
		return value
	}
	onRejected = typeof onRejected === 'function' ? onRejected : function (err) {
		throw err
	}

	let _this = this
	let promise2
	if(_this.status === 'pending'){
		promise2 = new Promise(function(resolve, reject){
			_this.onResolvedCallbacks.push(function(){
				setTimeout(function(){
					try{
						let x = onFullfilled(_this.value)
						resolvePromise(promise2, x, resolve, reject)
					}catch(e){
						reject(e)
					}
				})
			})
			_this.onRejectedCallbacks.push(function(){
				setTimeout(function(){
					try{
						let x = onRejected(_this.reason)
						resolvePromise(promise2, x, resolve, reject)
					}catch(e){
						reject(e)
					}
				})
			})
		})
	}
	if(_this.status === 'resolved'){
		promise2 = new Promise(function(resolve, reject){
			setTimeout(function(){
				try{
					let x = onFullfilled(_this.value)
					resolvePromise(promise2, x, resolve, reject)	
				}catch(e){
					reject(e)
				}
			})
		})
	}
	if(_this.status === 'rejected'){
		promise2 = new Promise(function(resolve, reject){
			setTimeout(function(){
				try{
					let x = onRejected(_this.reason)
					resolvePromise(promise2, x, resolve, reject)
				}catch(e){
					reject(e)
				}
			})
		})
	}
}

function resolvePromise(promise2, x, resolve, reject){
	if(promise2 === x){
		return reject(new TypeError('循环引用了'))
	}
	let called
	if(x !== null && (typeof x ==='object' || typeof x === 'function')){
		try{
			let then = x.then
			if(typeof then === 'function'){
				then.call(x, function(y){
					if(called) return
					called = true
					resolvePromise(promise2, x, resolve, reject)
				}, function(err){
					if(called) return
					called = true
					reject(err)
				})
			}else{
				resolve(x)
			}
		}catch(e){
			if(called) true
			called = true
			reject(e)
		}
	}else{
		resolve(x)
	}
}

Promise.deferred = function(){
	let dfd = {}
	dfd.promise = new Promise(function(resolve, reject){
		dfd.resolve = resolve
		dfd.reject = reject
	})
	return dfd
}

Promise.prototype.catch = function(callback){

	return this.then(null, callback)
}

Promise.all = function(promises){
	return new Promise(function(resolve, reject){
		let arr = []
		let i = 0
		function processData(index, y){
			arr[index] = y
			if(++i === promises.length){
				resolve(arr)
			}
		}
		for(let i = 0; i< promises.length; i++){
			promises[i].then(function(y){
				processData(i, y)
			}, reject)
		}
	})
}
Promise.race = function(promises){
	return new Promise(function(resolve, reject){
		for(let i = 0 ; i < promises.length; i++){
			promises[i].then(resolve, reject)
		}
	})
}
Promise.resolve = function(value){
	return new Promise(function(resolve, reject){
		resolve(value)
	})
}
Promsie.reject = function(reason){
	return new Promise(function(resolve, reject){
		reject(reason)
	})
}