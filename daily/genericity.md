# typescript genericity ts中的泛型

## 定义： 
参数化类型，指定一个表示类型的变量，用它来代替某个实际的类型用于编程，而后通过实际调用时传入或推导的类型来对其进行替换，以达到一段使用泛型程序可以实际适应不同类型的目的。

## 用法：
1. 【泛型函数】 指明参数类型，返回类型与参数类型有关
2. 【泛型类 】 声明类,容器类的时候声明泛型，在类的整个作用域范围内都可以使用声明的泛型类型
```ts
典型如Array<T>, Promise<T>
```
3. 【泛型约束】 
```ts
// Child 继承 Parent 原型上的变量
class Child extends Parent
// Child 实现Ichild接口
class Child implements IChild
```

# react, vue
React中，当某组件的状态发生改变时，它会以该组件为根，重新渲染整个组件子树。可以用React.PureComponent、手动写shouldComponentUpdate避免不必要的更新。React.memo(fn)缓存无状态组件，对于相同的props，跳过render阶段，重用上次的render结果。

而在Vue中，组件的依赖是在渲染的过程中自动追踪的，所以系统能准确知晓哪个组件确实需要被重新渲染。2，Vue的路由库和状态管理库都由官方维护支持且与核心库同步更新，而React选择把这些问题交给社区维护，因此生态更丰富。3，Vue-cli脚手架可进行配置

写法上，react以函数为主，vue以配置对象为主

react的一些操作子组件的方法React.cloneElment, React.Children， React.Fragment方法比较好用，vue暂时缺失。

# react fiber
存有当前实例，父节点，子节点，兄弟节点的数据结构，从树末尾开始，将渲染任务拆分，分割，在浏览器空闲时间(requestIdleCallback | requestAnimationFrame)执行，使ui更新任务能停止和重启，避免长时间阻塞，页面卡顿等。

# react hooks
在函数式组件中使用React特性，