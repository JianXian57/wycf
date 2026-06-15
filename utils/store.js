const { clone, hasStorageKey, readStorage, removeStorage, writeStorage } = require('./storage')
const { createId } = require('./id')
const { createDefaultChoices, createDefaultRecipes } = require('./default-data')
const {
  MEAL_TYPES,
  normalizeBoolean,
  normalizeChoiceList,
  normalizeDrawRecordList,
  normalizeMealRecordList,
  normalizeMeta,
  normalizePositiveInteger,
  normalizeRecipeItem,
  normalizeRecipeList,
  normalizeTimestamp,
  trimText,
  validateChoiceDraft,
  validateMealDraft,
  validateRecipeDraft,
} = require('./validators')
const { sortByTimestampDesc } = require('./time')

const SCHEMA_VERSION = 3
const STORAGE_KEYS = {
  META: 'meal_decider_meta',
  CHOICES: 'meal_decider_choices',
  RECIPES: 'meal_decider_recipes',
  DRAW_HISTORY: 'meal_decider_draw_history',
  MEAL_RECORDS: 'meal_decider_meal_records',
}

function now() {
  return Date.now()
}

function writeState(state) {
  const metaOk = writeStorage(STORAGE_KEYS.META, state.meta)
  const choicesOk = writeStorage(STORAGE_KEYS.CHOICES, state.choices)
  const recipesOk = writeStorage(STORAGE_KEYS.RECIPES, state.recipes)
  const drawHistoryOk = writeStorage(STORAGE_KEYS.DRAW_HISTORY, state.drawHistory)
  const mealRecordsOk = writeStorage(STORAGE_KEYS.MEAL_RECORDS, state.mealRecords)

  return metaOk && choicesOk && recipesOk && drawHistoryOk && mealRecordsOk
}

function createBaseMeta(timestamp) {
  const current = normalizeTimestamp(timestamp, now())
  return {
    initialized: true,
    schemaVersion: SCHEMA_VERSION,
    seededAt: 0,
    clearedAt: 0,
    updatedAt: current,
    lastResultDrawIds: {
      choice: '',
      recipe: '',
    },
  }
}

function createDefaultState(timestamp) {
  const current = normalizeTimestamp(timestamp, now())
  const meta = createBaseMeta(current)
  meta.seededAt = current

  return {
    meta,
    choices: createDefaultChoices(current),
    recipes: createDefaultRecipes(current),
    drawHistory: [],
    mealRecords: [],
  }
}

function createEmptyState(timestamp) {
  const current = normalizeTimestamp(timestamp, now())
  const meta = createBaseMeta(current)
  meta.clearedAt = current

  return {
    meta,
    choices: [],
    recipes: [],
    drawHistory: [],
    mealRecords: [],
  }
}

function readRawState() {
  return {
    meta: readStorage(STORAGE_KEYS.META, null),
    choices: readStorage(STORAGE_KEYS.CHOICES, []),
    recipes: readStorage(STORAGE_KEYS.RECIPES, []),
    drawHistory: readStorage(STORAGE_KEYS.DRAW_HISTORY, []),
    mealRecords: readStorage(STORAGE_KEYS.MEAL_RECORDS, []),
  }
}

function hasMeta(meta) {
  return meta && typeof meta === 'object' && meta.initialized
}

function hasAnyPersistedData() {
  return hasStorageKey(STORAGE_KEYS.META)
    || hasStorageKey(STORAGE_KEYS.CHOICES)
    || hasStorageKey(STORAGE_KEYS.RECIPES)
    || hasStorageKey(STORAGE_KEYS.DRAW_HISTORY)
    || hasStorageKey(STORAGE_KEYS.MEAL_RECORDS)
}

function sortDrawHistoryByTime(list) {
  return sortByTimestampDesc(list, item => item.drawnAt)
}

function sortMealRecordsByTime(list) {
  return sortByTimestampDesc(list, item => item.eatenAt)
}

function pickLatestDrawId(drawHistory, drawType) {
  const item = sortDrawHistoryByTime(drawHistory).find(record => record.drawType === drawType)
  return item ? item.id : ''
}

function buildDrawHistoryMap(drawHistory) {
  const result = Object.create(null)

  drawHistory.forEach(item => {
    result[item.id] = item
  })

  return result
}

