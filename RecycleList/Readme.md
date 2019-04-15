# recycle-list

这个组件是根据[react-list](https://github.com/coderiety/react-list)修改为 vue 的简化实现

<b>去除了</b>type = 'simple' | 'uniform'时允许一行有多个元素的支持

<b>去除了</b>initialIndex 的支持

<b>去除了</b>scrollTo 方法的支持

## 原理

通过为显示元素的父元素设置 translate3d，保持视觉定位效果

首次渲染:

1. 当 type 为'simple' | 'variable'时，取 size = this.pageSize, 检测此时渲染列表的位置信息是否满足 threshold 设置，不满足条件时，累加 this.pageSize,直至满足条件或达到 this.length

滚动时:

1. 当已渲染元素的 size + threshold 到达边界时，重新计算 from, size

2. 当到达底部时，会触发<b>loadmore</b>事件

## RecycleList Props

### axis 'x' | 'y' = 'y'

滚动轴

### type 'simple' | 'variable' | 'uniform' = 'simple'

simple '简单模式': 仅懒加载列表
variable '列表可变': item 宽度/高度可变
uniform '列表一致': 各个 item 的 size 一致

### length number = 0

列表长度

### threshold number = 300

滚动视图区域的边界距离 px

### finished boolean = true

是否加载完成 boolean;当未 true 时，不会 emit('loadmore')事件

### pageSize number = 10

以 pageSize 为基准单位，尝试匹配最小的显示列表

## RecycleListMore

是根据业务封装了 loading 之类指示的组件，接收 3 个参数

v-model='value', 告诉组件重新从第一页开始加载

type='uniform', 组件内元素尺寸一般一致

load, 加载函数 ({page, limit}) => ({data: T[]; limit: number; page: number; total: number})

## bugs

todo:

q: 因为 items 的高度/宽度是在 items mounted 的时候计算的，所以若 window.size 发生变化，子元素不能及时改变其 offsetSize
a: this.type !== 'uniform'时将容器高度计算改为最后一个元素的距滚动父容器的距离 + 最后一个元素的 size
