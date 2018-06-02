- store 
- state
- action
- action-creator
- dispatch
- reducer
- pure function
- store.subscribe

[redux flow](http://www.ruanyifeng.com/blogimg/asset/2016/bg2016091802.jpg)
```
store = createStore(reducer)
store : {
	getState,
	dispatch,
	subscribe
}
fx(state) = view
	fx = state ---> view
		   ^
		   |(getState)
		   |
		 store

fy(view) = state
	       (dispatch)  (reducer)   (subscribe)
	fy = view ---> action ---> state  ---> callback
			^
			|
		action-creator
```