function inferMealSourceType(record, drawHistoryMap) {
  if (record.sourceType === 'choice' || record.sourceType === 'recipe' || record.sourceType === 'manual') {
    return record.sourceType
  }

  const drawRecord = record.sourceDrawId ? drawHistoryMap[record.sourceDrawId] : null
  if (drawRecord && (drawRecord.drawType === 'choice' || drawRecord.drawType === 'recipe')) {
    return drawRecord.drawType
  }

  return 'manual'
}

function syncMetaReferences(state) {
  const nextState = {
    meta: normalizeMeta(state.meta),
    choices: normalizeChoiceList(state.choices),
    recipes: normalizeRecipeList(state.recipes),
    drawHistory: normalizeDrawRecordList(state.drawHistory),
    mealRecords: normalizeMealRecordList(state.mealRecords),
  }
  const recentDraws = sortDrawHistoryByTime(nextState.drawHistory)
  const drawIdMap = buildDrawHistoryMap(recentDraws)

  nextState.mealRecords = nextState.mealRecords.map(item => ({
    ...item,
    sourceType: inferMealSourceType(item, drawIdMap),
  }))

  const choiceId = trimText(nextState.meta.lastResultDrawIds.choice)
  const recipeId = trimText(nextState.meta.lastResultDrawIds.recipe)

  nextState.meta.lastResultDrawIds.choice = drawIdMap[choiceId] && drawIdMap[choiceId].drawType === 'choice'
    ? choiceId
    : pickLatestDrawId(recentDraws, 'choice')
  nextState.meta.lastResultDrawIds.recipe = drawIdMap[recipeId] && drawIdMap[recipeId].drawType === 'recipe'
    ? recipeId
    : pickLatestDrawId(recentDraws, 'recipe')

  return nextState
}

function normalizeState(rawState) {
  return syncMetaReferences({
    meta: normalizeMeta(rawState.meta),
    choices: normalizeChoiceList(rawState.choices),
    recipes: normalizeRecipeList(rawState.recipes),
    drawHistory: normalizeDrawRecordList(rawState.drawHistory),
    mealRecords: normalizeMealRecordList(rawState.mealRecords),
  })
}

function needsStateMigration(rawState, normalizedState) {
  const rawMeta = rawState && rawState.meta

  if (!hasMeta(rawMeta)) {
    return true
  }

  if (normalizePositiveInteger(rawMeta.schemaVersion, 1) < SCHEMA_VERSION) {
    return true
  }

  if (!rawMeta.lastResultDrawIds || typeof rawMeta.lastResultDrawIds !== 'object') {
    return true
  }

  const rawMeals = Array.isArray(rawState.mealRecords) ? rawState.mealRecords : []
  if (rawMeals.some(item => !item || typeof item !== 'object' || typeof item.sourceDrawId !== 'string' || typeof item.sourceType !== 'string')) {
    return true
  }

  return JSON.stringify(rawMeta.lastResultDrawIds) !== JSON.stringify(normalizedState.meta.lastResultDrawIds)
}

function getState() {
  const raw = readRawState()

  if (!hasMeta(raw.meta)) {
    if (!hasAnyPersistedData()) {
      const defaultState = createDefaultState(now())
      writeState(defaultState)
      return clone(defaultState)
    }

    const repairedState = normalizeState(raw)
    repairedState.meta.schemaVersion = SCHEMA_VERSION
    repairedState.meta.updatedAt = now()
    writeState(repairedState)
    return clone(repairedState)
  }

  const state = normalizeState(raw)
  state.meta.schemaVersion = SCHEMA_VERSION

  if (needsStateMigration(raw, state)) {
    state.meta.updatedAt = now()
    writeState(state)
  }

  return clone(state)
}

function persistState(state) {
  const nextState = syncMetaReferences(state)
  nextState.meta.initialized = true
  nextState.meta.schemaVersion = SCHEMA_VERSION
  nextState.meta.updatedAt = now()
  writeState(nextState)
  return clone(nextState)
}

function bootstrapDefaultData() {
  const state = createDefaultState(now())
  writeState(state)
  return {
    ok: true,
    data: clone(state),
  }
}

function restoreDefaultData() {
  const state = createDefaultState(now())
  writeState(state)
  return {
    ok: true,
    data: clone(state),
  }
}

function clearAllData() {
  const state = createEmptyState(now())
  writeState(state)
  return {
    ok: true,
    data: clone(state),
  }
}

function setChoices(list) {
  const state = getState()
  state.choices = normalizeChoiceList(list)
  return persistState(state)
}

