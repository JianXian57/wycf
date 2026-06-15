const {
  deleteChoice,
  getDisplayChoices,
  toggleChoiceEnabled,
} = require('../../utils/store')
const { confirmModal, navigateTo, toast } = require('../../utils/ui')

Page({
  data: {
    choices: [],
    enabledCount: 0,
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const choices = getDisplayChoices()
    this.setData({
      choices,
      enabledCount: choices.filter(item => item.enabled !== false).length,
    })
  },

  addChoice() {
    navigateTo('/pages/choice-edit/choice-edit')
  },

  editChoice(e) {
    const { id } = e.currentTarget.dataset
    navigateTo(`/pages/choice-edit/choice-edit?id=${id}`)
  },

  toggleChoice(e) {
    const { id, enabled } = e.currentTarget.dataset
    const result = toggleChoiceEnabled(id, enabled !== 'true')
    if (!result.ok) {
      toast(result.message)
      return
    }

    toast(result.data.enabled ? '已启用' : '已停用')
    this.loadData()
  },

  async deleteChoice(e) {
    const { id, name } = e.currentTarget.dataset
    const confirmed = await confirmModal({
      title: '删除选项',
      content: `确认删除“${name}”吗？`,
      confirmText: '删除',
    })

    if (!confirmed) {
      return
    }

    const result = deleteChoice(id)
    if (!result.ok) {
      toast(result.message)
      return
    }

    toast('已删除')
    this.loadData()
  },
})
