## [ios下,当页面过长, 返回上一个页面时, 会白屏](https://github.com/vuejs/vue/issues/7229)

在ios11.0.3下的safiri浏览器调试过程中,逐渐发现页面滚动到一定高度, 进入下一个页面.
此时,若页面scrollTop为0,返回后,页面在绘制一遍后,白屏,但依然可以点击; 若页面scrollTop > 0, 返回后, 不白屏.

这个问题先在react移动端项目下遇见,最终在vue issues里看到答案,只加了几行css.

这个问题难在,一开始只想着会是js的问题,而忽略了css.虽然解决答案很简单,但从中也发现了很多问题.


```css
html, body {  
  position: relative;
  height: 100%;
}  
#app {  
  width: 100%;  
  height: 100%;
  position: absolute;  
  overflow: scroll;
  // 滑动顺畅一点..
  -webkit-overflow-scrolling: touch;
}
```
html，body都是100%，#app撑起了父元素的告诉，但是浏览器默认的滚动scroll并不是#app，而是body,某些因素，造成返回history 后，无法复原（ios 的锅），为此，我们将#app 进行了绝对定位，并让它重新成为 scroll 的对象，从而解决问题.

然而又引发了新的问题,当使用系统原生的滑动,在页面顶部上拉,不放开, 下拉, 页面会被截断成一个屏幕的高度.