function setRecipes(list) {
  const state = getState()
  state.recipes = normalizeRecipeList(list)
  return persistState(state)
}

function setDrawHistory(list) {
  const state = getState()
  state.drawHistory = normalizeDrawRecordList(list)
  return persistState(state)
}

function setMealRecords(list) {
  const state = getState()
  state.mealRecords = normalizeMealRecordList(list)
  return persistState(state)
}

function getChoiceById(id) {
  const state = getState()
  return state.choices.find(item => item.id === id) || null
}

function getRecipeById(id) {
  const state = getState()
  return state.recipes.find(item => item.id === id) || null
}

function getDrawRecordById(id) {
  const state = getState()
  return state.drawHistory.find(item => item.id === id) || null
}

function getMealRecordById(id) {
  const state = getState()
  return state.mealRecords.find(item => item.id === id) || null
}

function getMealRecordBySourceDrawId(drawId, excludeMealId) {
  const sourceDrawId = trimText(drawId)
  const excludedId = trimText(excludeMealId)

  if (!sourceDrawId) {
    return null
  }

  const state = getState()
  return state.mealRecords.find(item => item.sourceDrawId === sourceDrawId && item.id !== excludedId) || null
}

function getRecordedDrawIdSet() {
  const state = getState()
  const result = Object.create(null)

  state.mealRecords.forEach(item => {
    if (item.sourceDrawId) {
      result[item.sourceDrawId] = true
    }
  })

  return result
}

function isDrawRecorded(drawId) {
  const sourceDrawId = trimText(drawId)
  if (!sourceDrawId) {
    return false
  }

  return Boolean(getRecordedDrawIdSet()[sourceDrawId])
}

function getEnabledChoices() {
  return getState().choices.filter(item => item.enabled !== false)
}

function getEnabledRecipes() {
  return getState().recipes.filter(item => item.enabled !== false)
}

function filterDrawHistory(list, drawType) {
  if (drawType !== 'choice' && drawType !== 'recipe') {
    return list
  }

  return list.filter(item => item.drawType === drawType)
}

function getRecentDrawHistory(limit, drawType) {
  const state = getState()
  const size = normalizePositiveInteger(limit, 10)
  return filterDrawHistory(sortDrawHistoryByTime(state.drawHistory), drawType).slice(0, size)
}

function getDisplayDrawHistory(drawType) {
  return filterDrawHistory(sortDrawHistoryByTime(getState().drawHistory), drawType)
}

function getRecentMealRecords(limit) {
  const state = getState()
  const size = normalizePositiveInteger(limit, 20)
  return sortMealRecordsByTime(state.mealRecords).slice(0, size)
}

function getDisplayChoices() {
  return sortByTimestampDesc(getState().choices, item => item.updatedAt)
}

function getDisplayRecipes() {
  return sortByTimestampDesc(getState().recipes, item => item.updatedAt)
}

function getDisplayMealRecords() {
  return sortMealRecordsByTime(getState().mealRecords)
}

function getLastDrawResult(drawType) {
  const normalizedDrawType = drawType === 'recipe' ? 'recipe' : 'choice'
  const state = getState()
  const lastId = trimText(state.meta.lastResultDrawIds[normalizedDrawType])
  const byId = lastId
    ? state.drawHistory.find(item => item.id === lastId && item.drawType === normalizedDrawType)
    : null

  if (byId) {
    return byId
  }

  return sortDrawHistoryByTime(state.drawHistory).find(item => item.drawType === normalizedDrawType) || null
}

function getSummary() {
  const state = getState()
  return {
    choiceTotal: state.choices.length,
    choiceEnabledTotal: state.choices.filter(item => item.enabled !== false).length,
    recipeTotal: state.recipes.length,
    recipeEnabledTotal: state.recipes.filter(item => item.enabled !== false).length,
    drawHistoryTotal: state.drawHistory.length,
    mealRecordsTotal: state.mealRecords.length,
    meta: clone(state.meta),
  }
}

