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

[nginx配置](https://www.cnblogs.com/zhouxinfei/p/7862285.html)

## vue-router history mode

后端放弃路由控制权限,在服务端如果url匹配不到任何静态资源,应返回同一个index.html文件,然后vue-router通过分析路径,确定路由,展示相应的页面

vue-cli默认config.build.assetsPublicPath为'/',适用于history模式,通过起本地代理服务器启动访问

[vue-router HTML5 History 模式](https://router.vuejs.org/zh-cn/essentials/history-mode.html)

当为router为hash模式时,config.build.assetsPublicPath改为'./',避免文件内资源路径引用的问题

[从vue-router看两种路由模式](https://zhuanlan.zhihu.com/p/27588422)
