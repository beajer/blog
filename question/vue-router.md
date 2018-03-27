## vue-router
---
### mode-hash
onhashchange事件\
*a href*属性里改变url的hash时,可以检测

### mode-history
调用history相关api\
- history.go 
- history.back
- history.forward
- history.pushState
- history.replaceState
- history.popState


页面状态保存于state对象中,通过对url的改变\
此时的*a href*或 *f5*会去请求服务器,重置vuex内保存变量

今天遇到的问题,vue-router为history-mode,build文件后不能直接访问index.html,通过nginx配置server, root指向打包后路径, 配置location路由后,通过server_name值访问, 可以配合修改hosts文件,自定义域名,但是注意浏览器的DNS缓存.