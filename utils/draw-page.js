const { pickEnabledItems, pickRandomItem } = require('./random')
const {
  clearCurrentPendingDraw,
  deleteDrawRecord,
  getChoiceById,
  getCurrentPendingDraw,
  getDrawRecordById,
  getEnabledChoices,
  getEnabledRecipes,
  getRecentDrawHistory,
  getRecordedDrawIdSet,
  getRecipeById,
  isDrawRecorded,
  recordDraw,
} = require('./store')
const { formatDateTimeLabel, formatHumanizedClock } = require('./time')
const { confirmModal, navigateTo, toast } = require('./ui')

const RESULT_STATES = {
  IDLE: 'idle',
  ANIMATING: 'animating',
  PENDING: 'pending',
  NAVIGATING: 'navigating',
  COMPLETED: 'completed',
}

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
  }
}

function getPoolByType(drawType) {
  return drawType === 'recipe' ? getEnabledRecipes() : getEnabledChoices()
}

function buildMealEditUrl(drawRecord, modeConfig, flowAction) {
  const params = [
    'source=draw',
    `drawId=${drawRecord.id}`,
    `mealType=${modeConfig.rememberMealType}`,
    `flowAction=${flowAction}`,
  ]

  return `/pages/meal-edit/meal-edit?${params.join('&')}`
}

