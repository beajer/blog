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
 * 返回一个高阶函数， createStore => createStore => store,
 * 通过这种方式返回新的store(.dispatch)，同时保留原始的store.dispatch作为middleware中的next参数
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

    // 只允许middleware使用store.getState 和 store.dispath
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
    * 在初次构造时，依次对每个middleware先行绑定store参数(middlewareAPI),但此时禁止middleware使用dispatch
    * 构造完成后，此时middlrewares从右至左，compose(a,b,c,d)(store.dispatch) = > a(b(c(d(store.dispatch))))
    * middlewareAPI.dispatch 变成整个 middleware 链的 dispatch 的函数
    * 此时的每一个 middleware 都是 dispatch 高阶函数,接收 Dispatch 返回一个 新的 Dispatch 函数
    * 调用链中最后一个 middleware 将会接受原始的 store.dispatch 方法作为 next 参数，并借此结束调用链。
    * 每个middleware此时将能选择
    *   1.调用 next(初始的基础的store.dispatch) ， 生产一个新的 Dispatch函数， 并串行调用下一个middleware
    *   2.调用 middlewareApi.dispatch 或 store.dispath 重新遍历整个middleware链
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
* type Middleware = (api: MiddlewareAPI) => (next: BaseDispatch) => Action => State
* type applyMiddleware = Array<Middleware> => createStore => createStore => store
*/