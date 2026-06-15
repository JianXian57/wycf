const { pickEnabledItems, pickRandomItem } = require('./random')
const {
  deleteDrawRecord,
  getChoiceById,
  getDrawRecordById,
  getEnabledChoices,
  getEnabledRecipes,
  getLastDrawResult,
  getRecentDrawHistory,
  getRecordedDrawIdSet,
  getRecipeById,
  isDrawRecorded,
  recordDraw,
} = require('./store')
const { formatDateTimeLabel, formatHumanizedClock } = require('./time')
const { confirmModal, navigateTo, toast } = require('./ui')

function buildRollingWindow(list, centerIndex) {
  if (!list.length) {
    return []
  }

  if (list.length === 1) {
    return [list[0], list[0], list[0]]
  }

  const index = centerIndex % list.length
  const prev = list[(index - 1 + list.length) % list.length]
  const center = list[index]
  const next = list[(index + 1) % list.length]
  return [prev, center, next]
}

function buildRollingFrames(pool, finalItem) {
  if (!pool.length) {
    return []
  }

  const finalIndex = Math.max(0, pool.indexOf(finalItem))
  const totalFrames = pool.length === 1 ? 8 : Math.min(18, Math.max(12, pool.length + 8))
  const frames = []
  let currentIndex = Math.floor(Math.random() * pool.length)

  for (let index = 0; index < totalFrames - 1; index += 1) {
    const progress = (index + 1) / (totalFrames - 1)
    const step = pool.length === 1 ? 0 : Math.max(1, Math.round(3 - progress * 2))

    currentIndex = pool.length === 1 ? 0 : (currentIndex + step) % pool.length
    frames.push({
      centerIndex: currentIndex,
      delay: 45 + Math.round(Math.pow(progress, 1.8) * 145),
    })
  }

  frames.push({
    centerIndex: finalIndex,
    delay: 0,
  })

  return frames
}

function getModeConfig(drawType) {
  if (drawType === 'recipe') {
    return {
      drawType: 'recipe',
      drawTypeLabel: '做饭',
      pageTitle: '做饭',
      pageSubtitle: '从启用的菜谱里随机抽一道，历史会保留完整快照。',
      rollingSectionTitle: '做饭结果',
      resultSectionTitle: '本次做饭结果',
      manageButtonText: '去管理菜谱',
      managePagePath: '/pages/recipe-list/recipe-list',
      emptyToast: '没有可用菜谱',
      emptyTitle: '没有可抽取菜谱',
      emptySubtitle: '先去管理页补充菜谱，再回来抽取。',
      recipeActionText: '查看完整菜谱',
      rememberMealType: '午餐',
      recentTagText: '菜谱',
    }
  }

  return {
    drawType: 'choice',
    drawTypeLabel: '选饭',
    pageTitle: '选饭',
    pageSubtitle: '从启用的选饭项里随机抽一个，帮你尽快决定吃什么。',
    rollingSectionTitle: '选饭结果',
    resultSectionTitle: '本次选饭结果',
    manageButtonText: '去管理选项',
    managePagePath: '/pages/choice-list/choice-list',
    emptyToast: '没有可用选项',
    emptyTitle: '没有可抽取选项',
    emptySubtitle: '先去管理页补充选项，再回来抽取。',
    recipeActionText: '',
    rememberMealType: '其他',
    recentTagText: '选项',
  }
}

function getPoolByType(drawType) {
  return drawType === 'recipe' ? getEnabledRecipes() : getEnabledChoices()
}

function buildMealEditUrl(drawRecord, modeConfig) {
  const params = [
    'source=draw',
    `sourceDrawId=${encodeURIComponent(drawRecord.id)}`,
    `foodName=${encodeURIComponent(drawRecord.resultName || '')}`,
    `mealType=${encodeURIComponent(modeConfig.rememberMealType)}`,
  ]

  return `/pages/meal-edit/meal-edit?${params.join('&')}`
}

function decorateDraw(record, recordedSet, modeConfig) {
  const recorded = Boolean(recordedSet[record.id])

  return {
    ...record,
    recorded,
    canRemember: !recorded,
    rememberLabel: recorded ? '已记入' : '记入记录',
    recentTagText: modeConfig.recentTagText,
    exactLabel: formatDateTimeLabel(record.drawnAt),
    timeLabel: formatHumanizedClock(record.drawnAt),
    canOpenDetail: record.drawType === 'recipe',
  }
}

function buildResultCard(record, recordedSet) {
  if (!record) {
    return null
  }

  const recorded = Boolean(recordedSet[record.id])
  let source = null

  if (record.drawType === 'recipe') {
    source = record.snapshot || getRecipeById(record.resultId) || null
  } else {
    source = getChoiceById(record.resultId) || null
  }

  return {
    id: source && source.id ? source.id : record.resultId,
    name: source && source.name ? source.name : record.resultName,
    category: source && source.category ? source.category : '',
    difficulty: source && source.difficulty ? source.difficulty : '',
    durationMinutes: source && source.durationMinutes ? source.durationMinutes : 0,
    note: source && source.note ? source.note : '',
    drawRecordId: record.id,
    recorded,
    canRemember: !recorded,
    rememberLabel: recorded ? '已记入' : '记入记录',
    canOpenDetail: record.drawType === 'recipe',
    exactLabel: formatDateTimeLabel(record.drawnAt),
  }
}

