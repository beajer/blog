<template>
  <div></div>
</template>

<script>
import Vue from "vue";
const CLIENT_SIZE_KEYS = { x: "clientWidth", y: "clientHeight" };
const CLIENT_START_KEYS = { x: "clientLeft", y: "clientTop" };
const INNER_SIZE_KEYS = { x: "innerWidth", y: "innerHeight" };
const OFFSET_SIZE_KEYS = { x: "offsetWidth", y: "offsetHeight" };
const OFFSET_START_KEYS = { x: "offsetLeft", y: "offsetTop" };
const OVERFLOW_KEYS = { x: "overflowX", y: "overflowY" };
const SCROLL_SIZE_KEYS = { x: "scrollWidth", y: "scrollHeight" };
const SCROLL_START_KEYS = { x: "scrollLeft", y: "scrollTop" };
const SIZE_KEYS = { x: "width", y: "height" };

const NOOP = () => {};

// If a browser doesn't support the `options` argument to
// add/removeEventListener, we need to check, otherwise we will
// accidentally set `capture` with a truthy value.
// 使用passive改善滚屏性能
const PASSIVE = (() => {
  if (typeof window === "undefined") return false;
  let hasSupport = false;
  try {
    document.createElement("div").addEventListener("test", NOOP, {
      get passive() {
        hasSupport = true;
        return false;
      }
    });
  } catch (e) {}
  return hasSupport;
})()
  ? { passive: true }
  : false;

const UNSTABLE_MESSAGE = "ReactList failed to reach a stable state.";
const MAX_SYNC_UPDATES = 100;

const defaultScrollParentGetter = component => {
  const { axis } = component.$props;
  let el = component.getEl();
  const overflowKey = OVERFLOW_KEYS[axis];
  while ((el = el.parentElement)) {
    switch (window.getComputedStyle(el)[overflowKey]) {
      case "auto":
      case "scroll":
      case "overlay":
        return el;
    }
  }
  return window;
};

const defaultScrollParentViewportSizeGetter = component => {
  const { axis, scrollParent } = component;
  return scrollParent === window
    ? window[INNER_SIZE_KEYS[axis]]
    : scrollParent[CLIENT_SIZE_KEYS[axis]];
};

