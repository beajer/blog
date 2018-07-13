import compose from './compose'

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args)
    // _dispatch
    let dispatch = () => {
      throw new Error(
        `Dispatching while constructing your middleware is not allowed. ` +
          `Other middleware would not be applied to this dispatch.`
      )
    }

    const middlewareAPI = {
      getState: store.getState,
      /*
      * 这个会转化为_dispatch.apply(undefined, arguments);
      */
      dispatch: (...args) => dispatch(...args)

    }
    
    const chain = middlewares.map(middleware => middleware(middlewareAPI))
    // _dispatch
    dispatch = compose(...chain)(store.dispatch)
    /* 
    * 让middlewareAPI保持的是对_dispatch函数的借用。
    * 在初次构造时，禁止middleware使用dispatch，
    * 构造完成后，调用链中最后一个 middleware 会接受真实的 store 的 dispatch 方法作为 next 参数，并借此结束调用链。
    * 此时middlrewares从右至左，返回一个Dispatch函数,compose(a,b,c,d)(store.dispatch) = > a(b(c(d(store,dispatch))))
    * 最终a接收的仍是dispatch函数， 并作为a的next参数，调用next(action)时， 即调用下一个middleware(b)
    * 恢复_dispatch为组合后的high-order-dispatch，而middlrewareAPI.dispatch, store.dispatch都是调用_dispatch
    * 这就是文档中提到的用了一个非常巧妙的方式，
    * 以确保如果你在 middleware 中调用的是 store.dispatch(action) 而不是 next(action)，
    * 那么这个操作会再次遍历包含当前 middleware 在内的整个 middleware 链。
    */
    return {
      ...store,
      // dispatch: _dispatch
      dispatch
    }
  }
}
/*
* type BaseDispatch = (a: Action) => Action
* type Dispatch = (a: Action | AsyncAction) => any
* type MiddlewareAPI = { dispatch: Dispatch, getState: () => State }
* type Middleware = (api: MiddlewareAPI) => (next: Dispatch) => Dispatch
*/