function saveChoiceDraft(draft) {
  const validation = validateChoiceDraft(draft)
  if (!validation.ok) {
    return validation
  }

  const state = getState()
  const currentId = trimText(draft && draft.id)
  const timestamp = now()

  if (currentId) {
    const index = state.choices.findIndex(item => item.id === currentId)
    if (index < 0) {
      return {
        ok: false,
        message: '要编辑的选项不存在',
      }
    }

    const current = state.choices[index]
    state.choices[index] = {
      ...current,
      name: validation.data.name,
      enabled: validation.data.enabled,
      category: validation.data.category,
      weight: validation.data.weight,
      updatedAt: timestamp,
    }
  } else {
    state.choices.unshift({
      id: createId('choice'),
      name: validation.data.name,
      enabled: validation.data.enabled,
      category: validation.data.category,
      weight: validation.data.weight,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  persistState(state)
  return {
    ok: true,
    data: clone(currentId ? state.choices.find(item => item.id === currentId) : state.choices[0]),
  }
}

function toggleChoiceEnabled(id, enabled) {
  const state = getState()
  const index = state.choices.findIndex(item => item.id === id)
  if (index < 0) {
    return {
      ok: false,
      message: '选项不存在',
    }
  }

  state.choices[index] = {
    ...state.choices[index],
    enabled: normalizeBoolean(enabled, !state.choices[index].enabled),
    updatedAt: now(),
  }

  persistState(state)
  return {
    ok: true,
    data: clone(state.choices[index]),
  }
}

function deleteChoice(id) {
  const state = getState()
  const nextChoices = state.choices.filter(item => item.id !== id)

  if (nextChoices.length === state.choices.length) {
    return {
      ok: false,
      message: '选项不存在',
    }
  }

  state.choices = nextChoices
  persistState(state)
  return {
    ok: true,
    data: true,
  }
}

function saveRecipeDraft(draft) {
  const validation = validateRecipeDraft(draft)
  if (!validation.ok) {
    return validation
  }

  const state = getState()
  const currentId = trimText(draft && draft.id)
  const timestamp = now()

  if (currentId) {
    const index = state.recipes.findIndex(item => item.id === currentId)
    if (index < 0) {
      return {
        ok: false,
        message: '要编辑的菜谱不存在',
      }
    }

    const current = state.recipes[index]
    state.recipes[index] = {
      ...current,
      name: validation.data.name,
      category: validation.data.category,
      ingredients: validation.data.ingredients,
      steps: validation.data.steps,
      durationMinutes: validation.data.durationMinutes,
      difficulty: validation.data.difficulty,
      note: validation.data.note,
      enabled: validation.data.enabled,
      weight: validation.data.weight,
      updatedAt: timestamp,
    }
  } else {
    state.recipes.unshift({
      id: createId('recipe'),
      name: validation.data.name,
      category: validation.data.category,
      ingredients: validation.data.ingredients,
      steps: validation.data.steps,
      durationMinutes: validation.data.durationMinutes,
      difficulty: validation.data.difficulty,
      note: validation.data.note,
      enabled: validation.data.enabled,
      weight: validation.data.weight,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  persistState(state)
  return {
    ok: true,
    data: clone(currentId ? state.recipes.find(item => item.id === currentId) : state.recipes[0]),
  }
}

function toggleRecipeEnabled(id, enabled) {
  const state = getState()
  const index = state.recipes.findIndex(item => item.id === id)
  if (index < 0) {
    return {
      ok: false,
      message: '菜谱不存在',
    }
  }

  state.recipes[index] = {
    ...state.recipes[index],
    enabled: normalizeBoolean(enabled, !state.recipes[index].enabled),
    updatedAt: now(),
  }

  persistState(state)
  return {
    ok: true,
    data: clone(state.recipes[index]),
  }
}

function deleteRecipe(id) {
  const state = getState()
  const nextRecipes = state.recipes.filter(item => item.id !== id)

  if (nextRecipes.length === state.recipes.length) {
    return {
      ok: false,
      message: '菜谱不存在',
    }
  }

  state.recipes = nextRecipes
  persistState(state)
  return {
    ok: true,
    data: true,
  }
}

function saveMealRecordDraft(draft) {
  const validation = validateMealDraft(draft)
  if (!validation.ok) {
    return validation
  }

  const state = getState()
  const currentId = trimText(draft && draft.id)
  const timestamp = now()
  const duplicate = validation.data.sourceDrawId
    ? state.mealRecords.find(item => item.sourceDrawId === validation.data.sourceDrawId && item.id !== currentId)
    : null

  if (duplicate) {
    return {
      ok: false,
      message: '这条抽取结果已经记入过记录了',
    }
  }

  const sourceType = validation.data.sourceDrawId
    ? (state.drawHistory.find(item => item.id === validation.data.sourceDrawId) || {}).drawType || validation.data.sourceType || 'manual'
    : 'manual'

  if (currentId) {
    const index = state.mealRecords.findIndex(item => item.id === currentId)
    if (index < 0) {
      return {
        ok: false,
        message: '要编辑的记录不存在',
      }
    }

    const current = state.mealRecords[index]
    state.mealRecords[index] = {
      ...current,
      mealType: validation.data.mealType,
      foodName: validation.data.foodName,
      note: validation.data.note,
      eatenAt: validation.data.eatenAt,
      sourceDrawId: validation.data.sourceDrawId || current.sourceDrawId || '',
      sourceType: validation.data.sourceDrawId ? sourceType : 'manual',
      updatedAt: timestamp,
    }
  } else {
    state.mealRecords.unshift({
      id: createId('meal'),
      eatenAt: validation.data.eatenAt,
      mealType: validation.data.mealType,
      foodName: validation.data.foodName,
      note: validation.data.note,
      sourceDrawId: validation.data.sourceDrawId,
      sourceType: validation.data.sourceDrawId ? sourceType : 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  persistState(state)
  return {
    ok: true,
    data: clone(currentId ? state.mealRecords.find(item => item.id === currentId) : state.mealRecords[0]),
  }
}

function deleteMealRecord(id) {
  const state = getState()
  const nextRecords = state.mealRecords.filter(item => item.id !== id)

  if (nextRecords.length === state.mealRecords.length) {
    return {
      ok: false,
      message: '记录不存在',
    }
  }

  state.mealRecords = nextRecords
  persistState(state)
  return {
    ok: true,
    data: true,
  }
}

function recordDraw(result, drawType) {
  const state = getState()
  const timestamp = now()
  const normalizedDrawType = drawType === 'recipe' ? 'recipe' : 'choice'
  const snapshot = normalizedDrawType === 'recipe'
    ? clone(normalizeRecipeItem(result))
    : null

  const drawRecord = {
    id: createId('draw'),
    drawType: normalizedDrawType,
    resultId: trimText(result && result.id) || createId(normalizedDrawType),
    resultName: trimText(result && result.name) || '未知结果',
    snapshot,
    drawnAt: timestamp,
  }

  state.drawHistory.unshift(drawRecord)
  state.meta.lastResultDrawIds[normalizedDrawType] = drawRecord.id
  persistState(state)

  return {
    ok: true,
    data: clone(drawRecord),
  }
}

function deleteDrawRecord(id) {
  const state = getState()
  const targetId = trimText(id)
  const target = state.drawHistory.find(item => item.id === targetId)
  const nextDrawHistory = state.drawHistory.filter(item => item.id !== targetId)

  if (nextDrawHistory.length === state.drawHistory.length) {
    return {
      ok: false,
      message: '抽取记录不存在',
    }
  }

  state.drawHistory = nextDrawHistory
  if (target) {
    const fallbackId = pickLatestDrawId(nextDrawHistory, target.drawType)
    if (state.meta.lastResultDrawIds[target.drawType] === targetId) {
      state.meta.lastResultDrawIds[target.drawType] = fallbackId
    }
  }

  persistState(state)
  return {
    ok: true,
    data: true,
  }
}

module.exports = {
  STORAGE_KEYS,
  SCHEMA_VERSION,
  MEAL_TYPES,
  bootstrapDefaultData,
  clearAllData,
  createEmptyState,
  createDefaultState,
  deleteChoice,
  deleteDrawRecord,
  deleteMealRecord,
  deleteRecipe,
  getChoiceById,
  getDisplayChoices,
  getDisplayDrawHistory,
  getDisplayMealRecords,
  getDisplayRecipes,
  getDrawRecordById,
  getEnabledChoices,
  getEnabledRecipes,
  getLastDrawResult,
  getMealRecordById,
  getMealRecordBySourceDrawId,
  getRecipeById,
  getRecentDrawHistory,
  getRecentMealRecords,
  getRecordedDrawIdSet,
  getState,
  getSummary,
  isDrawRecorded,
  recordDraw,
  removeStorageKey: removeStorage,
  restoreDefaultData,
  saveChoiceDraft,
  saveMealRecordDraft,
  saveRecipeDraft,
  setChoices,
  setDrawHistory,
  setMealRecords,
  setRecipes,
  toggleChoiceEnabled,
  toggleRecipeEnabled,
  validateChoiceDraft,
  validateMealDraft,
  validateRecipeDraft,
}
