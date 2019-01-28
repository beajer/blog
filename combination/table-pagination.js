import { Table } from 'element-ui';
const maybeNumber = /^\d+$/;
const TypesFromUrl = v => {
  if (maybeNumber.test(v)) {
    return +v;
  }
  let d = new Date(v);
  if (!isNaN(d.getTime())) {
    return d;
  }
  return v;
};
/*
<table-pagination
  v-model="loadTable"
  :queryModel.sync="queryModel"
  :getData="getData" />
*/
export default {
  components: {
    Table
  },
  props: {
    value: {
      type: Boolean,
      required: true
    },
    getData: {
      type: Function,
      required: true
    },
    queryModel: {
      type: Object,
      default: () => ({})
    },
    filterResult: {
      type: Function,
      default: _ => _
    },
    ...Table.props
  },
  data() {
    return {
      pageModel: {
        page: 1,
        limit: 10,
        total: 0
      },
      tableModel: []
    };
  },
  computed: {
    shouldQuery: {
      get() {
        return this.value;
      },
      set(v) {
        this.$emit('input', v);
      }
    },
    paramsModel() {
      let queryModel = {};
      for (let key in this.queryModel) {
        if (this.queryModel.hasOwnProperty(key)) {
          let val = this.queryModel[key];
          if (val != null) {
            queryModel[key] = val;
          }
        }
      }
      let t = Object.assign({}, this.pageModel, queryModel);
      this.assignParamsToRouter(t);
      return t;
    }
  },
  watch: {
    value(v) {
      if (v) {
        this.queryTableModel().finally(() => {
          this.shouldQuery = false;
        });
      }
    }
  },
  created() {
    this.pickParamsFromRoute();
  },
  mounted() {
    this.$nextTick(() => {
      if (this.value) {
        this.queryTableModel().finally(() => {
          this.shouldQuery = false;
        });
      }
    });
  },
  methods: {
    pickParamsFromRoute() {
      if (this.$route) {
        let query = this.$route.query;
        let t = {};
        for (let k in this.queryModel) {
          if (query[k]) {
            t[k] = TypesFromUrl(query[k]);
          }
        }
        for (let k in this.pageModel) {
          if (query[k]) this.pageModel[k] = TypesFromUrl(query[k]);
        }
        this.$emit('update:queryModel', {
          ...{},
          ...this.queryModel,
          ...t
        });
      }
    },
    assignParamsToRouter(queryModel) {
      if (this.$router && this.$route) {
        this.$router.replace({
          path: this.$route.path,
          query: {
            ...this.$route.query,
            ...queryModel
          }
        });
      }
    },
    handlePageNumChange(page) {
      this.pageModel.page = page;
      this.queryTableModel();
    },
    handleSizeChange(size) {
      this.pageModel.limit = size;
      this.queryTableModel();
    },
    queryTableModel() {
      return this.getData(this.paramsModel).then(data => {
        data = data.data.body;
        if (!data) return;
        this.tableModel = this.filterResult(data.data);
        this.pageModel.page = data.page;
        this.pageModel.limit = data.limit;
        this.pageModel.total = data.total;
        return data;
      }, this.queryFailed);
    },
    queryFailed(err) {
      Object.assign(this.pageModel, {
        page: 1,
        limit: 10,
        total: 0
      });
      this.tableModel = [];
      return Promise.reject(err);
    },
    expand_change(row, expandedRows) {
      this.$emit('expand-change', row, expandedRows);
    }
  },
  render(h, context) {
    const slots = Object.keys(this.$slots)
      .reduce((arr, key) => arr.concat(this.$slots[key]), [])
      .map(vnode => {
        vnode.context = this._self;
        return vnode;
      });
    context = context || this;
    return (
      <div v-loading={context.shouldQuery} class="mb20">
        {h(
          'el-table',
          {
            on: context.$listeners,
            props: {
              ...context.$props,
              data: context.tableModel
            },
            scopedSlots: context.$scopedSlots,
            attrs: context.$attrs
          },
          slots
        )}
        {h(
          'div',
          {
            class: {
              'pagination-container': true
            }
          },
          [
            h('el-pagination', {
              on: {
                'current-change': context.handlePageNumChange,
                'size-change': context.handleSizeChange
              },
              props: {
                'page-sizes': [10, 20, 50],
                'page-size': context.pageModel.limit,
                'current-page': context.pageModel.page,
                total: context.pageModel.total,
                layout: 'total, sizes, prev, pager, next, jumper'
              }
            })
          ]
        )}
      </div>
    );
  }
};
