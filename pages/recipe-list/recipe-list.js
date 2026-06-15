const {
  deleteRecipe,
  getDisplayRecipes,
  toggleRecipeEnabled,
} = require('../../utils/store')
const { confirmModal, navigateTo, toast } = require('../../utils/ui')

Page({
  data: {
    recipes: [],
    enabledCount: 0,
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const recipes = getDisplayRecipes()
    this.setData({
      recipes,
      enabledCount: recipes.filter(item => item.enabled !== false).length,
    })
  },

  addRecipe() {
    navigateTo('/pages/recipe-edit/recipe-edit')
  },

  editRecipe(e) {
    const { id } = e.currentTarget.dataset
    navigateTo(`/pages/recipe-edit/recipe-edit?id=${id}`)
  },

  openRecipe(e) {
    const { id } = e.currentTarget.dataset
    navigateTo(`/pages/recipe-detail/recipe-detail?id=${id}`)
  },

  toggleRecipe(e) {
    const { id, enabled } = e.currentTarget.dataset
    const result = toggleRecipeEnabled(id, enabled !== 'true')
    if (!result.ok) {
      toast(result.message)
      return
    }

    toast(result.data.enabled ? '已启用' : '已停用')
    this.loadData()
  },

  async deleteRecipe(e) {
    const { id, name } = e.currentTarget.dataset
    const confirmed = await confirmModal({
      title: '删除菜谱',
      content: `确认删除“${name}”吗？`,
      confirmText: '删除',
    })

    if (!confirmed) {
      return
    }

    const result = deleteRecipe(id)
    if (!result.ok) {
      toast(result.message)
      return
    }

    toast('已删除')
    this.loadData()
  },
})
