<script lang='tsx'>
import { Vue, Component, Prop, Inject } from 'vue-property-decorator';
import { ILifeCycle } from '@/types';
import { CreateElement } from 'vue';
import { ScrollTypes } from './types';
import { OFFSET_SIZE_KEYS, SIZE_KEYS } from './utils';
// 用于recycle-list的item组件，获取item的offsetSize
@Component
export default class RecycleListItem extends Vue implements ILifeCycle {
  @Prop(Number) index!: number;
  @Inject() itemsCache!: number[];
  @Inject() axis!: 'x' | 'y';
  @Inject() type!: ScrollTypes;
  mounted() {
    // 为了避免子元素是行级元素内嵌块级元素，此时offsetSize的值会为0
    const rect = this.$el.getBoundingClientRect();
    this.$set(
      this.itemsCache,
      this.type === 'uniform' ? 0 : this.index,
      rect[SIZE_KEYS[this.axis]],
    );
  }
  render() {
    return this.$slots.default;
  }
}
</script>