const assert = require('assert')

const {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  bootstrapDefaultData,
  clearAllData,
  deleteDrawRecord,
  deleteMealRecord,
  getDisplayDrawHistory,
  getDisplayMealRecords,
  getLastDrawResult,
  getRecentDrawHistory,
  getState,
  isDrawRecorded,
  recordDraw,
  saveChoiceDraft,
  saveMealRecordDraft,
  saveRecipeDraft,
} = require('../utils/store')
const { pickEnabledItems, pickRandomItem } = require('../utils/random')
const {
  composeBeijingTimestamp,
  formatHumanizedClock,
  groupByBeijingDate,
  isValidDateString,
  isValidTimeString,
  splitBeijingTimestamp,
} = require('../utils/time')
const { looksLikeEncodedText, normalizeMaybeEncodedText } = require('../utils/validators')
const { readStorage, resetMemoryStorage, writeStorage } = require('../utils/storage')

function testMigration() {
  resetMemoryStorage()
  writeStorage(STORAGE_KEYS.META, {
    initialized: true,
    schemaVersion: 2,
    seededAt: 1,
    clearedAt: 0,
    updatedAt: 1,
    lastResultDrawIds: {
      choice: 'draw_choice_legacy',
      recipe: 'draw_recipe_legacy',
    },
  })
  writeStorage(STORAGE_KEYS.CHOICES, [
    {
      id: 'choice_legacy',
      name: '%E9%A3%9F%E5%A0%82',
      enabled: true,
      category: '',
      weight: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  ])
  writeStorage(STORAGE_KEYS.RECIPES, [
    {
      id: 'recipe_legacy',
      name: '%E8%A5%BF%E7%BA%A2%E6%9F%BF%E7%82%92%E9%B8%A1%E8%9B%8B',
      category: '家常菜',
      ingredients: ['番茄', '鸡蛋'],
      steps: ['切番茄', '炒鸡蛋'],
      durationMinutes: 10,
      difficulty: '简单',
      note: '',
      enabled: true,
      createdAt: 1,
      updatedAt: 1,
    },
  ])
  writeStorage(STORAGE_KEYS.DRAW_HISTORY, [
    {
      id: 'draw_choice_legacy',
      drawType: 'choice',
      resultId: 'choice_legacy',
      resultName: '%E9%A3%9F%E5%A0%82',
      snapshot: null,
      drawnAt: 100,
    },
    {
      id: 'draw_recipe_legacy',
      drawType: 'recipe',
      resultId: 'recipe_legacy',
      resultName: '%E8%A5%BF%E7%BA%A2%E6%9F%BF%E7%82%92%E9%B8%A1%E8%9B%8B',
      snapshot: {
        id: 'recipe_legacy',
        name: '%E8%A5%BF%E7%BA%A2%E6%9F%BF%E7%82%92%E9%B8%A1%E8%9B%8B',
        category: '家常菜',
        ingredients: ['番茄', '鸡蛋'],
        steps: ['切番茄', '炒鸡蛋'],
        durationMinutes: 10,
        difficulty: '简单',
        note: '',
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      },
      drawnAt: 200,
    },
  ])
  writeStorage(STORAGE_KEYS.MEAL_RECORDS, [
    {
      id: 'meal_legacy',
      eatenAt: 300,
      mealType: '午餐',
      foodName: '%E9%A3%9F%E5%A0%82',
      note: '80%饱',
      sourceDrawId: 'draw_choice_legacy',
      createdAt: 300,
      updatedAt: 300,
    },
  ])

  const migrated = getState()
  assert.strictEqual(migrated.meta.schemaVersion, SCHEMA_VERSION)
  assert.strictEqual(migrated.meta.lastResultDrawIds.choice, 'draw_choice_legacy')
  assert.strictEqual(migrated.meta.lastResultDrawIds.recipe, 'draw_recipe_legacy')
  assert.strictEqual(migrated.choices[0].name, '食堂')
  assert.strictEqual(migrated.recipes[0].name, '西红柿炒鸡蛋')
  assert.strictEqual(migrated.drawHistory.find(item => item.id === 'draw_recipe_legacy').resultName, '西红柿炒鸡蛋')
  assert.strictEqual(migrated.mealRecords[0].foodName, '食堂')
  assert.strictEqual(migrated.mealRecords[0].note, '80%饱')
  assert.strictEqual(migrated.mealRecords[0].sourceType, 'choice')
}

function run() {
  resetMemoryStorage()
  clearAllData()
  const emptyState = getState()
  assert.strictEqual(Array.isArray(emptyState.choices), true)
  assert.strictEqual(emptyState.choices.length, 0)
  assert.strictEqual(emptyState.meta.schemaVersion, SCHEMA_VERSION)

  bootstrapDefaultData()
  const seededState = getState()
  assert.ok(seededState.choices.length >= 6)
  assert.ok(seededState.recipes.length >= 6)

  assert.strictEqual(isValidDateString('2026-06-14'), true)
  assert.strictEqual(isValidDateString('2026-02-30'), false)
  assert.strictEqual(isValidTimeString('23:59'), true)
  assert.strictEqual(isValidTimeString('24:00'), false)

  const ts = composeBeijingTimestamp('2026-06-14', '23:50')
  const split = splitBeijingTimestamp(ts)
  assert.strictEqual(split.date, '2026-06-14')
  assert.strictEqual(split.time, '23:50')
  assert.ok(formatHumanizedClock(ts).length > 0)

  const grouped = groupByBeijingDate([{ eatenAt: ts }], item => item.eatenAt)
  assert.strictEqual(grouped.length, 1)

  const enabledChoices = pickEnabledItems(seededState.choices)
  assert.ok(enabledChoices.length > 0)
  assert.ok(pickRandomItem(enabledChoices))

  assert.strictEqual(looksLikeEncodedText('%E9%A3%9F%E5%A0%82'), true)
  assert.strictEqual(normalizeMaybeEncodedText('%E9%A3%9F%E5%A0%82'), '食堂')
  assert.strictEqual(normalizeMaybeEncodedText('80%饱'), '80%饱')

  const choiceSave = saveChoiceDraft({ name: '%E9%A3%9F%E5%A0%82', enabled: true })
  assert.strictEqual(choiceSave.ok, true)
  assert.strictEqual(choiceSave.data.name, '食堂')

  const recipeSave = saveRecipeDraft({
    name: '%E8%9B%8B%E7%82%92%E9%A5%AD',
    category: '测试',
    ingredients: ['A'],
    steps: ['B'],
    durationMinutes: 10,
    difficulty: '简单',
    note: '',
    enabled: true,
  })
  assert.strictEqual(recipeSave.ok, true)
  assert.strictEqual(recipeSave.data.name, '蛋炒饭')

  const choiceDraw = recordDraw({ id: 'choice_x1', name: '测试结果A' }, 'choice')
  const recipeDraw = recordDraw({
    id: 'recipe_x1',
    name: '测试结果B',
    category: '家常菜',
    ingredients: ['鸡蛋'],
    steps: ['打蛋'],
    durationMinutes: 5,
    difficulty: '简单',
    note: '',
    enabled: true,
  }, 'recipe')
  assert.strictEqual(choiceDraw.ok, true)
  assert.strictEqual(recipeDraw.ok, true)
  assert.strictEqual(getRecentDrawHistory(10, 'choice').length, 1)
  assert.strictEqual(getRecentDrawHistory(10, 'recipe').length, 1)
  assert.strictEqual(getDisplayDrawHistory('choice').length, 1)
  assert.strictEqual(getDisplayDrawHistory('recipe').length, 1)
  assert.strictEqual(getLastDrawResult('choice').id, choiceDraw.data.id)
  assert.strictEqual(getLastDrawResult('recipe').id, recipeDraw.data.id)

  const mealSave = saveMealRecordDraft({
    date: '2026-06-14',
    time: '12:30',
    mealType: '午餐',
    foodName: '%E9%A3%9F%E5%A0%82',
    note: '80%饱',
    sourceDrawId: choiceDraw.data.id,
    sourceType: 'choice',
  })
  assert.strictEqual(mealSave.ok, true)
  assert.strictEqual(mealSave.data.sourceDrawId, choiceDraw.data.id)
  assert.strictEqual(mealSave.data.sourceType, 'choice')
  assert.strictEqual(mealSave.data.foodName, '食堂')
  assert.strictEqual(mealSave.data.note, '80%饱')
  assert.strictEqual(isDrawRecorded(choiceDraw.data.id), true)
  assert.strictEqual(isDrawRecorded(recipeDraw.data.id), false)

  const manualMeal = saveMealRecordDraft({
    date: '2026-06-14',
    time: '18:00',
    mealType: '晚餐',
    foodName: '盖饭',
    note: '',
    sourceType: 'manual',
  })
  assert.strictEqual(manualMeal.ok, true)
  assert.strictEqual(manualMeal.data.sourceType, 'manual')

  const duplicateMeal = saveMealRecordDraft({
    date: '2026-06-14',
    time: '19:00',
    mealType: '晚餐',
    foodName: '盖饭',
    note: '',
    sourceDrawId: choiceDraw.data.id,
    sourceType: 'choice',
  })
  assert.strictEqual(duplicateMeal.ok, false)

  const recipeMeal = saveMealRecordDraft({
    date: '2026-06-14',
    time: '20:00',
    mealType: '晚餐',
    foodName: '测试结果B',
    note: '',
    sourceDrawId: recipeDraw.data.id,
    sourceType: 'recipe',
  })
  assert.strictEqual(recipeMeal.ok, true)
  assert.strictEqual(recipeMeal.data.sourceType, 'recipe')

  const mealRecords = getDisplayMealRecords()
  assert.ok(mealRecords.some(item => item.sourceType === 'choice'))
  assert.ok(mealRecords.some(item => item.sourceType === 'recipe'))
  assert.ok(mealRecords.some(item => item.sourceType === 'manual'))

  const deleteRecipeMeal = deleteMealRecord(recipeMeal.data.id)
  assert.strictEqual(deleteRecipeMeal.ok, true)
  assert.strictEqual(isDrawRecorded(recipeDraw.data.id), false)

  const deleteDraw = deleteDrawRecord(choiceDraw.data.id)
  assert.strictEqual(deleteDraw.ok, true)
  assert.strictEqual(getRecentDrawHistory(10, 'choice').length, 0)
  assert.strictEqual(isDrawRecorded(choiceDraw.data.id), true)

  testMigration()
  assert.ok(readStorage(STORAGE_KEYS.META, null))

  console.log('self-check passed')
}

run()
