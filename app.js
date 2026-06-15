const { getState, getSummary } = require('./utils/store')

App({
  onLaunch() {
    this.refreshGlobalData()
  },

  refreshGlobalData() {
    this.globalData.state = getState()
    this.globalData.summary = getSummary()
    return this.globalData.summary
  },

  globalData: {
    state: null,
    summary: null,
  },
})
