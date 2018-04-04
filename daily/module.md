# 从迭代开发旧的项目中所思

### h5: vue -> react
中途加入现有项目的移动端部分,暂时使用的vue,但在未来会用react重写.\
在现有的vue业务代码中,奇怪的发现,几乎vue文件内并未使用computed,watch属性.\
唯一大量使用了computed的场景是利用了vuex的...mapGetters,并没有很好的利用vue提供的computed和watch,在大量的methods里手动改变数据,没能让数据间进行自动计算,使得框架优势并没有发挥出来\

### pc: gulp + tmodejs + require.js + sass
pc端的项目一直处处停停走走的状态,一段时间因为某些因素,pc端暂停,近期开始继续进行.\
由于兼容性的要求,项目通过gulp进行项目的打包和结构整理.\
.前端模板采用art-template,并用tmodjs预编译成js文件,通过require.js进行模块化管理.\
通过sass(ruby环境)监听scss文件变化生成css.\
搭配nginx调试.\
对dom的操作,大量事件委托和事件绑定依赖jquery选择器.\
有些文件依赖众多,长长的一串依赖写在一个数组里,找到对应的回调函数的参数时,只能让人感概电脑屏幕宽度不够.\
#### 所以
vue ,react为
1. css的模块化管理
1. 将数据细粒与页面dom对应
2. vdom及相关diff避免不需要更新的dom被替换,提升性能,同时抽象组件的使用,适配更多平台

webpack
1. 文件依赖的管理打包
2. 热更新
3. 丰富的插件
4. 配置开发环境和生产环境
    
### back: angular
angular确实很重,暂时没接触.