<template>
  <div>
    <recycle-list
      :length="list.length"
      :finished="finished"
      :type="type"
      @loadmore="onLoad"
    >
      <template v-slot="{ index }">
        <slot :item="list[index]" />
      </template>
      <template #empty>
        <div v-if="!loading && finished" class="empty">
          <img src="./empty.png" />
        </div>
      </template>
    </recycle-list>
    <slot name="loading" :loading="loading" :finished="finished">
      <template v-if="loading">
        <div class="loading">
          <van-loading class="loading"></van-loading>加载中...
        </div>
      </template>
      <template v-else-if="list.length > pageModel.limit && finished">
        <div class="no-data">
          我是有底线的...
        </div>
      </template>
    </slot>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from 'vue-property-decorator';
import { RecycleList } from './';
import { AxiosPromise } from 'axios';
import { IPageModel } from '@/api/types';
import { ScrollTypes, IPageParams } from './types';
import { ILifeCycle } from '@/types';
import { Loading } from 'vant';

Vue.use(Loading);
@Component({
  components: {
    RecycleList,
  },
})
export default class RecycleListMore extends Vue implements ILifeCycle {
  /** 列表数据  */
  list: any[] = [];
  /** 用于标记是否还需要onLoad  */
  finished: boolean = false;
  /** 开始加载数据,当设置会true时，会从第一页起开始加载  */
  @Prop({ type: Boolean, default: false }) readonly value!: boolean;
  /** type */
  @Prop({ type: String, default: 'uniform' }) readonly type!: ScrollTypes;
  /** load  */
  @Prop({ type: Function, default: () => Promise.resolve() })
  load!: (params: IPageParams) => Promise<IPageModel<any>>;
  /** loading  */
  loading: boolean = false;
  pageModel: IPageParams = {
    page: 1,
    limit: 10,
  };

  async onLoad() {
    if (this.finished) return;
    this.finished = true;
    this.loading = true;
    try {
      const res = await this.load(this.pageModel);
      if (res.page === 1) {
        this.list.splice(0, this.list.length, ...res.data);
      } else {
        this.list.push(...res.data);
      }
      if (res.data.length === this.pageModel.limit) {
        this.finished = false;
        this.pageModel.page++;
      }
    } catch (e) {}
    this.loading = false;
    if (this.value) this.$emit('input', false);
  }
  @Watch('value')
  onValueChange(v: boolean) {
    if (v) {
      this.finished = false;
      this.pageModel.page = 1;
      this.onLoad();
    }
  }
  mounted() {
    this.onValueChange(this.value);
  }
}
</script>

<style lang="scss" scoped>
.empty {
  text-align: center;
  img {
    width: 420px;
  }
}
.loading,
.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
  font-size: 24px;
  padding-bottom: 20px;
}
</style>

