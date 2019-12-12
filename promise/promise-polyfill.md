1. promise.prototype.finally 方法\
    1. 由于不知道 promise 的最终状态，所以其回调函数不接受任何参数。
    2. 其回调函数正常返回，则会传递前一个 promise 的值，返回 fullfilled 的 promise 。
    3. 其回调函数扔出错误，则会传递当前错误，返回 rejected 的 promise 。
2. Promise 构造函数
    1. 必须由 new 关键字生成。
    2. 状态只能由pending -> fullfilled | rejected传递，同时其 onFullfillment | onRejection只会执行其中一个。
    3. 当 promise 处于 resolved 状态时，根据其状态，依次执行该 promise 所有的 onFullfilled 或 onRejected 回调函数。
    4. 当 promise 为 rejected 状态， 且没有注册 onRejection函数时，调用当前环境接口，打印错误。