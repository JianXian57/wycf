const { getDisplayDrawHistory } = require('../../utils/store')
const { formatDateTimeLabel, formatHumanizedClock, groupByBeijingDate } = require('../../utils/time')
const { navigateTo, switchTab } = require('../../utils/ui')

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'choice', label: '选饭' },
  { value: 'recipe', label: '做饭' },
]

function decorateDraw(record) {
  return {
    ...record,
    exactLabel: formatDateTimeLabel(record.drawnAt),
    timeLabel: formatHumanizedClock(record.drawnAt),
  }
}

Page({
  data: {
    filter: 'all',
    filterOptions: FILTER_OPTIONS,
    groups: [],
    totalCount: 0,
  },

  onLoad(options) {
    const filter = options && options.filter ? String(options.filter) : 'all'
    this.setData({
      filter: FILTER_OPTIONS.some(item => item.value === filter) ? filter : 'all',
    })
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const filter = this.data.filter
    const list = getDisplayDrawHistory(filter === 'all' ? '' : filter)
    const groups = groupByBeijingDate(list, item => item.drawnAt).map(group => ({
      ...group,
      items: group.items.map(decorateDraw),
    }))

    this.setData({
      groups,
      totalCount: list.length,
    })
  },

  changeFilter(e) {
    const filter = e.currentTarget.dataset.filter
    if (!FILTER_OPTIONS.some(item => item.value === filter) || filter === this.data.filter) {
      return
    }

    this.setData({ filter }, () => {
      this.loadData()
    })
  },

  openRecipeDetail(e) {
    const { drawId } = e.currentTarget.dataset
    navigateTo(`/pages/recipe-detail/recipe-detail?drawId=${drawId}`)
  },

  goChoiceTab() {
    switchTab('/pages/eat/eat')
  },

  goRecipeTab() {
    switchTab('/pages/cook/cook')
  },

  goRecords() {
    switchTab('/pages/records/records')
  },
})
