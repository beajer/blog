function noop() {}

class Handler {
  constructor(onFullfilled, onRejected, promise) {
    this.onFullfilled =
      typeof onFullfilled === 'function' ? onFullfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }
}

class MyPromise {
  constructor(exec) {
    if (typeof exec !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._handled = false;
    this._value = undefined;
    this._deferreds = [];

    this._doResolve(exec);
  }
  _doResolve(exec) {
    let done = false;
    try {
      exec(
        value => {
          if (done) return;
          done = true;
          this._resolve(value);
        },
        reason => {
          if (done) return;
          done = true;
          this._reject(reason);
        }
      );
    } catch (ex) {
      if (done) return;
      done = true;
      this._reject(ex);
    }
  }
  _resolve(newValue) {
    try {
      if (newValue === this) {
        throw new TypeError('A promise canot be resolved with itself.');
      }
      if (
        newValue &&
        (typeof newValue === 'object' || newValue.then === 'function')
      ) {
        const { then } = newValue;
        if (newValue instanceof this.constructor) {
          this._state = 3;
          this._value = newValue;
          this._finale();
          return;
        } else if (typeof then === 'function') {
          this._doResolve(then.bind(newValue));
          return;
        }
        this._state = 1;
        this._value = newValue;
        this._finale();
      }
    } catch (e) {
      this._reject(e);
    }
  }
  _reject(newValue) {
    this._state = 2;
    this._value = newValue;
    this._finale();
  }
  _finale() {
    if (this._state === 2 && this._deferreds.length === 0) {
      // @ts-ignore
      this.constructor._immediateFn(() => {
        if (!this._handled) {
          // @ts-ignore
          this.constructor._unhandledRejectionFn(this._value);
        }
      });
    }

    for (let i = 0, len = this._deferreds.length; i < len; i++) {
      this._handle(this._deferreds[i]);
    }
    this._deferreds = null;
  }
  _handle(deferred) {
    let self = this;
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    // @ts-ignore
    this.constructor._immediateFn(() => {
      const cb =
        self._state === 1 ? deferred.onFullfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? self._resolve : self._reject).call(
          deferred.promise,
          self._value
        );
        return;
      }
      let ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        self._reject.call(deferred.promise, e);
        return;
      }
      self._resolve.call(deferred.promise, ret);
    });
  }

  then(onFullfilled, onRejected) {
    // @ts-ignore
    const prom = new this.constructor(noop);
    this._handle(new Handler(onFullfilled, onRejected, prom));
    return prom;
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(cb) {
    const { constructor } = this;
    return this.then(
      value => {
        // @ts-ignore
        return constructor.resolve(cb()).then(() => value);
      },
      reason => {
        // @ts-ignore
        return constructor.resolve(cb()).then(() => constructor.reject(reason));
      }
    );
  }

  static all(arr) {
    return new this((resolve, reject) => {
      if (!Array.isArray(arr)) {
        return reject(new TypeError('Promise.all accepts an array'));
      }
      if (arr.length === 0) return resolve([]);
      const args = [...arr];
      let remain = arr.length;
      function handleSinglePromise(promOrVal, index) {
        try {
          if (
            promOrVal &&
            (typeof promOrVal === 'object' || typeof promOrVal === 'function')
          ) {
            if (typeof promOrVal.then === 'function') {
              promOrVal.then(v => handleSinglePromise(v, index), reject);
              return;
            }
          }
          args[index] = promOrVal;
          if (--remain === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      arr.forEach(handleSinglePromise);
    });
  }

  static resolve(promOrVal) {
    if (
      promOrVal &&
      typeof promOrVal === 'object' &&
      promOrVal.constructor === Promise
    ) {
      return promOrVal;
    }
    return new this(resolve => {
      resolve(promOrVal);
    });
  }

  static reject(promOrVal) {
    return new this((resolve, reject) => {
      reject(promOrVal);
    });
  }

  static race(arr) {
    return new this((resolve, reject) => {
      if (!Array.isArray(arr)) {
        return reject(new TypeError('Promise.race accepts an array'));
      }

      for (let i = 0, len = arr.length; i < len; i++) {
        Promise.resolve(arr[i]).then(resolve, reject);
      }
    });
  }

  // todo
  static allSettled(arr) {
    throw new Error(
      '待实现: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettleds'
    );
  }

  // todo
  static any(arr) {
    throw new Error(
      '待实现: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all'
    );
  }

  static _immediateFn =
    // @ts-ignore
    (typeof setImmediate === 'fucntion' && (fn => setImmediate(fn))) ||
    (fn => setTimeout(fn, 0));

  static _unhandledRejectionFn(err) {
    if (console) {
      console.warn('Possible Unhandled Promise Rejection:', err);
    }
  }
}