function decorateDraw(record, recordedSet) {
  const recorded = Boolean(recordedSet[record.id])

  return {
    ...record,
    recorded,
    canRemember: !recorded,
    rememberLabel: recorded ? '已记入' : '记入记录',
    statusLabel: recorded ? '已记录' : '未记录',
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
    statusLabel: recorded ? '已记录' : '未记录',
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

function showResultHelp() {
  if (typeof wx !== 'undefined' && wx && typeof wx.showModal === 'function') {
    wx.showModal({
      title: '结果说明',
      content: [
        '好，就吃这个，记下来！',
        '创建吃饭记录，保留本次抽取历史，不再继续抽取。',
        '',
        '不算，再抽一次！',
        '删除本次抽取历史，不创建吃饭记录，并重新抽取。',
        '',
        '暂记一下，再抽个别的吧~',
        '保留本次抽取历史作为备选，不创建吃饭记录，并重新抽取。',
        '',
        '算了，不抽了~',
        '删除本次抽取历史，不创建吃饭记录，也不再抽取。',
      ].join('\n'),
      showCancel: false,
      confirmText: '知道了',
    })
  }
}

function createDrawPage(drawType) {
  const modeConfig = getModeConfig(drawType)

  return {
    data: {
      ...modeConfig,
      canDraw: false,
      resultState: RESULT_STATES.IDLE,
      currentDrawId: '',
      rollingWindow: [],
      rollingHint: '点击开始抽取',
      resultCard: null,
      recentDraws: [],
    },

    onLoad() {
      this.rollingTimeout = null
      this.pendingMealFlow = null
      this.loadState()
    },

    onShow() {
      const pending = this.pendingMealFlow
      this.pendingMealFlow = null
      this.loadState()

      if (!pending || pending.sourceDrawId !== this.data.currentDrawId) {
        return
      }

      if (pending.status === 'saved' && pending.flowAction === 'save_only') {
        this.completeCurrentResult({ clearResult: true, startNextDraw: false })
      }
    },

    onHide() {
      this.stopRolling()
      if (this.data.resultState === RESULT_STATES.ANIMATING) {
        this.setData({ resultState: RESULT_STATES.IDLE })
      }
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

    setResultState(nextState) {
      this.setData({
        resultState: nextState,
      })
    },

    canOperateCurrentResult(expectedDrawId) {
      return this.data.resultState === RESULT_STATES.PENDING
        && Boolean(this.data.currentDrawId)
        && !(this.data.resultCard && this.data.resultCard.recorded)
        && (!expectedDrawId || expectedDrawId === this.data.currentDrawId)
    },

    loadState() {
      const pool = getPoolByType(this.data.drawType)
      const recordedSet = getRecordedDrawIdSet()
      let pendingDraw = getCurrentPendingDraw(this.data.drawType)

      if (pendingDraw && recordedSet[pendingDraw.id]) {
        clearCurrentPendingDraw(this.data.drawType)
        pendingDraw = null
      }

      const resultCard = buildResultCard(pendingDraw, recordedSet)

      this.setData({
        canDraw: pool.length > 0,
        rollingWindow: pool.length ? buildRollingWindow(pool, 0) : [],
        rollingHint: pool.length ? '准备好了，按下开始抽取' : '先去管理页补充可用内容',
        resultCard,
        currentDrawId: resultCard ? resultCard.drawRecordId : '',
        resultState: resultCard ? RESULT_STATES.PENDING : RESULT_STATES.IDLE,
        recentDraws: getRecentDrawHistory(10, this.data.drawType).map(item => decorateDraw(item, recordedSet)),
      })

      refreshAppSummary()
    },

    startDraw() {
      if (this.data.resultState !== RESULT_STATES.IDLE) {
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
        resultState: RESULT_STATES.ANIMATING,
        resultCard: null,
        currentDrawId: '',
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
            resultState: RESULT_STATES.PENDING,
            currentDrawId: drawResult.data.id,
            rollingHint: '抽取完成',
            rollingWindow: buildRollingWindow(pool, pool.indexOf(finalItem)),
            resultCard: buildResultCard(drawResult.data, recordedSet),
            recentDraws: getRecentDrawHistory(10, this.data.drawType).map(item => decorateDraw(item, recordedSet)),
          })

          refreshAppSummary()
          return
        }

        frameIndex += 1
        this.rollingTimeout = setTimeout(playFrame, frame.delay)
      }

      this.rollingTimeout = setTimeout(playFrame, frames[0].delay)
    },

    showResultGuide() {
      showResultHelp()
    },

    completeCurrentResult(options) {
      const config = options || {}
      const currentDrawId = this.data.currentDrawId

      this.setData({
        resultState: RESULT_STATES.COMPLETED,
      })

      if (config.clearResult && currentDrawId) {
        clearCurrentPendingDraw(this.data.drawType)
      } else if (config.clearPending && currentDrawId) {
        clearCurrentPendingDraw(this.data.drawType)
      }

      this.setData({
        resultCard: config.clearResult ? null : this.data.resultCard,
        currentDrawId: config.clearResult || config.clearPending ? '' : currentDrawId,
      })

      if (config.startNextDraw) {
        this.setData({
          resultState: RESULT_STATES.IDLE,
        })
        this.startDraw()
        return
      }

      this.loadState()
    },

    rememberAndStop() {
      this.openMealEditor('save_only')
    },

    keepAndRedraw() {
      if (!this.canOperateCurrentResult()) {
        return
      }

      this.completeCurrentResult({
        clearResult: false,
        clearPending: true,
        startNextDraw: true,
      })
    },

    openMealEditor(flowAction) {
      if (!this.canOperateCurrentResult()) {
        return
      }

      const resultCard = this.data.resultCard
      const drawRecord = resultCard ? getDrawRecordById(resultCard.drawRecordId) : null
      if (!drawRecord) {
        toast('抽取记录不存在')
        this.loadState()
        return
      }

      if (isDrawRecorded(drawRecord.id)) {
        toast('这条抽取结果已经记入过记录了')
        this.completeCurrentResult({
          clearResult: true,
          startNextDraw: false,
        })
        return
      }

      this.setData({
        resultState: RESULT_STATES.NAVIGATING,
      })
      this.pendingMealFlow = null
      navigateTo(buildMealEditUrl(drawRecord, modeConfig, flowAction))
    },

    redrawWithoutSaving() {
      if (!this.canOperateCurrentResult()) {
        return
      }

      const targetDrawId = this.data.currentDrawId
      const result = deleteDrawRecord(targetDrawId)
      if (!result.ok) {
        toast(result.message)
        this.loadState()
        return
      }

      this.completeCurrentResult({
        clearResult: true,
        startNextDraw: true,
      })
    },

    discardResultCard() {
      if (!this.canOperateCurrentResult()) {
        return
      }

      const targetDrawId = this.data.currentDrawId
      const result = deleteDrawRecord(targetDrawId)
      if (!result.ok) {
        toast(result.message)
        this.loadState()
        return
      }

      this.completeCurrentResult({
        clearResult: true,
        startNextDraw: false,
      })
    },

    goManage() {
      navigateTo(this.data.managePagePath)
    },

    goDrawHistory() {
      navigateTo(`/pages/draw-history/draw-history?filter=${this.data.drawType}`)
    },

    rememberDraw(e) {
      if (this.data.resultState === RESULT_STATES.ANIMATING || this.data.resultState === RESULT_STATES.NAVIGATING || this.data.resultState === RESULT_STATES.COMPLETED) {
        return
      }

      const drawId = e.currentTarget.dataset.id
      const drawRecord = getDrawRecordById(drawId)

      if (!drawRecord) {
        toast('抽取记录不存在')
        return
      }

      if (isDrawRecorded(drawId)) {
        toast('这条抽取结果已经记入过记录了')
        this.loadState()
        return
      }

      navigateTo(buildMealEditUrl(drawRecord, modeConfig, 'save_only'))
    },

    async removeRecentDraw(e) {
      if (this.data.resultState === RESULT_STATES.ANIMATING || this.data.resultState === RESULT_STATES.NAVIGATING || this.data.resultState === RESULT_STATES.COMPLETED) {
        return
      }

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
  RESULT_STATES,
  createDrawPage,
}
