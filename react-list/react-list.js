import PropTypes from 'prop-types';
import React, {Component} from 'react';

const CLIENT_SIZE_KEYS = {x: 'clientWidth', y: 'clientHeight'};
// const CLIENT_START_KEYS = {x: 'clientTop', y: 'clientLeft'}; 个人觉得有误
const CLIENT_START_KEYS = {x: 'clientLeft', y: 'clientTop'};
const INNER_SIZE_KEYS = {x: 'innerWidth', y: 'innerHeight'};
const OFFSET_SIZE_KEYS = {x: 'offsetWidth', y: 'offsetHeight'};
const OFFSET_START_KEYS = {x: 'offsetLeft', y: 'offsetTop'};
const OVERFLOW_KEYS = {x: 'overflowX', y: 'overflowY'};
const SCROLL_SIZE_KEYS = {x: 'scrollWidth', y: 'scrollHeight'};
const SCROLL_START_KEYS = {x: 'scrollLeft', y: 'scrollTop'};
const SIZE_KEYS = {x: 'width', y: 'height'};

const NOOP = () => {};

// If a browser doesn't support the `options` argument to
// add/removeEventListener, we need to check, otherwise we will
// accidentally set `capture` with a truthy value.
const PASSIVE = (() => {
  if (typeof window === 'undefined') return false;
  let hasSupport = false;
  try {
    document.createElement('div').addEventListener('test', NOOP, {
      get passive() {
        hasSupport = true;
        return false;
      }
    });
  } catch (e) {}
  return hasSupport;
})() ? {passive: true} : false;

const UNSTABLE_MESSAGE = 'ReactList failed to reach a stable state.';
const MAX_SYNC_UPDATES = 100;

const isEqualSubset = (a, b) => {
  for (let key in b) if (a[key] !== b[key]) return false;

  return true;
};

const defaultScrollParentGetter = (component) => {
  const {axis} = component.props;
  let el = component.getEl();
  const overflowKey = OVERFLOW_KEYS[axis];
  while (el = el.parentElement) {
    switch (window.getComputedStyle(el)[overflowKey]) {
    case 'auto': case 'scroll': case 'overlay': return el;
    }
  }
  return window;
};

const defaultScrollParentViewportSizeGetter = (component) => {
  const {axis} = component.props;
  const {scrollParent} = component;
  return scrollParent === window ?
    window[INNER_SIZE_KEYS[axis]] :
    scrollParent[CLIENT_SIZE_KEYS[axis]];
};

export default class ReactList extends Component {
  static displayName = 'ReactList';

  static propTypes = {
    axis: PropTypes.oneOf(['x', 'y']),
    initialIndex: PropTypes.number,
    itemRenderer: PropTypes.func,
    itemSizeEstimator: PropTypes.func,
    itemSizeGetter: PropTypes.func,
    itemsRenderer: PropTypes.func,
    length: PropTypes.number,
    minSize: PropTypes.number,
    pageSize: PropTypes.number,
    scrollParentGetter: PropTypes.func,
    scrollParentViewportSizeGetter: PropTypes.func,
    // 可视区缓冲元素所占size
    threshold: PropTypes.number,
    type: PropTypes.oneOf(['simple', 'variable', 'uniform']),
    useStaticSize: PropTypes.bool,
    useTranslate3d: PropTypes.bool
  };

  static defaultProps = {
    axis: 'y',
    itemRenderer: (index, key) => <div key={key}>{index}</div>,
    itemsRenderer: (items, ref) => <div ref={ref} /*style={{padding: '20px'}*/>{items}</div>,
    length: 0,
    minSize: 1,
    pageSize: 10,
    scrollParentGetter: defaultScrollParentGetter,
    scrollParentViewportSizeGetter: defaultScrollParentViewportSizeGetter,
    threshold: 100,
    type: 'simple',
    useStaticSize: false,
    useTranslate3d: false
  };

