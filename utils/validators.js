const { createId } = require('./id')
const { composeBeijingTimestamp, isValidDateString, isValidTimeString, toTimestamp } = require('./time')

const CHOICE_NAME_MAX_LENGTH = 30
const RECIPE_DIFFICULTIES = ['简单', '普通', '复杂']
const MEAL_TYPES = ['早餐', '早午餐', '午餐', '下午茶', '晚餐', '夜宵', '加餐', '其他']
const MEAL_SOURCE_TYPES = ['choice', 'recipe', 'manual']

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function trimText(value) {
  if (value === undefined || value === null) {
    return ''
  }

  return String(value).trim()
}

function looksLikeEncodedText(value) {
  if (typeof value !== 'string') {
    return false
  }

  if (!/%[0-9A-Fa-f]{2}/.test(value)) {
    return false
  }

  return value.replace(/%[0-9A-Fa-f]{2}/g, '').indexOf('%') < 0
}

function normalizeMaybeEncodedText(value) {
  const text = trimText(value)
  if (!looksLikeEncodedText(text)) {
    return text
  }

  try {
    const decoded = decodeURIComponent(text)
    return decoded && decoded !== text ? decoded : text
  } catch (error) {
    return text
  }
}

function normalizeLines(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => trimText(item))
      .filter(Boolean)
  }

  return trimText(value)
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === 1 || value === '1') {
    return true
  }

  if (value === 0 || value === '0') {
    return false
  }

  return fallback
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const integer = Math.floor(parsed)
  return integer > 0 ? integer : fallback
}

function normalizeTimestamp(value, fallback) {
  return toTimestamp(value, fallback)
}

function pickAllowedValue(value, allowedValues, fallback) {
  const normalized = trimText(value)
  return allowedValues.indexOf(normalized) >= 0 ? normalized : fallback
}

function ok(data) {
  return {
    ok: true,
    data,
  }
}

function fail(message) {
  return {
    ok: false,
    message,
  }
}

function validateChoiceDraft(draft) {
  const name = trimText(draft && draft.name)

  if (!name) {
    return fail('选项名称不能为空')
  }

  if (name.length > CHOICE_NAME_MAX_LENGTH) {
    return fail('选项名称不能超过30个字')
  }

  return ok({
    name: normalizeMaybeEncodedText(name),
    enabled: normalizeBoolean(draft && draft.enabled, true),
    category: normalizeMaybeEncodedText(draft && draft.category),
    weight: normalizePositiveInteger(draft && draft.weight, 1),
  })
}

function validateRecipeDraft(draft) {
  const name = trimText(draft && draft.name)
  const ingredients = normalizeLines(draft && draft.ingredients)
  const steps = normalizeLines(draft && draft.steps)
  const durationMinutes = normalizePositiveInteger(draft && draft.durationMinutes, 0)
  const difficulty = pickAllowedValue(draft && draft.difficulty, RECIPE_DIFFICULTIES, '普通')
  const note = trimText(draft && draft.note)
  const category = trimText(draft && draft.category)

  if (!name) {
    return fail('菜谱名称不能为空')
  }

  if (!ingredients.length) {
    return fail('请至少填写1条食材')
  }

  if (!steps.length) {
    return fail('请至少填写1条步骤')
  }

  if (!durationMinutes) {
    return fail('预计用时必须是正整数')
  }

  return ok({
    name: normalizeMaybeEncodedText(name),
    category: normalizeMaybeEncodedText(category),
    ingredients,
    steps,
    durationMinutes,
    difficulty,
    note: normalizeMaybeEncodedText(note),
    enabled: normalizeBoolean(draft && draft.enabled, true),
    weight: normalizePositiveInteger(draft && draft.weight, 1),
  })
}

function validateMealDraft(draft) {
  const date = trimText(draft && draft.date)
  const time = trimText(draft && draft.time)
  const mealType = pickAllowedValue(draft && draft.mealType, MEAL_TYPES, '')
  const foodName = trimText(draft && draft.foodName)
  const note = trimText(draft && draft.note)
  const sourceDrawId = trimText(draft && draft.sourceDrawId)

  if (!isValidDateString(date) || !isValidTimeString(time)) {
    return fail('日期或时间不合法')
  }

  if (!mealType) {
    return fail('请选择固定餐次')
  }

  if (!foodName) {
    return fail('吃的什么不能为空')
  }

  const eatenAt = composeBeijingTimestamp(date, time)
  if (!Number.isFinite(eatenAt)) {
    return fail('日期或时间不合法')
  }

  return ok({
    date,
    time,
    eatenAt,
    mealType,
    foodName: normalizeMaybeEncodedText(foodName),
    note: trimText(note),
    sourceDrawId,
    sourceType: pickAllowedValue(draft && draft.sourceType, MEAL_SOURCE_TYPES, 'manual'),
  })
}

