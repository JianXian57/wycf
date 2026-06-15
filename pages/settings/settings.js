const { clearAllData, getSummary, restoreDefaultData } = require('../../utils/store')
const { confirmModal, navigateTo, reLaunch, toast } = require('../../utils/ui')

Page({
  data: {
    summary: null,
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    this.setData({
      summary: getSummary(),
    })
  },

  goChoiceList() {
    navigateTo('/pages/choice-list/choice-list')
  },

  goRecipeList() {
    navigateTo('/pages/recipe-list/recipe-list')
  },

  goAbout() {
    navigateTo('/pages/about/about')
  },

  async restoreDefaults() {
    const confirmed = await confirmModal({
      title: '恢复默认数据',
      content: '会用默认示例覆盖当前本地数据，确认继续吗？',
      confirmText: '恢复',
    })

    if (!confirmed) {
      return
    }

    restoreDefaultData()
    toast('已恢复默认数据')
    this.loadData()
  },

  async clearData() {
    const first = await confirmModal({
      title: '清空全部数据',
      content: '这会删除所有选项、菜谱、抽取历史和吃饭记录。',
      confirmText: '继续',
    })

    if (!first) {
      return
    }

    const second = await confirmModal({
      title: '再次确认',
      content: '清空后不会自动恢复默认数据，除非你手动点击“恢复默认数据”。',
      confirmText: '确认清空',
    })

    if (!second) {
      return
    }

    clearAllData()
    toast('已清空')
    this.loadData()
  },
})