  constructor(props) {
    super(props);
    const {initialIndex} = props;
    const itemsPerRow = 1;
    const {from, size} = this.constrain(initialIndex, 0, itemsPerRow, props);
    // 仅当type === 'uniform'时,会计算itemsPerRow,其他情况默认为1
    // 仅当type === 'uniform'时,会设置itemSize
    this.state = {from, size, itemsPerRow};
    // 仅在type === 'variable'时，缓存各个元素的offset
    this.cache = {};
    // this.scrollParent[SCROLL_START_KEYS[props.axis]]
    this.cachedScrollPosition = null;
    // 全文中似乎未用到，故注释
    // this.prevPrevState = {};
    // 当type === 'uniform'且各元素宽高不一致时, this.unstable = true
    this.unstable = false;
    this.updateCounter = 0;
  }

  componentWillReceiveProps(next) {
    // Viewport scroll is no longer useful if axis changes
    if (this.props.axis !== next.axis) this.clearSizeCache();
    let {from, size, itemsPerRow} = this.state;
    this.maybeSetState(this.constrain(from, size, itemsPerRow, next), NOOP);
  }

  componentDidMount() {
    this.updateFrameAndClearCache = this.updateFrameAndClearCache.bind(this);
    window.addEventListener('resize', this.updateFrameAndClearCache);
    this.updateFrame(this.scrollTo.bind(this, this.props.initialIndex));
  }

  componentDidUpdate() {

    // If the list has reached an unstable state, prevent an infinite loop.
    if (this.unstable) return;

    if (++this.updateCounter > MAX_SYNC_UPDATES) {
      this.unstable = true;
      return console.error(UNSTABLE_MESSAGE);
    }

    if (!this.updateCounterTimeoutId) {
      this.updateCounterTimeoutId = setTimeout(() => {
        this.updateCounter = 0;
        delete this.updateCounterTimeoutId;
      }, 0);
    }

    this.updateFrame();
  }

