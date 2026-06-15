const { getDrawRecordById, getRecipeById } = require('../../utils/store')
const { formatDateTimeLabel } = require('../../utils/time')
const { toast } = require('../../utils/ui')

Page({
  data: {
    recipe: null,
    sourceLabel: '',
    exactLabel: '',
  },

  onLoad(options) {
    const drawId = options && options.drawId ? String(options.drawId) : ''
    const recipeId = options && options.id ? String(options.id) : ''

    if (drawId) {
      const drawRecord = getDrawRecordById(drawId)
      if (!drawRecord || drawRecord.drawType !== 'recipe' || !drawRecord.snapshot) {
        toast('历史快照不存在')
        setTimeout(() => {
          if (typeof wx !== 'undefined') {
            wx.navigateBack()
          }
        }, 600)
        return
      }

      this.setData({
        recipe: drawRecord.snapshot,
        sourceLabel: '来自抽取历史快照',
        exactLabel: formatDateTimeLabel(drawRecord.drawnAt),
      })
      return
    }

    if (recipeId) {
      const recipe = getRecipeById(recipeId)
      if (!recipe) {
        toast('菜谱不存在')
        setTimeout(() => {
          if (typeof wx !== 'undefined') {
            wx.navigateBack()
          }
        }, 600)
        return
      }

      this.setData({
        recipe,
        sourceLabel: '来自当前菜谱列表',
        exactLabel: '',
      })
      return
    }

    toast('页面参数缺失')
    setTimeout(() => {
      if (typeof wx !== 'undefined') {
        wx.navigateBack()
      }
    }, 600)
  },
})
