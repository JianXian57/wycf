const { getChoiceById, getDisplayChoices, saveChoiceDraft } = require('../../utils/store')
const { confirmModal, toast } = require('../../utils/ui')

Page({
  data: {
    id: '',
    title: '新增选项',
    name: '',
    enabled: true,
    duplicateHint: '',
  },

  onLoad(options) {
    const id = options && options.id ? String(options.id) : ''
    const nextState = {
      id,
      title: id ? '编辑选项' : '新增选项',
      name: '',
      enabled: true,
      duplicateHint: '',
    }

    if (id) {
      const choice = getChoiceById(id)
      if (!choice) {
        toast('选项不存在')
        setTimeout(() => {
          if (typeof wx !== 'undefined') {
            wx.navigateBack()
          }
        }, 600)
        return
      }

      nextState.name = choice.name
      nextState.enabled = choice.enabled !== false
    }

    this.setData(nextState)
    if (typeof wx !== 'undefined' && typeof wx.setNavigationBarTitle === 'function') {
      wx.setNavigationBarTitle({ title: nextState.title })
    }
  },

  onNameInput(e) {
    this.setData({
      name: e.detail.value,
      duplicateHint: '',
    })
  },

  onEnabledChange(e) {
    this.setData({
      enabled: e.detail.value,
    })
  },

  async saveChoice() {
    const trimmedName = String(this.data.name || '').trim()
    const duplicate = getDisplayChoices().find(item => item.name === trimmedName && item.id !== this.data.id)

    if (duplicate) {
      const confirmed = await confirmModal({
        title: '同名提醒',
        content: `已存在同名选项“${trimmedName}”，仍然保存吗？`,
        confirmText: '继续保存',
      })

      if (!confirmed) {
        this.setData({
          duplicateHint: '已存在同名选项，但同名是允许的。',
        })
        return
      }
    }

    const result = saveChoiceDraft({
      id: this.data.id,
      name: this.data.name,
      enabled: this.data.enabled,
    })

    if (!result.ok) {
      toast(result.message)
      return
    }

    toast('已保存')
    setTimeout(() => {
      if (typeof wx !== 'undefined') {
        wx.navigateBack()
      }
    }, 300)
  },
})
