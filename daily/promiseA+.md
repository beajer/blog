## [Promises/A+](https://promisesaplus.com/)focus on providing an interoperable then method.

- [2.2.1 onFulfilled or onRejected is not a function, it must be ignored](https://promisesaplus.com/#point-23)
```js
let p = Promise.resolve()
p.then(null, null).then(() => {
  console.log(1)
})
```

- [2.2.4 onFulfilled and onRejected execute asynchronously](https://promisesaplus.com/#point-34)
```js
// This can be implemented with either a “macro-task” mechanism such as setTimeout or setImmediate, or with a “micro-task” mechanism such as MutationObserver or process.nextTick.
let p = Promise.resolve()
p.then(() => {
  console.log(2)
})
console.log(1)
```

- [2.2.6 then may be called multiple times on the same promise](https://promisesaplus.com/#point-36)
```js
let p1 = Promise.resolve(1)
p1.then(e => {
  console.error('first: ' + e)
})
p1.then(e => {
  console.error('second: ' + e)
})
// or
let p2 = Promise.reject(1)
p2.catch(e => {
  console.error('first: ' + e)
})
p2.catch(e => {
  console.error('second: ' + e)
})
```

- [2.2.7 The then method must return a promise](https://promisesaplus.com/#point-39)
  ```js
  let p1 = Promise.resolve()
  let p2 = p1.then()
  // let p1 = Promise.reject()
  // let p2 = p1.catch(()=>{})
  console.log(p1 === p2)
  // Implementations may allow p1 === p2, but it would be false in Firefox 59.0.2 and Chrome 65.0.3325.181 and node v8.10.0 etc.
  ```

  - [The reject method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch)
  ```
  It behaves the same as calling 'Promise.prototype.then(undefined, onRejected)'
  ```

  - 2.2.7.1 If either onFulfilled or onRejected returns a value x, run the Promise Resolution Procedure [[Resolve]](promise2, x)
  ```js
  Promise.reject(1)
    .catch(e => {
      console.error(e)
      return '2'
    }).then(d => {
      console.log(d)
    })
  /*If a then method return a non-reject value, the promise would be fulfilled
  */
  ```

  - 2.2.7.2 If either onFulfilled or onRejected throws an exception e, promise2 must be rejected with e as the reason
  ```js
  Promise.resolve().then(()=> {
    throw 1
  }).catch(e => {
    console.error(e)
  })
  ```

  - 2.2.7.3 If onFulfilled is not a function and promise1 is fulfilled, promise2 must be fulfilled with the same value as promise1.
  ```js
  Promise.resolve(1).then(2).then(d => {
    console.log(d)
  })
  // 1
  ```

  - 2.2.7.4 If onRejected is not a function and promise1 is rejected, promise2 must be rejected with the same reason as promise1.
  ```js
  Promise.reject(1).then(2).then(null, e => {
    console.error(e)
  })
  // 1
  ```

- 2.3 [The Promise Resolution Procedure](https://promisesaplus.com/#the-promise-resolution-procedure)
*To run [[Resolve]](promise, x), perform the following steps*

  - 2.3.1 If promise and x refer to the same object, reject promise with a TypeError as the reason.
  ```js
  let p1 = Promise.resolve().then(()=>{
    return p1
  })
  p1.catch(e => {
    console.error(e)
  })
  //TypeError: Chaining cycle detected for promise #<Promise>
  ```

  - 2.3.2 If x is a promise, adopt its state
  ```js
  let p1 = Promise.reject()
  // let p1 = Promise.resolve()
  let p2 = Promise.resolve().then(()=>{
    return p1
  }).then(() => {
    console.log('onfulfilled')
  }, () => {
    console.error('onrejected')
  })
  //---
  let p1 = new Promise(()=>{})
  // let p1 = {then (){}}
  let p2 = Promise.resolve().then(() => {
    console.log('1')
    return p1
  }).then(d => {
    console.log(d)
  }, e => {
    console.error(e)
  })
  ```

  - 2.3.3 Otherwise, if x is an object or function
    - 2.3.3.2 If retrieving the property x.then results in a thrown exception e, reject promise with e as the reason.
    ```js
    let thenable = {}
    Object.defineProperty(thenable, 'then', {
      configurable: true,
      enumerable: true,
      get () {
        throw new Error()
      },
      set () {
      }
    })
    let p1 = Promise.resolve().then(() => {
      return thenable
    }).then(d => {
      console.log(d)
    }, e => {
      console.error(e)
    })
    ```
    - 2.3.3.3
    ```js
    let thenable = {
      then (resolvePromise, rejectPromise) {
        resolvePromise('1')
        // throw new Error('1')
        // rejectPromise('2')
      }
    }
    let p1 = Promise.resolve().then(() => {
      return thenable
    }).then(d => {
      console.log(d)
    }, e => {
      console.error(e)
    })
    ```
    -2.3.3.4 If then is not a function, fulfill promise with x.
    ```js
    let thenable = {
      then: '1'
    }
    let p1 = Promise.resolve().then(() => {
      return thenable
    }).then(d => {
      console.log(d)
    }, e => {
      console.error(e)
    })
    // Object {then: "1"}
    ```

  - 2.3.4 If x is not an object or function, fulfill promise with x
    ```js
    let p1 = Promise.resolve().then(() => {
      return 1
    }).then(d => {
      console.log(d)
    })
    ```