  /**
   * @param {Object} b
   * @param {Function} cb
   * @memberof ReactList
   */
  maybeSetState(b, cb) {
    if (isEqualSubset(this.state, b)) return cb();

    this.setState(b, cb);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateFrameAndClearCache);
    this.scrollParent.removeEventListener('scroll', this.updateFrameAndClearCache, PASSIVE);
    this.scrollParent.removeEventListener('mousewheel', NOOP, PASSIVE);
  }

  /**
   * @param {HTMLElement} el 
   * @returns {Number} el.ContentBox距离包含该元素的定位元素或html元素/body元素 this.props.axis方向距离
   * @memberof ReactList
   */
  getOffset(el) {
    const {axis} = this.props;
    let offset = el[CLIENT_START_KEYS[axis]] || 0;
    const offsetKey = OFFSET_START_KEYS[axis];
    do offset += el[offsetKey] || 0; while (el = el.offsetParent);
    return offset;
  }

  /**
   * @returns {HTMLElement} 
   * @memberof ReactList
   * items:包裹着当前显示的元素的容器   
   * el:type不为'simple'时,需要容器撑开高度    
   * 当type === 'simple'时，返回this.items, 其他情况返回this.el
   */
  getEl() {
    return this.el || this.items;
  }

  /**
   * @memberof ReactList
   * @returns {Number} 缓存滚动位置
   */
  getScrollPosition() {
    // Cache scroll position as this causes a forced synchronous layout.
    if (typeof this.cachedScrollPosition === 'number') return this.cachedScrollPosition;
    const {scrollParent} = this;
    const {axis} = this.props;
    const scrollKey = SCROLL_START_KEYS[axis];
    const actual = scrollParent === window ?
      // Firefox always returns document.body[scrollKey] as 0 and Chrome/Safari
      // always return document.documentElement[scrollKey] as 0, so take
      // whichever has a value.
      document.body[scrollKey] || document.documentElement[scrollKey] :
      scrollParent[scrollKey];
    // ContentBox最大可滚动距离，scrollHeight - clientHeight
    const max = this.getScrollSize() - this.props.scrollParentViewportSizeGetter(this);
    const scroll = Math.max(0, Math.min(actual, max));
    const el = this.getEl();
    // 消除scrollParent非Content-Box区域宽高的影响
    this.cachedScrollPosition = this.getOffset(scrollParent) + scroll - this.getOffset(el);
    return this.cachedScrollPosition;
  }

  /**
   * @memberof ReactList
   * @param {Number} offset 
   * 消除this.el或this.items可能会有边框，内边距带来的影响，
   * 设置父滚动容器的scroll[Top|Left]
   */
  setScroll(offset) {
    const {scrollParent} = this;
    const {axis} = this.props;
    offset += this.getOffset(this.getEl());
    if (scrollParent === window) return window.scrollTo(0, offset);

    offset -= this.getOffset(this.scrollParent);
    scrollParent[SCROLL_START_KEYS[axis]] = offset;
  }

  /**
   * @memberof ReactList
   * @returns {Number}
   * 滚动父容器的scrollSize
   */
  getScrollSize() {
    const {scrollParent} = this;
    const {body, documentElement} = document;
    const key = SCROLL_SIZE_KEYS[this.props.axis];
    return scrollParent === window ?
      Math.max(body[key], documentElement[key]) :
      scrollParent[key];
  }

  /**
   * @memberof ReactList
   * @returns {Boolean}
   * itemSize是否预先确定
   */
  hasDeterminateSize() {
    const {itemSizeGetter, type} = this.props;
    return type === 'uniform' || itemSizeGetter;
  }

  /**
   * @memberof ReactList
   * @param {Number} threshold 
   * @returns {{start, end}}
   * 根据预设边界值和当前滚动位置信息，确定需要在scrollParent的Content-Box区域渲染的起止位置信息
   */
  getStartAndEnd(threshold = this.props.threshold) {
    const scroll = this.getScrollPosition();
    const start = Math.max(0, scroll - threshold);
    let end = scroll + this.props.scrollParentViewportSizeGetter(this) + threshold;
    if (this.hasDeterminateSize()) {
      end = Math.min(end, this.getSpaceBefore(this.props.length));
    }
    return {start, end};
  }

  
  /**
   * @memberof ReactList
   * 仅type === 'uniform'时使用
   * @returns {{itemSize, itemsPerRow}}
   */
  getItemSizeAndItemsPerRow() {
    const {axis, useStaticSize} = this.props;
    let {itemSize, itemsPerRow} = this.state;
    if (useStaticSize && itemSize && itemsPerRow) {
      return {itemSize, itemsPerRow};
    }

    const itemEls = this.items.children;
    if (!itemEls.length) return {};

    const firstEl = itemEls[0];

    // Firefox has a problem where it will return a *slightly* (less than
    // thousandths of a pixel) different size for the same element between
    // renders. This can cause an infinite render loop, so only change the
    // itemSize when it is significantly different.
    const firstElSize = firstEl[OFFSET_SIZE_KEYS[axis]];
    const delta = Math.abs(firstElSize - itemSize);
    if (isNaN(delta) || delta >= 1) itemSize = firstElSize;

    if (!itemSize) return {};

    const startKey = OFFSET_START_KEYS[axis];
    const firstStart = firstEl[startKey];
    itemsPerRow = 1;
    for (
      let item = itemEls[itemsPerRow];
      item && item[startKey] === firstStart;
      item = itemEls[itemsPerRow]
    ) ++itemsPerRow;

    return {itemSize, itemsPerRow};
  }

  clearSizeCache() {
    this.cachedScrollPosition = null;
  }

  // Called by 'scroll' and 'resize' events, clears scroll position cache.
  updateFrameAndClearCache(cb) {
    this.clearSizeCache();
    return this.updateFrame(cb);
  }

  
  updateFrame(cb) {
    this.updateScrollParent();
    if (typeof cb != 'function') cb = NOOP;
    switch (this.props.type) {
    case 'simple': return this.updateSimpleFrame(cb);
    case 'variable': return this.updateVariableFrame(cb);
    case 'uniform': return this.updateUniformFrame(cb);
    }
  }

  
  /**
   * @memberof ReactList
   * set this.scrollParent and update related eventlisteners
   */
  updateScrollParent() {
    const prev = this.scrollParent;
    this.scrollParent = this.props.scrollParentGetter(this);
    if (prev === this.scrollParent) return;
    if (prev) {
      prev.removeEventListener('scroll', this.updateFrameAndClearCache);
      prev.removeEventListener('mousewheel', NOOP);
    }
    // If we have a new parent, cached parent dimensions are no longer useful.
    this.clearSizeCache();
    this.scrollParent.addEventListener('scroll', this.updateFrameAndClearCache, PASSIVE);
    // You have to attach mousewheel listener to the scrollable element.
    // Just an empty listener. After that onscroll events will be fired synchronously.
    this.scrollParent.addEventListener('mousewheel', NOOP, PASSIVE);
  }

  updateSimpleFrame(cb) {
    const {end} = this.getStartAndEnd();
    const itemEls = this.items.children;
    let elEnd = 0;

    if (itemEls.length) {
      const {axis} = this.props;
      const firstItemEl = itemEls[0];
      const lastItemEl = itemEls[itemEls.length - 1];
      elEnd = this.getOffset(lastItemEl) + lastItemEl[OFFSET_SIZE_KEYS[axis]] -
        this.getOffset(firstItemEl);
    }

    if (elEnd > end) return cb();

    const {pageSize, length} = this.props;
    const size = Math.min(this.state.size + pageSize, length);
    this.maybeSetState({size}, cb);
  }

  updateVariableFrame(cb) {
    if (!this.props.itemSizeGetter) this.cacheSizes();

    const {start, end} = this.getStartAndEnd();
    const {length, pageSize} = this.props;
    let space = 0;
    let from = 0;
    let size = 0;
    const maxFrom = length - 1;
    // 确认from
    while (from < maxFrom) {
      const itemSize = this.getSizeOfItem(from);
      if (itemSize == null || space + itemSize > start) break;
      space += itemSize;
      ++from;
    }

    const maxSize = length - from;
    // 确认size
    while (size < maxSize && space < end) {
      const itemSize = this.getSizeOfItem(from + size);
      if (itemSize == null) {
        size = Math.min(size + pageSize, maxSize);
        break;
      }
      space += itemSize;
      ++size;
    }

    this.maybeSetState({from, size}, cb);
  }

  updateUniformFrame(cb) {
    let {itemSize, itemsPerRow} = this.getItemSizeAndItemsPerRow();

    if (!itemSize || !itemsPerRow) return cb();

    const {start, end} = this.getStartAndEnd();

    const {from, size} = this.constrain(
      Math.floor(start / itemSize) * itemsPerRow,
      (Math.ceil((end - start) / itemSize) + 1) * itemsPerRow,
      itemsPerRow,
      this.props
    );

    return this.maybeSetState({itemsPerRow, from, itemSize, size}, cb);
  }

  /**
   * @memberof ReactList
   * @param {Number} index 
   * @param {Object} cache 
   * @returns {Number} 返回index之前元素的offset[Height|Width]之和
   */
  getSpaceBefore(index, cache = {}) {
    if (cache[index] != null) return cache[index];

    // Try the static itemSize.
    const {itemSize, itemsPerRow} = this.state;
    if (itemSize) {
      return cache[index] = Math.floor(index / itemsPerRow) * itemSize;
    }

    // Find the closest space to index there is a cached value for.
    let from = index;
    while (from > 0 && cache[--from] == null);

    // Finally, accumulate sizes of items from - index.
    let space = cache[from] || 0;
    for (let i = from; i < index; ++i) {
      cache[i] = space;
      const itemSize = this.getSizeOfItem(i);
      if (itemSize == null) break;
      space += itemSize;
    }

    return cache[index] = space;
  }

  /**
   * @memberof ReactList
   * @returns {void}
   * 遍历this.items的子元素，缓存offsetHeight/offsetWidth到this.cache
   * 通常，元素的offsetHeight是一种元素CSS高度的衡量标准，包括元素的边框、内边距和元素的水平滚动条（如果存在且渲染的话），
   * 不包含:before或:after等伪类元素的高度。会被四舍五入为一个整数
   */
  cacheSizes() {
    const {cache} = this;
    const {from} = this.state;
    const itemEls = this.items.children;
    const sizeKey = OFFSET_SIZE_KEYS[this.props.axis];
    for (let i = 0, l = itemEls.length; i < l; ++i) {
      cache[from + i] = itemEls[i][sizeKey];
    }
  }

  /**
   * @memberof ReactList
   * @param {Number} index 
   * @returns { Number } index元素的size || undefined
   * 若type === 'uniform'，尝试读取this.state.itemSize
   * 若this.props.itemSizeGetter存在, 尝试执行
   * 若this.cache中已存在，从this.cache中读取
   * 若type === 'simple',且index在items内，获取dom元素offsetSize
   * 若this.props.itemSizeEstimator存在， 尝试执行
   */
  getSizeOfItem(index) {
    const {cache, items} = this;
    const {axis, itemSizeGetter, itemSizeEstimator, type} = this.props;
    const {from, itemSize, size} = this.state;

    // Try the static itemSize.
    if (itemSize) return itemSize;

    // Try the itemSizeGetter.
    if (itemSizeGetter) return itemSizeGetter(index);

    // Try the cache.
    if (index in cache) return cache[index];

    // Try the DOM.
    if (type === 'simple' && index >= from && index < from + size && items) {
      const itemEl = items.children[index - from];
      if (itemEl) return itemEl[OFFSET_SIZE_KEYS[axis]];
    }

    // Try the itemSizeEstimator.
    if (itemSizeEstimator) return itemSizeEstimator(index, cache);
  }

  /**
   * @memberof ReactList
   * @param {Number} from
   * @param {Number} size
   * @param {Number} itemsPerRow
   * @param {Object} {length, minSize, type} 来源于props
   * @returns {{from, size}} 需要渲染的元素from(index)及size
   */
  constrain(from, size, itemsPerRow, {length, minSize, type}) {
    size = Math.max(size, minSize);
    let mod = size % itemsPerRow;
    if (mod) size += itemsPerRow - mod;
    if (size > length) size = length;
    from =
      type === 'simple' || !from ? 0 :
      Math.max(Math.min(from, length - size), 0);

    if (mod = from % itemsPerRow) {
      from -= mod;
      size += mod;
    }

    return {from, size};
  }

  
  /**
   * @param {Number} index
   * @memberof ReactList
   * 若index为未显示过的元素索引，只会尽量滚动到底部
   */
  scrollTo(index) {
    if (index != null) this.setScroll(this.getSpaceBefore(index));
  }


  /**
   * @param {Number} index
   * @returns
   * @memberof ReactList
   * 若index为未显示过的元素索引，无反应
   */
  scrollAround(index) {
    const current = this.getScrollPosition();
    const bottom = this.getSpaceBefore(index);
    const top = bottom - this.props.scrollParentViewportSizeGetter(this) + this.getSizeOfItem(index);
    const min = Math.min(top, bottom);
    const max = Math.max(top, bottom);
    if (current <= min) return this.setScroll(min);
    if (current > max) return this.setScroll(max);
  }

  getVisibleRange() {
    const {from, size} = this.state;
    const {start, end} = this.getStartAndEnd(0);
    const cache = {};
    let first, last;
    for (let i = from; i < from + size; ++i) {
      const itemStart = this.getSpaceBefore(i, cache);
      const itemEnd = itemStart + this.getSizeOfItem(i);
      if (first == null && itemEnd > start) first = i;
      if (first != null && itemStart < end) last = i;
    }
    return [first, last];
  }

  renderItems() {
    const {itemRenderer, itemsRenderer} = this.props;
    const {from, size} = this.state;
    const items = [];
    for (let i = 0; i < size; ++i) items.push(itemRenderer(from + i, i));
    return itemsRenderer(items, c => this.items = c);
  }

  render() {
    const {axis, length, type, useTranslate3d} = this.props;
    const {from, itemsPerRow} = this.state;

    const items = this.renderItems();
    if (type === 'simple') return items;

    const style = {position: 'relative'};
    const cache = {};
    const bottom = Math.ceil(length / itemsPerRow) * itemsPerRow;
    // 作用于this.el上,撑开真实高度
    const size = this.getSpaceBefore(bottom, cache);
    if (size) {
      style[SIZE_KEYS[axis]] = size;
      if (axis === 'x') style.overflowX = 'hidden';
    }
    // 作用于this.items上，from之前的don元素被移除，通过tranform:translate(?:3d)?
    // 调整this.items的位置，使其出现在合适的位置
    const offset = this.getSpaceBefore(from, cache);
    const x = axis === 'x' ? offset : 0;
    const y = axis === 'y' ? offset : 0;
    const transform =
      useTranslate3d ?
      `translate3d(${x}px, ${y}px, 0)` :
      `translate(${x}px, ${y}px)`;
    const listStyle = {
      msTransform: transform,
      WebkitTransform: transform,
      transform
    };
    return (
      <div style={style} ref={c => this.el = c}>
        <div style={listStyle}>{items}</div>
      </div>
    );
  }
};