<template>
  <div
    :style="{
      [SizeKey]: scrollerStyleSize,
    }"
  >
    <template v-if="length > 0">
      <div
        :style="{
          transform: containerStyleTransform,
        }"
      >
        <Recycle-list-item
          v-for="index in size"
          :index="index + from - 1"
          :key="index + from - 1"
        >
          <slot :index="index + from - 1" />
        </Recycle-list-item>
      </div>
    </template>
    <slot v-else name="empty"></slot>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, Provide } from 'vue-property-decorator';
import { ILifeCycle } from '@/types';
import { ScrollTypes } from './types';
import {
  NOOP,
  PASSIVE,
  CLIENT_START_KEYS,
  OFFSET_START_KEYS,
  SCROLL_START_KEYS,
  SCROLL_SIZE_KEYS,
  defaultScrollParentGetter,
  defaultScrollParentViewportSizeGetter,
  defaultScrollParentScrollSizeGetter,
  MAX_SYNC_UPDATES,
  UNSTABLE_MESSAGE,
  SIZE_KEYS,
} from './utils';
import RecycleListItem from './recycle-list-item.vue';
// 与recycle-list-item组合使用
@Component({
  components: {
    RecycleListItem,
  },
})
export default class RecycleList extends Vue implements ILifeCycle {
  /** Provide 收集recycle-list-item的一些消息 */
  @Provide() itemsCache: number[] = [];
  /** 滚动方向  */
  @Provide() @Prop({ type: String, default: 'y' }) readonly axis!: 'x' | 'y';
  /** 滚动类型  */
  @Provide() @Prop({ type: String, default: 'simple' }) type!: ScrollTypes;
  /** 列表长度  */
  @Prop({ type: Number, default: 0 }) readonly length!: number;
  /** 滚动视图区域更多的边界距离内仍需要显示元素 */
  @Prop({ type: Number, default: 300 }) readonly threshold!: number;
  /** 是否加载完成 */
  @Prop({ type: Boolean, default: true }) readonly finished!: boolean;
  /** 在type === 'simple' | 'variable'时， 以pageSize为基准单位，尝试匹配最小的显示列表 */
  @Prop({ type: Number, default: 10 }) readonly pageSize!: number;

  /** 当前渲染列表区域的起始信息  */
  startScrollSize: number = 0;
  /** 当前渲染列表区域的停止信息  */
  endScrollSize: number = 0;
  /** 滚动父元素 */
  scrollParent: Element | Window | undefined = undefined;
  /** 缓存当前滚动区域.scroller padding-box，相对viewport/scrollParent的滚动信息  */
  cachedScrollPosition: number | null = null;
  /** 是否不稳固状态  */
  unstable: boolean = false;
  /** 一个周期内更新次数  */
  updateCounter: number = 0;
  /** 不稳固状态提示信息 */
  updateCounterTimeoutId: number = 0;
  /** scroller的offsetStyle key  */
  get SizeKey(): 'width' | 'height' {
    return SIZE_KEYS[this.axis];
  }

  @Watch('length')
  onLengthChange() {
    this.itemsCache.splice(this.length);
  }

  /** 设置scroller的OffsetSize  */
  get scrollerStyleSize(): string {
    if (this.type === 'simple' || !this.itemsCache.length) return 'auto';
    if (this.type === 'uniform') return this.length * this.itemsCache[0] + 'px';
    // this.type === 'variable'
    return this.itemsCache.reduce((a, b) => a + b) + 'px';
  }

  /** 设置当前显示元素的包裹元素的translate style  */
  get containerStyleTransform() {
    if (this.type === 'simple') return 'none';
    const offset = this.getSpaceBefore(this.from);
    const x = this.axis === 'x' ? offset : 0;
    const y = this.axis === 'y' ? offset : 0;
    return `translate3d(${x}px, ${y}px, 0)`;
  }
  /** 从this.cacheItems中，累计index元素之前的offsetSize  */
  getSpaceBefore(from: number): number {
    if (!this.itemsCache.length || !from) return 0;
    if (this.type === 'uniform') return this.itemsCache[0] * from;
    return this.itemsCache.slice(0, from).reduce((a, b) => a + b);
  }
  /** 从from个元素开始，渲染size个元素  */
  get from(): number {
    this.$nextTick(this.checkLoadMore);
    if (this.type === 'simple') {
      return 0;
    } else if (this.type === 'variable') {
      let from = 0;
      const size = 0;
      let space = 0;
      const maxFrom = this.length - 1;
      while (from < maxFrom) {
        if (
          !this.itemsCache[from] ||
          space + this.itemsCache[from] > this.startScrollSize
        )
          break;
        space += this.itemsCache[from];
        ++from;
      }
      return from;
    } else if (this.type === 'uniform' && this.itemsCache[0]) {
      return Math.min(
        Math.floor(this.startScrollSize / this.itemsCache[0]),
        this.length - this.size,
      );
    }
    return 0;
  }
  /** 从from个元素开始，渲染size个元素  */
  get size(): number {
    this.$nextTick(this.checkLoadMore);
    if (this.type === 'simple') {
      const elEnd = this.itemsCache.reduce((a, b) => a + b);
      if (elEnd <= this.endScrollSize) {
        return Math.min(this.size + this.pageSize, this.length);
      }
    } else if (this.type === 'variable') {
      const maxSize = this.length - this.from;
      let size = 0;
      let space =
        this.from === 0
          ? 0
          : this.itemsCache.slice(0, this.from).reduce((a, b) => a + b);
      while (size < maxSize && space < this.endScrollSize) {
        const itemSize = this.itemsCache[this.from + size];
        if (!this.itemsCache[this.from + size]) {
          size = Math.min(size + this.pageSize, maxSize);
          break;
        }
        space += itemSize;
        ++size;
      }
      return size;
    } else if (this.type === 'uniform' && this.itemsCache[0]) {
      return Math.min(
        Math.ceil(
          (this.endScrollSize - this.startScrollSize) / this.itemsCache[0],
        ) + 1,
        this.length,
      );
    }
    return Math.min(this.pageSize, this.length);
  }

