const memoryStorage = Object.create(null)

function hasWxStorage() {
  return typeof wx !== 'undefined'
    && wx
    && typeof wx.getStorageSync === 'function'
    && typeof wx.setStorageSync === 'function'
    && typeof wx.removeStorageSync === 'function'
}

function hasStorageInfo() {
  return typeof wx !== 'undefined'
    && wx
    && typeof wx.getStorageInfoSync === 'function'
}

function hasStorageKey(key) {
  try {
    if (hasWxStorage() && hasStorageInfo()) {
      const info = wx.getStorageInfoSync()
      return Array.isArray(info.keys) && info.keys.indexOf(key) >= 0
    }

    if (hasWxStorage()) {
      const value = wx.getStorageSync(key)
      return value !== '' && value !== undefined && value !== null
    }
  } catch (error) {
    // fall through to in-memory fallback
  }

  return Object.prototype.hasOwnProperty.call(memoryStorage, key)
}

function clone(value) {
  if (value === undefined) {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return value
  }
}

function readStorage(key, fallback) {
  try {
    if (hasWxStorage()) {
      const value = wx.getStorageSync(key)
      return value === '' || value === undefined || value === null ? fallback : value
    }
  } catch (error) {
    // 落到内存兜底
  }

  return Object.prototype.hasOwnProperty.call(memoryStorage, key)
    ? clone(memoryStorage[key])
    : fallback
}

function writeStorage(key, value) {
  let ok = true

  try {
    if (hasWxStorage()) {
      wx.setStorageSync(key, value)
    }
  } catch (error) {
    ok = false
  }

  memoryStorage[key] = clone(value)
  return ok
}

function removeStorage(key) {
  let ok = true

  try {
    if (hasWxStorage()) {
      wx.removeStorageSync(key)
    }
  } catch (error) {
    ok = false
  }

  delete memoryStorage[key]
  return ok
}

function resetMemoryStorage() {
  Object.keys(memoryStorage).forEach(key => {
    delete memoryStorage[key]
  })
}

module.exports = {
  clone,
  hasStorageKey,
  hasWxStorage,
  readStorage,
  removeStorage,
  resetMemoryStorage,
  writeStorage,
}
