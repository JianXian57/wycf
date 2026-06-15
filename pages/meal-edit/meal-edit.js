const {
  MEAL_TYPES,
  getMealRecordById,
  getMealRecordBySourceDrawId,
  saveMealRecordDraft,
} = require('../../utils/store')
const { splitBeijingTimestamp } = require('../../utils/time')
const { toast } = require('../../utils/ui')

function getCurrentBeijingDefaults() {
  return splitBeijingTimestamp(Date.now())
}

Page({
  data: {
    id: '',
    sourceDrawId: '',
    title: '新增记录',
    sourceLabel: '手动新增',
    date: '',
    time: '',
    mealTypeOptions: MEAL_TYPES,
    mealTypeIndex: 0,
    foodName: '',
    note: '',
    canSave: true,
    hint: '日期和时间会按北京时间保存到毫秒。来自抽取结果的预填内容不会自动保存。',
  },

  onLoad(options) {
    const id = options && options.id ? String(options.id) : ''
    const source = options && options.source ? String(options.source) : ''
    const foodName = options && options.foodName ? String(options.foodName) : ''
    const mealType = options && options.mealType ? String(options.mealType) : ''
    const sourceDrawId = options && options.sourceDrawId ? String(options.sourceDrawId) : ''
    const defaults = getCurrentBeijingDefaults()
    const nextState = {
      id,
      sourceDrawId,
      title: id ? '编辑记录' : '新增记录',
      sourceLabel: source === 'draw' ? '来自抽取结果' : '手动新增',
      date: defaults.date,
      time: defaults.time,
      mealTypeIndex: 2,
      foodName,
      note: '',
    }

    if (mealType) {
      const mealTypeIndex = MEAL_TYPES.indexOf(mealType)
      if (mealTypeIndex >= 0) {
        nextState.mealTypeIndex = mealTypeIndex
      }
    }

    if (id) {
      const record = getMealRecordById(id)
      if (!record) {
        toast('记录不存在')
        setTimeout(() => {
          if (typeof wx !== 'undefined') {
            wx.navigateBack()
          }
        }, 600)
        return
      }

      const split = splitBeijingTimestamp(record.eatenAt)
      nextState.date = split.date
      nextState.time = split.time
      nextState.mealTypeIndex = Math.max(0, MEAL_TYPES.indexOf(record.mealType))
      nextState.foodName = record.foodName
      nextState.note = record.note || ''
      nextState.sourceDrawId = record.sourceDrawId || ''
      nextState.sourceLabel = record.sourceDrawId ? '来自抽取结果' : '手动新增'
    }

    if (!id && sourceDrawId) {
      const duplicate = getMealRecordBySourceDrawId(sourceDrawId)
      if (duplicate) {
        toast('这条抽取结果已经记入过记录了')
        setTimeout(() => {
          if (typeof wx !== 'undefined') {
            wx.navigateBack()
          }
        }, 600)
        return
      }
    }

    this.setData(nextState)

    if (typeof wx !== 'undefined' && typeof wx.setNavigationBarTitle === 'function') {
      wx.setNavigationBarTitle({
        title: nextState.title,
      })
    }
  },

  onDateChange(e) {
    this.setData({
      date: e.detail.value,
    })
  },

  onTimeChange(e) {
    this.setData({
      time: e.detail.value,
    })
  },

  onMealTypeChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      mealTypeIndex: Number.isFinite(index) ? index : 0,
    })
  },

  onFoodInput(e) {
    this.setData({
      foodName: e.detail.value,
    })
  },

  onNoteInput(e) {
    this.setData({
      note: e.detail.value,
    })
  },

  saveRecord() {
    const result = saveMealRecordDraft({
      id: this.data.id,
      sourceDrawId: this.data.sourceDrawId,
      date: this.data.date,
      time: this.data.time,
      mealType: this.data.mealTypeOptions[this.data.mealTypeIndex],
      foodName: this.data.foodName,
      note: this.data.note,
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

  cancelEdit() {
    if (typeof wx !== 'undefined') {
      wx.navigateBack()
    }
  },
})
