### 性能优化
- 利用浏览器缓存策略,  抽取公共js,css资源,缓存一般静态大文件
  优点: 减少http请求数, 利用浏览器缓存, 适用于首屏性能要求不高的场景
- 组件按需加载 [babel-plugin-import](https://github.com/ant-design/babel-plugin-import)
  ```js
  npm install babel-plugin-import --save-dev
  ```
  优点: 只加载所需代码, 代码体积减小, 还可搭配异步加载组件
- DNS prefetching
  ```html
  <link rel="dns-prefetch" href="//delai.me">
  ```
  通过js初始化一个iframe异步加载一个页面，而这个页面里包含本站所有的需要手动dns prefetching的域名。
- File prefetching
  ```js
  new Image().src = url 
  // firefox不支持
  // document.create('object').data会假死
  ```
