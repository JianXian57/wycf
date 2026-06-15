function canUseWxApi(name) {
  return typeof wx !== 'undefined' && wx && typeof wx[name] === 'function'
}

function toast(title, icon = 'none', duration = 1800) {
  if (!canUseWxApi('showToast')) {
    return
  }

  wx.showToast({
    title: String(title || ''),
    icon,
    duration,
  })
}

function confirmModal(options) {
  const config = options || {}

  if (!canUseWxApi('showModal')) {
    return Promise.resolve(false)
  }

  return new Promise(resolve => {
    wx.showModal({
      title: config.title || '提示',
      content: config.content || '',
      confirmText: config.confirmText || '确定',
      cancelText: config.cancelText || '取消',
      success(res) {
        resolve(Boolean(res.confirm))
      },
      fail() {
        resolve(false)
      },
    })
  })
}

function navigateTo(url) {
  if (canUseWxApi('navigateTo')) {
    wx.navigateTo({ url })
  }
}

function redirectTo(url) {
  if (canUseWxApi('redirectTo')) {
    wx.redirectTo({ url })
  }
}

function switchTab(url) {
  if (canUseWxApi('switchTab')) {
    wx.switchTab({ url })
  }
}

function reLaunch(url) {
  if (canUseWxApi('reLaunch')) {
    wx.reLaunch({ url })
  }
}

function goBack(delta) {
  if (canUseWxApi('navigateBack')) {
    wx.navigateBack({
      delta: Math.max(1, Number(delta) || 1),
    })
  }
}

function setClipboardData(data) {
  if (canUseWxApi('setClipboardData')) {
    wx.setClipboardData({ data: String(data || '') })
  }
}

module.exports = {
  confirmModal,
  goBack,
  navigateTo,
  reLaunch,
  setClipboardData,
  switchTab,
  toast,
}
