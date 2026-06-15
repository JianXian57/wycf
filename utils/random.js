function isArray(list) {
  return Array.isArray(list)
}

function pickEnabledItems(list) {
  if (!isArray(list)) {
    return []
  }

  return list.filter(item => item && item.enabled !== false)
}

function pickRandomIndex(length, randomFn) {
  if (!length) {
    return -1
  }

  if (length === 1) {
    return 0
  }

  const random = typeof randomFn === 'function' ? randomFn : Math.random
  const value = random()
  const index = Math.floor(value * length)
  return Math.min(length - 1, Math.max(0, index))
}

function pickRandomItem(list, randomFn) {
  const items = isArray(list) ? list : []
  const index = pickRandomIndex(items.length, randomFn)
  return index >= 0 ? items[index] : null
}

module.exports = {
  pickEnabledItems,
  pickRandomIndex,
  pickRandomItem,
}
