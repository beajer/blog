import { Table } from "element-ui";
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
    }
  },
  computed: {
    shouldQuery: {
      get() {
        return this.value
      },
      set(v) {
        this.$emit("input", v)
      }
    },
    paramsModel() {
      let queryModel = {}
      for (let key in this.queryModel) {
        if (this.queryModel.hasOwnProperty(key)) {
          if (this.queryModel[key] != null) {
            queryModel[key] = this.queryModel[key]
          }
        }
      }
      return Object.assign({}, this.pageModel, queryModel)
    }
  },
  watch: {
    value(v) {
      if (v) {
        this.queryTableModel().finally(() => {
          this.shouldQuery = false
        })
      }
    }
  },
  created() {
    if (this.value) {
      this.queryTableModel().finally(() => {
        this.shouldQuery = false
      })
    }
  },
  methods: {
    handlePageNumChange(page) {
      this.pageModel.page = page
      this.queryTableModel()
    },
    handleSizeChange(size) {
      this.pageModel.limit = size
      this.queryTableModel()
    },
    queryTableModel() {
      return this.getData(this.paramsModel).then(data => {
        data = data.data.body
        if (!data) return
        this.tableModel = this.filterResult(data.data)
        this.pageModel.page = data.page
        this.pageModel.limit = data.limit
        this.pageModel.total = data.total
        return data
      }, this.queryFailed)
    },
    queryFailed(err) {
      Object.assign(this.pageModel, {
        page: 1,
        limit: 10,
        total: 0
      })
      this.tableModel = []
      return Promise.reject(err)
    },
    expand_change(row, expandedRows) {
      this.$emit("expand-change", row, expandedRows)
    }
  },
  render(h, context) {
    const slots = Object.keys(this.$slots)
      .reduce((arr, key) => arr.concat(this.$slots[key]), [])
      .map(vnode => {
        vnode.context = this._self
        return vnode
      })
    context = context || this
    return (
      <div v-loading={context.shouldQuery} class="mb20">
        {h(
          "el-table",
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
        <div class="pagination-container">
          <el-pagination 
            on-current-change={context.handlePageNumChange}
            on-size-change={context.handleSizeChange}
            current-page={context.pageModel.pageNum}
            page-sizes={[10, 20, 50]}
            page-size={context.pageModel.pageSize}
            total={context.pageModel.total}
            layout="total, sizes, prev, pager, next, jumper"
          ></el-pagination>
        </div>
      </div>
    );
  }
};
