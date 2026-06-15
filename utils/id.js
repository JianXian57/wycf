function createId(prefix) {
  const safePrefix = prefix || 'item'
  const timePart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${safePrefix}_${timePart}_${randomPart}`
}

module.exports = {
  createId,
}
