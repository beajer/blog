vue-router
mode-hash{
	onhashchange
	<a href>属性改变url的hash,可以检测
}
mode-history{
	调用history api
	history.go, history.back, history.forward
	history.pushState, history.replaceState, history.popState,
	页面状态保存于state对象中
	此时的<a href>会去请求服务器,重置vuex内保存变量
}