对[react-list](https://github.com/coderiety/react-list)个人理解

## 涉及到的width,height概念，width与height基本差不多,只以width相关说明

### window上只有window.innerWidth,window.outerWidth,以及window.screen里一些信息
- window.innerWidth:\
  浏览网页窗口的尺寸
- window.outerWidth:\
  浏览器的尺寸

### element
- element.getBoundingClientRect()
  ```js
  top, right, bottom, left: 元素border相对视窗左上角的位置信息
  height: bottom - top
  width: right - left
  x: left
  y: top
  ```
- element.clientWidth (int):
  ```js
  元素的内部宽度,
  包含['padding', '::before', '::after'],
  不包含['scrollbar', 'border','margin']
  ```
- element.clientTop (int):
  ```js
  parseInt(getComputedSytle(element)['border-top-width'])
  ```
- element.clientLeft (int):
  ```js
  parseInt(getComputedSytle(element)['border-left-width'])
  ```
- element.scrollHeight (int):
  ```js
  元素在不使用滚动条的情况下为了适应视口中所用内容所需的最小高度,
  包含['padding', '::before', '::after'],
  不包含['scrollbar', 'border','margin']
  ```
- element.offsetWidth (int):
  ```js
  元素所占尺寸
  包含['::before', '::after', 'padding', 'scrollbar', 'border'],
  不包含['margin']
  ```

### 技巧
```js
// 判断某个元素是否滑动到底部
element.scrollHeight - element.scrollTop === element.clientHeight
```