function refreshAppSummary() {
  if (typeof getApp !== 'function') {
    return
  }

  const app = getApp()
  if (app && typeof app.refreshGlobalData === 'function') {
    app.refreshGlobalData()
  }
}

function createDrawPage(drawType) {
  const modeConfig = getModeConfig(drawType)

  return {
    data: {
      ...modeConfig,
      canDraw: false,
      isRolling: false,
      rollingWindow: [],
      rollingHint: '点击开始抽取',
      resultCard: null,
      recentDraws: [],
    },

    onLoad() {
      this.rollingTimeout = null
      this.loadState()
    },

    onShow() {
      this.loadState()
    },

    onHide() {
      this.stopRolling()
    },

    onUnload() {
      this.stopRolling()
    },

    stopRolling() {
      if (this.rollingTimeout) {
        clearTimeout(this.rollingTimeout)
        this.rollingTimeout = null
      }
    },

    loadState() {
      const pool = getPoolByType(this.data.drawType)
      const recordedSet = getRecordedDrawIdSet()
      const lastDraw = getLastDrawResult(this.data.drawType)

      this.setData({
        canDraw: pool.length > 0,
        rollingWindow: pool.length ? buildRollingWindow(pool, 0) : [],
        rollingHint: pool.length ? '准备好了，按下开始抽取' : '先去管理页补充可用内容',
        resultCard: buildResultCard(lastDraw, recordedSet),
        recentDraws: getRecentDrawHistory(10, this.data.drawType).map(item => decorateDraw(item, recordedSet, modeConfig)),
      })

      refreshAppSummary()
    },

    startDraw() {
      if (this.data.isRolling) {
        return
      }

      const pool = pickEnabledItems(getPoolByType(this.data.drawType))
      if (!pool.length) {
        toast(modeConfig.emptyToast)
        return
      }

      const finalItem = pickRandomItem(pool)
      const frames = buildRollingFrames(pool, finalItem)

      this.stopRolling()
      this.setData({
        isRolling: true,
        resultCard: null,
        rollingHint: '正在抽取...',
        rollingWindow: buildRollingWindow(pool, 0),
      })

      let frameIndex = 0
      const playFrame = () => {
        const frame = frames[Math.min(frameIndex, frames.length - 1)]

        this.setData({
          rollingWindow: buildRollingWindow(pool, frame.centerIndex),
        })

        if (frameIndex >= frames.length - 1) {
          this.stopRolling()
          const drawResult = recordDraw(finalItem, this.data.drawType)
          const recordedSet = getRecordedDrawIdSet()

          this.setData({
            isRolling: false,
            rollingHint: '抽取完成',
            rollingWindow: buildRollingWindow(pool, pool.indexOf(finalItem)),
            resultCard: buildResultCard(drawResult.data, recordedSet),
            recentDraws: getRecentDrawHistory(10, this.data.drawType).map(item => decorateDraw(item, recordedSet, modeConfig)),
          })

          refreshAppSummary()
          return
        }

        frameIndex += 1
        this.rollingTimeout = setTimeout(playFrame, frame.delay)
      }

      this.rollingTimeout = setTimeout(playFrame, frames[0].delay)
    },

    drawAgain() {
      this.startDraw()
    },

    discardAndDrawAgain() {
      const resultCard = this.data.resultCard
      if (resultCard && resultCard.drawRecordId) {
        const result = deleteDrawRecord(resultCard.drawRecordId)
        if (!result.ok) {
          toast(result.message)
          return
        }

        this.setData({
          resultCard: null,
          recentDraws: getRecentDrawHistory(10, this.data.drawType).map(item => decorateDraw(item, getRecordedDrawIdSet(), modeConfig)),
        })
      }

      this.startDraw()
    },

    goManage() {
      navigateTo(this.data.managePagePath)
    },

    goDrawHistory() {
      navigateTo(`/pages/draw-history/draw-history?filter=${this.data.drawType}`)
    },

    rememberDraw(e) {
      const drawId = e.currentTarget.dataset.id
      const drawRecord = getDrawRecordById(drawId)

      if (!drawRecord) {
        toast('抽取记录不存在')
        return
      }

      if (isDrawRecorded(drawId)) {
        toast('这条抽取结果已经记入过记录了')
        return
      }

      navigateTo(buildMealEditUrl(drawRecord, modeConfig))
    },

    async removeRecentDraw(e) {
      const drawId = e.currentTarget.dataset.id
      const drawName = e.currentTarget.dataset.name
      const confirmed = await confirmModal({
        title: '删除抽取记录',
        content: `确认删除“${drawName}”这条抽取记录吗？`,
        confirmText: '删除',
      })

      if (!confirmed) {
        return
      }

      const result = deleteDrawRecord(drawId)
      if (!result.ok) {
        toast(result.message)
        return
      }

      toast('已删除')
      this.loadState()
    },

    openRecipeDetail(e) {
      const drawId = e.currentTarget.dataset.drawId
      if (drawId) {
        navigateTo(`/pages/recipe-detail/recipe-detail?drawId=${drawId}`)
      }
    },
  }
}

module.exports = {
  createDrawPage,
}
