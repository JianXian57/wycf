const { deleteMealRecord, getDisplayMealRecords, getSummary } = require('../../utils/store')
const { formatDateTimeLabel, formatHumanizedClock, groupByBeijingDate } = require('../../utils/time')
const { confirmModal, navigateTo, switchTab, toast } = require('../../utils/ui')

function getSourceLabel(sourceType) {
  if (sourceType === 'choice') {
    return '选饭'
  }

  if (sourceType === 'recipe') {
    return '做饭'
  }

  return '手动记录'
}

function getSourceTagClass(sourceType) {
  if (sourceType === 'choice') {
    return 'tag-muted'
  }

  if (sourceType === 'recipe') {
    return 'tag-success'
  }

  return 'tag-ghost'
}

function decorateRecord(record) {
  return {
    ...record,
    exactLabel: formatDateTimeLabel(record.eatenAt),
    timeLabel: formatHumanizedClock(record.eatenAt),
    sourceLabel: getSourceLabel(record.sourceType),
    sourceTagClass: getSourceTagClass(record.sourceType),
  }
}

Page({
  data: {
    summary: null,
    groups: [],
    totalCount: 0,
    latestLabel: '暂无记录',
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const records = getDisplayMealRecords()
    const groups = groupByBeijingDate(records, item => item.eatenAt).map(group => ({
      ...group,
      items: group.items.map(decorateRecord),
    }))
    const summary = getSummary()
    const latest = records[0]

    this.setData({
      summary,
      groups,
      totalCount: summary.mealRecordsTotal,
      latestLabel: latest ? formatDateTimeLabel(latest.eatenAt) : '暂无记录',
    })
  },

  addRecord() {
    navigateTo('/pages/meal-edit/meal-edit')
  },

  editRecord(e) {
    const { id } = e.currentTarget.dataset
    navigateTo(`/pages/meal-edit/meal-edit?id=${id}`)
  },

  async deleteRecord(e) {
    const { id, name } = e.currentTarget.dataset
    const confirmed = await confirmModal({
      title: '删除记录',
      content: `确认删除“${name}”这条记录吗？`,
      confirmText: '删除',
    })

    if (!confirmed) {
      return
    }

    const result = deleteMealRecord(id)
    if (!result.ok) {
      toast(result.message)
      return
    }

    toast('已删除')
    this.loadData()
  },

  goSettings() {
    navigateTo('/pages/settings/settings')
  },

  goChoiceTab() {
    switchTab('/pages/eat/eat')
  },

  goRecipeTab() {
    switchTab('/pages/cook/cook')
  },
})
