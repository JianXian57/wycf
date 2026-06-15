const { RECIPE_DIFFICULTIES, normalizeLines } = require('../../utils/validators')
const { getRecipeById, saveRecipeDraft } = require('../../utils/store')
const { toast } = require('../../utils/ui')

function toMultiline(list) {
  return Array.isArray(list) ? list.join('\n') : ''
}

Page({
  data: {
    id: '',
    title: '新增菜谱',
    name: '',
    category: '',
    ingredientsText: '',
    stepsText: '',
    durationMinutes: '15',
    difficultyOptions: RECIPE_DIFFICULTIES,
    difficultyIndex: 1,
    note: '',
    enabled: true,
  },

  onLoad(options) {
    const id = options && options.id ? String(options.id) : ''
    const nextState = {
      id,
      title: id ? '编辑菜谱' : '新增菜谱',
      name: '',
      category: '',
      ingredientsText: '',
      stepsText: '',
      durationMinutes: '15',
      difficultyIndex: 1,
      note: '',
      enabled: true,
    }

    if (id) {
      const recipe = getRecipeById(id)
      if (!recipe) {
        toast('菜谱不存在')
        setTimeout(() => {
          if (typeof wx !== 'undefined') {
            wx.navigateBack()
          }
        }, 600)
        return
      }

      nextState.name = recipe.name
      nextState.category = recipe.category || ''
      nextState.ingredientsText = toMultiline(recipe.ingredients)
      nextState.stepsText = toMultiline(recipe.steps)
      nextState.durationMinutes = String(recipe.durationMinutes || '')
      nextState.difficultyIndex = Math.max(0, RECIPE_DIFFICULTIES.indexOf(recipe.difficulty))
      nextState.note = recipe.note || ''
      nextState.enabled = recipe.enabled !== false
    }

    this.setData(nextState)

    if (typeof wx !== 'undefined' && typeof wx.setNavigationBarTitle === 'function') {
      wx.setNavigationBarTitle({ title: nextState.title })
    }
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [field]: e.detail.value,
    })
  },

  onDifficultyChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      difficultyIndex: Number.isFinite(index) ? index : 1,
    })
  },

  onEnabledChange(e) {
    this.setData({
      enabled: e.detail.value,
    })
  },

  saveRecipe() {
    const result = saveRecipeDraft({
      id: this.data.id,
      name: this.data.name,
      category: this.data.category,
      ingredients: normalizeLines(this.data.ingredientsText),
      steps: normalizeLines(this.data.stepsText),
      durationMinutes: this.data.durationMinutes,
      difficulty: this.data.difficultyOptions[this.data.difficultyIndex],
      note: this.data.note,
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