export default {
  prpos: {
    axis: {
      validator: v => ["x", "y"].indexOf(v) !== -1
    },
    initialIndex: Number,
    itemRenderer: Vue,
    itemsRenderer: Vue,
    itemSizeEstimator: Function,
    itemSizeGetter: Function,
    length: {
      type: Number,
      default: 0
    },
    minSize: {
      type: Number,
      default: 1
    },
    pageSize: {
      type: Number,
      default: 10
    },
    scrollParentGetter: {
      type: Function,
      default: defaultScrollParentGetter
    },
    scrollParentViewportSizeGetter: {
      type: Function,
      default: defaultScrollParentViewportSizeGetter
    },
    threshold: {
      type: Number,
      default: 100
    },
    type: {
      type: String,
      validator: v => ["simple", "variable", "uniform"].indexOf(v) !== -1
    },
    useStaticSize: {
      type: Boolean,
      default: false
    },
    useTranslate3d: {
      type: Boolean,
      default: false
    }
  },
  data() {
    const itemsPerRow = 1;
    const { from, size } = this.constrain(this.initialIndex, 0, itemsPerRow);
    return {
      from,
      size,
      itemsPerRow
    };
  },
  watch: {
    axis(n, o) {
      if (n !== o) {
        this.clearSizeCache();
      }
    }
  },
  methods: {
    getOffset(el) {
      const axis = this.axis;
      // 用clientTop/left可能是因为items不支持margin属性，便于用transparent border模拟
      let offset = el[CLIENT_START_KEYS[axis]] || 0;
      const offsetKey = OFFSET_START_KEYS[axis];
      do offset += el[offsetKey] || 0;
      while ((el = el.offsetParent));
      return offset;
    },
    getEl() {
      return this.$el;
    },
    getScrollPosition() {
      // Cache scroll position as this causes a forced synchronous layout.
      if (typeof this.cachedScrollPosition === "number")
        return this.cachedScrollPosition;
      const { scrollParent } = this;
      const axis = this.axis;
      const scrollKey = SCROLL_START_KEYS[axis];
      const actual =
        scrollParent === window
          ? // Firefox always returns document.body[scrollKey] as 0 and Chrome/Safari
            // always return document.documentElement[scrollKey] as 0, so take
            // whichever has a value.
            document.body[scrollKey] || document.documentElement[scrollKey]
          : scrollParent[scrollKey];
      // ContentBox最大可滚动距离，scrollParent.scrollHeight - scrollParent.clientHeight
      const max =
        this.getScrollSize() - this.scrollParentViewportSizeGetter(this);
      // TO DO: 什么情况下actual会大于max?
      const scroll = Math.max(0, Math.min(actual, max));
      const el = this.getEl();
      // 消除scrollParent非Padding-Box区域宽高的影响
      this.cachedScrollPosition =
        this.getOffset(scrollParent) + scroll - this.getOffset(el);
      return this.cachedScrollPosition;
    },
    setScroll(offset) {
      const { scrollParent, axis } = this;
      offset += this.getOffset(this.getEl());
      if (scrollParent === window) return window.scrollTo(0, offset);
      offset -= this.getOffset(this.scrollParent);
      scrollParent[SCROLL_START_KEYS[axis]] = offset;
    },
    getScrollSize() {
      const { scrollParent } = this;
      const { body, documentElement } = document;
      const key = SCROLL_SIZE_KEYS[this.props.axis];
      return scrollParent === window
        ? Math.max(body[key], documentElement[key])
        : scrollParent[key];
    },
    hasDeterminateSize() {
      const { itemSizeGetter, type } = this;
      return type === "uniform" || itemSizeGetter;
    },
    getStartAndEnd(threshold = this.threshold) {
      const scroll = this.getScrollPosition();
      const start = Math.max(0, scroll - threshold);
      let end =
        scroll + this.props.scrollParentViewportSizeGetter(this) + threshold;
      if (this.hasDeterminateSize()) {
        end = Math.min(end, this.getSpaceBefore(this.props.length));
      }
      return { start, end };
    },
    getItemSizeAndItemsPerRow() {
      const { axis, useStaticSize, itemSize, itemsPerRow } = this;
      if (useStaticSize && itemSize && itemsPerRow) {
        return { itemSize, itemsPerRow };
      }

      const itemEls = this.$children;
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
      )
        ++itemsPerRow;

      return { itemSize, itemsPerRow };
    },
    clearSizeCache() {
      this.cachedScrollPosition = null;
    },
    updateFrameAndClearCache(cb) {
      this.clearSizeCache();
      return this.updateFrame(cb);
    },
    updateFrame(cb) {
      this.updateScrollParent();
      if (typeof cb != "function") cb = NOOP;
      switch (this.type) {
        case "simple":
          return this.updateSimpleFrame(cb);
        case "variable":
          return this.updateVariableFrame(cb);
        case "uniform":
          return this.updateUniformFrame(cb);
      }
    },
    updateScrollParent() {
      const prev = this.scrollParent;
      this.scrollParent = this.scrollParentGetter(this);
      if (prev === this.scrollParent) return;
      if (prev) {
        prev.removeEventListener("scroll", this.updateFrameAndClearCache);
        prev.removeEventListener("mousewheel", NOOP);
      }
      // If we have a new parent, cached parent dimensions are no longer useful.
      this.clearSizeCache();
      this.scrollParent.addEventListener(
        "scroll",
        this.updateFrameAndClearCache,
        PASSIVE
      );
      // You have to attach mousewheel listener to the scrollable element.
      // Just an empty listener. After that onscroll events will be fired synchronously.
      this.scrollParent.addEventListener("mousewheel", NOOP, PASSIVE);
    },
    updateSimpleFrame(cb) {
      const { end } = this.getStartAndEnd();
      const itemEls = this.items.$children;
      let elEnd = 0;

      if (itemEls.length) {
        const { axis } = this;
        const firstItemEl = itemEls[0];
        const lastItemEl = itemEls[itemEls.length - 1];
        elEnd =
          this.getOffset(lastItemEl) +
          lastItemEl[OFFSET_SIZE_KEYS[axis]] -
          this.getOffset(firstItemEl);
      }

      if (elEnd > end) return cb();

      const { pageSize, length } = this;
      this.size = Math.min(this.size + pageSize, length);
      cb && cb();
    },

    updateVariableFrame(cb) {
      if (!this.itemSizeGetter) this.cacheSizes();

      const { start, end } = this.getStartAndEnd();
      const { length, pageSize } = this;
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
      this.from = from;
      this.size = size;
      cb && cb();
    },

    updateUniformFrame(cb) {
      let { itemSize, itemsPerRow } = this.getItemSizeAndItemsPerRow();

      if (!itemSize || !itemsPerRow) return cb();

      const { start, end } = this.getStartAndEnd();

      const { from, size } = this.constrain(
        Math.floor(start / itemSize) * itemsPerRow,
        (Math.ceil((end - start) / itemSize) + 1) * itemsPerRow,
        itemsPerRow,
        this.props
      );
      this.itemsPerRow = itemsPerRow;
      this.from = from;
      this.itemSize = itemSize;
      this.size = size;
      cb && cb();
    },
    getSpaceBefore(index, cache = {}) {
      if (cache[index] != null) return cache[index];
      const { itemSize, itemsPerRow } = this;
      if (itemSize) {
        return (cache[index] = Math.floor(index / itemsPerRow) * itemSize);
      }
      let from = index;
      while (from > 0 && cache[--from] == null);
      let space = cache[from] || 0;
      for (let i = from; i < index; ++i) {
        cache[i] = space;
        const itemSize = this.getSizeOfItem(i);
        if (itemSize == null) break;
        space += itemSize;
      }
      return (cache[index] = space);
    },
    cacheSizes() {
      const { cache, from } = this;
      const itemEls = this.items.children;
      const sizeKey = OFFSET_SIZE_KEYS[this.props.axis];
      for (let i = 0, l = itemEls.length; i < l; ++i) {
        cache[from + i] = itemEls[i][sizeKey];
      }
    },
    getSizeOfItem(index) {
      const {
        cache,
        items,
        axis,
        itemSizeGetter,
        itemSizeEstimator,
        type,
        from,
        itemSize,
        size
      } = this;
      // Try the static itemSize.
      if (itemSize) return itemSize;

      // Try the itemSizeGetter.
      if (itemSizeGetter) return itemSizeGetter(index);

      // Try the cache.
      if (index in cache) return cache[index];

      // Try the DOM.
      if (type === "simple" && index >= from && index < from + size && items) {
        const itemEl = items.children[index - from];
        if (itemEl) return itemEl[OFFSET_SIZE_KEYS[axis]];
      }

      // Try the itemSizeEstimator.
      if (itemSizeEstimator) return itemSizeEstimator(index, cache);
    },
    constrain() {
      let { from, size, itemsPerRow, length, minSize, type } = this;
      size = Math.max(size, minSize);
      let mod = size % itemsPerRow;
      if (mod) size += itemsPerRow - mod;
      if (size > length) size = length;
      from =
        type === "simple" || !from
          ? 0
          : Math.max(Math.min(from, length - size), 0);

      // 如果from不位于当行首位，则对from,size进行补全
      if ((mod = from % itemsPerRow)) {
        from -= mod;
        size += mod;
      }

      return { from, size };
    },
    scrollTo(index) {
      if (index != null) this.setScroll(this.getSpaceBefore(index));
    },
    scrollAround(index) {
      const current = this.getScrollPosition();
      const bottom = this.getSpaceBefore(index);
      const top =
        bottom -
        this.scrollParentViewportSizeGetter(this) +
        this.getSizeOfItem(index);
      const min = Math.min(top, bottom);
      const max = Math.max(top, bottom);
      if (current <= min) return this.setScroll(min);
      if (current > max) return this.setScroll(max);
    },
    getVisibleRange() {
      const { from, size } = this;
      const { start, end } = this.getStartAndEnd(0);
      const cache = {};
      let first, last;
      for (let i = from; i < from + size; ++i) {
        const itemStart = this.getSpaceBefore(i, cache);
        const itemEnd = itemStart + this.getSizeOfItem(i);
        if (first == null && itemEnd > start) first = i;
        if (first != null && itemStart < end) last = i;
      }
      return [first, last];
    },
    renderItems() {
      const { itemRenderer, itemsRenderer, from, size } = this;
      const items = [];
      for (let i = 0; i < size; ++i) items.push(itemRenderer(from + i, i));
      return itemsRenderer(items, c => (this.items = c));
    }
  },
  render(h) {
    const { axis, length, type, useTranslate3d, from, itemsPerRow } = this;
    const items = this.renderItems();
    if (type === "simple") {
      return h("div", null, items);
    }
    const style = { position: "relative" };
    const cache = {};
    const bottom = Math.ceil(length / itemsPerRow) * itemsPerRow;
    // 作用于this.el上,撑开真实高度
    const size = this.getSpaceBefore(bottom, cache);
    if (size) {
      style[SIZE_KEYS[axis]] = size;
      if (axis === "x") style.overflowX = "hidden";
    }
    // 作用于this.items上，from之前的don元素被移除，通过tranform:translate(?:3d)?
    // 调整this.items的位置，使其出现在合适的位置
    const offset = this.getSpaceBefore(from, cache);
    const x = axis === "x" ? offset : 0;
    const y = axis === "y" ? offset : 0;
    const transform = useTranslate3d
      ? `translate3d(${x}px, ${y}px, 0)`
      : `translate(${x}px, ${y}px)`;
    const listStyle = {
      msTransform: transform,
      WebkitTransform: transform,
      transform
    };
    return h(
      "div",
      {
        style: style
      },
      [
        h(
          "div",
          {
            style: listStyle
          },
          items
        )
      ]
    );
  },
  created() {
    this.cache = {};
    this.cachedScrollPosition = null;
    this.unstable = false;
    this.updateCounter = 0;
  },
  mounted() {
    window.addEventListener("resize", this.updateFrameAndClearCache);
    this.updateFrame(() => this.scrollTo(this.initialIndex));
  },
  updated() {
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
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.updateFrameAndClearCache);
    this.scrollParent.removeEventListener(
      "scroll",
      this.updateFrameAndClearCache,
      PASSIVE
    );
    this.scrollParent.removeEventListener("mousewheel", NOOP, PASSIVE);
  }
};
</script>

<style>
</style>