function normalizeChoiceItem(raw, index) {
  const item = isObject(raw) ? raw : {}
  const fallbackIndex = Number.isFinite(index) ? index + 1 : 1

  return {
    id: trimText(item.id) || createId('choice'),
    name: normalizeMaybeEncodedText(item.name) || `未命名选项${fallbackIndex}`,
    enabled: normalizeBoolean(item.enabled, true),
    category: normalizeMaybeEncodedText(item.category),
    weight: normalizePositiveInteger(item.weight, 1),
    createdAt: normalizeTimestamp(item.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(item.updatedAt, Date.now()),
  }
}

function normalizeRecipeItem(raw, index) {
  const item = isObject(raw) ? raw : {}
  const fallbackIndex = Number.isFinite(index) ? index + 1 : 1
  const ingredients = normalizeLines(item.ingredients)
  const steps = normalizeLines(item.steps)

  return {
    id: trimText(item.id) || createId('recipe'),
    name: normalizeMaybeEncodedText(item.name) || `未命名菜谱${fallbackIndex}`,
    category: normalizeMaybeEncodedText(item.category),
    ingredients: ingredients.length ? ingredients : ['待补充食材'],
    steps: steps.length ? steps : ['待补充步骤'],
    durationMinutes: normalizePositiveInteger(item.durationMinutes, 15),
    difficulty: pickAllowedValue(item.difficulty, RECIPE_DIFFICULTIES, '普通'),
    note: normalizeMaybeEncodedText(item.note),
    enabled: normalizeBoolean(item.enabled, true),
    weight: normalizePositiveInteger(item.weight, 1),
    createdAt: normalizeTimestamp(item.createdAt, Date.now()),
    updatedAt: normalizeTimestamp(item.updatedAt, Date.now()),
  }
}

function normalizeMealRecordItem(raw, index) {
  const item = isObject(raw) ? raw : {}
  const fallbackIndex = Number.isFinite(index) ? index + 1 : 1
  const eatenAt = normalizeTimestamp(item.eatenAt, normalizeTimestamp(item.createdAt, Date.now()))

  return {
    id: trimText(item.id) || createId('meal'),
    eatenAt,
    mealType: pickAllowedValue(item.mealType, MEAL_TYPES, '其他'),
    foodName: normalizeMaybeEncodedText(item.foodName) || `未命名餐食${fallbackIndex}`,
    note: trimText(item.note),
    sourceDrawId: trimText(item.sourceDrawId),
    sourceType: pickAllowedValue(item.sourceType, MEAL_SOURCE_TYPES, ''),
    createdAt: normalizeTimestamp(item.createdAt, eatenAt),
    updatedAt: normalizeTimestamp(item.updatedAt, eatenAt),
  }
}

function normalizeDrawRecordItem(raw, index) {
  const item = isObject(raw) ? raw : {}
  const fallbackIndex = Number.isFinite(index) ? index + 1 : 1
  const drawType = item.drawType === 'recipe' ? 'recipe' : 'choice'
  const snapshot = drawType === 'recipe' ? normalizeRecipeItem(item.snapshot, fallbackIndex) : null
  const drawnAt = normalizeTimestamp(item.drawnAt, Date.now())

  return {
    id: trimText(item.id) || createId('draw'),
    drawType,
    resultId: trimText(item.resultId) || (snapshot ? snapshot.id : createId(drawType)),
    resultName: normalizeMaybeEncodedText(item.resultName) || (snapshot ? snapshot.name : '未知结果'),
    snapshot,
    drawnAt,
  }
}

function normalizeChoiceList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map(normalizeChoiceItem)
}

function normalizeRecipeList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map(normalizeRecipeItem)
}

function normalizeMealRecordList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map(normalizeMealRecordItem)
}

function normalizeDrawRecordList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map(normalizeDrawRecordItem)
}

function normalizeMeta(raw) {
  const meta = isObject(raw) ? raw : {}
  const lastResultDrawIds = isObject(meta.lastResultDrawIds) ? meta.lastResultDrawIds : {}
  const currentPendingDrawIds = isObject(meta.currentPendingDrawIds) ? meta.currentPendingDrawIds : {}

  return {
    initialized: true,
    schemaVersion: normalizePositiveInteger(meta.schemaVersion, 1),
    seededAt: normalizeTimestamp(meta.seededAt, 0),
    clearedAt: normalizeTimestamp(meta.clearedAt, 0),
    updatedAt: normalizeTimestamp(meta.updatedAt, Date.now()),
    lastResultDrawIds: {
      choice: trimText(lastResultDrawIds.choice),
      recipe: trimText(lastResultDrawIds.recipe),
    },
    currentPendingDrawIds: {
      choice: trimText(currentPendingDrawIds.choice),
      recipe: trimText(currentPendingDrawIds.recipe),
    },
  }
}

module.exports = {
  CHOICE_NAME_MAX_LENGTH,
  MEAL_TYPES,
  MEAL_SOURCE_TYPES,
  RECIPE_DIFFICULTIES,
  fail,
  looksLikeEncodedText,
  normalizeBoolean,
  normalizeChoiceItem,
  normalizeChoiceList,
  normalizeDrawRecordItem,
  normalizeDrawRecordList,
  normalizeLines,
  normalizeMaybeEncodedText,
  normalizeMealRecordItem,
  normalizeMealRecordList,
  normalizeMeta,
  normalizePositiveInteger,
  normalizeRecipeItem,
  normalizeRecipeList,
  normalizeTimestamp,
  ok,
  pickAllowedValue,
  trimText,
  validateChoiceDraft,
  validateMealDraft,
  validateRecipeDraft,
}