  /** 根据from, size检测是否触发底部  */
  checkLoadMore() {
    if (this.from + this.size === this.length && !this.finished) {
      this.$emit('loadmore', this.from, this.size);
    }
  }

  /** 更新视图，重新计算需要渲染列表的起止信息，更新from, size  */
  updateFrameAndClearCachedPosition() {
    this.cachedScrollPosition = null;
    this.getScrollPosition();
    this.getStartAndEnd();
  }

  /** 更新滚动父元素并监听滚动事件  */
  updateScrollParentAndEvents() {
    const prev = this.scrollParent;
    this.scrollParent = defaultScrollParentGetter(this);
    if (prev === this.scrollParent) return;
    if (prev) {
      prev.removeEventListener(
        'scroll',
        this.updateFrameAndClearCachedPosition,
      );
      prev.removeEventListener('mousewheel', NOOP);
    }

    // If we have a new parent, cached parent dimensions are no longer useful.
    this.updateFrameAndClearCachedPosition();
    this.scrollParent.addEventListener(
      'scroll',
      this.updateFrameAndClearCachedPosition,
      PASSIVE,
    );
    // You have to attach mousewheel listener to the scrollable element.
    // Just an empty listener. After that onscroll events will be fired synchronously.
    this.scrollParent.addEventListener('mousewheel', NOOP, PASSIVE);
  }
  /** 根据预设边界值和当前滚动位置信息
   *  得到当前渲染的列表的起止位置信息
   *  scrollParent内可能存在padding或其他元素，消除这个影响
   * */
  getStartAndEnd(thresold = this.threshold) {
    const scroll = this.getScrollPosition();
    this.startScrollSize = Math.max(0, scroll - thresold);
    this.endScrollSize =
      scroll + defaultScrollParentViewportSizeGetter(this) + thresold;
  }
  /** el.PaddingBox距离html元素axis方向距离 */
  getOffset(el: HTMLElement) {
    let offset: number = el[CLIENT_START_KEYS[this.axis]] || 0;
    const offsetKey = OFFSET_START_KEYS[this.axis];
    while (el) {
      offset += el[offsetKey] || 0;
      el = el.offsetParent as HTMLElement;
    }
    return offset;
  }
  /** 获取cachedScrollPosition  */
  getScrollPosition() {
    // Cache scroll position as this causes a forced synchronous layout.
    if (typeof this.cachedScrollPosition === 'number')
      return this.cachedScrollPosition;
    const scrollKey = SCROLL_START_KEYS[this.axis];
    const actual =
      this.scrollParent === window
        ? // Firefox always returns document.body[scrollKey] as 0 and Chrome/Safari
        // always return document.documentElement[scrollKey] as 0, so take
        // whichever has a value.
        document.body[scrollKey] || document.documentElement[scrollKey]
        : (this.scrollParent as Element)[scrollKey];
    // ContentBox最大可滚动距离，scrollParent.scrollHeight - scrollParent.clientHeight
    const max =
      defaultScrollParentScrollSizeGetter(this) -
      defaultScrollParentViewportSizeGetter(this);
    // Q:什么情况下actual会大于max?
    // A:可能在ios下或其他可以弹性滑动的场景下,actual会大于max
    const scroll = Math.max(0, Math.min(actual, max));
    this.cachedScrollPosition =
      scroll +
      this.getOffset(this.scrollParent as HTMLElement) -
      this.getOffset(this.$el as HTMLElement);
    return this.cachedScrollPosition;
  }

  mounted() {
    window.addEventListener('resize', this.updateFrameAndClearCachedPosition);
    this.updateScrollParentAndEvents();
  }
  activated() {
    window.addEventListener('resize', this.updateFrameAndClearCachedPosition);
    this.updateScrollParentAndEvents();
  }
  deactivated() {
    window.removeEventListener(
      'resize',
      this.updateFrameAndClearCachedPosition,
    );
    if (!this.scrollParent) return;
    this.scrollParent.removeEventListener(
      'scroll',
      this.updateFrameAndClearCachedPosition,
      PASSIVE,
    );
    this.scrollParent.removeEventListener('mousewheel', NOOP, PASSIVE);
    this.scrollParent = undefined;
  }
  destroyed() {
    window.removeEventListener(
      'resize',
      this.updateFrameAndClearCachedPosition,
    );
    if (!this.scrollParent) return;
    this.scrollParent.removeEventListener(
      'scroll',
      this.updateFrameAndClearCachedPosition,
      PASSIVE,
    );
    this.scrollParent.removeEventListener('mousewheel', NOOP, PASSIVE);
  }
  updated() {
    if (process.env.NODE_ENV !== 'production') {
      if (this.unstable) return;
      if (++this.updateCounter > MAX_SYNC_UPDATES) {
        this.unstable = true;
        return console.error(UNSTABLE_MESSAGE);
      }
      if (!this.updateCounterTimeoutId) {
        this.updateCounterTimeoutId = setTimeout(() => {
          this.updateCounter = 0;
        }, 0);
        delete this.updateCounterTimeoutId;
      }
    }
  }
}
</script>
