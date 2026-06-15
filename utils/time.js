const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000
const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function pad2(value) {
  return String(value).padStart(2, '0')
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function toTimestamp(value, fallback) {
  if (isFiniteNumber(value)) {
    return value
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getBeijingParts(timestamp) {
  const source = toTimestamp(timestamp, Date.now())
  const date = new Date(source + BEIJING_OFFSET_MS)

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    weekday: WEEKDAY_NAMES[date.getUTCDay()],
  }
}

function formatDateKey(timestamp) {
  const parts = getBeijingParts(timestamp)
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

function formatDateLabel(timestamp) {
  const parts = getBeijingParts(timestamp)
  return `${parts.year}年${parts.month}月${parts.day}日 ${parts.weekday}`
}

function formatClock(timestamp) {
  const parts = getBeijingParts(timestamp)
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`
}

function formatExactDateTime(timestamp) {
  return `${formatDateKey(timestamp)} ${formatClock(timestamp)}`
}

function formatHumanizedClock(timestamp) {
  const parts = getBeijingParts(timestamp)
  const hour12 = parts.hour % 12 || 12
  const nextHour12 = (parts.hour + 1) % 12 || 12

  if (parts.minute < 20) {
    return `${hour12}点多`
  }

  if (parts.minute < 40) {
    return `${hour12}点半左右`
  }

  return `不到${nextHour12}点`
}

function formatDateTimeLabel(timestamp) {
  return `${formatDateLabel(timestamp)} ${formatClock(timestamp)}`
}

function formatPickerDate(timestamp) {
  return formatDateKey(timestamp)
}

function formatPickerTime(timestamp) {
  return formatClock(timestamp)
}

function isValidDateString(dateValue) {
  if (typeof dateValue !== 'string') {
    return false
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day, 12, 0, 0, 0) - BEIJING_OFFSET_MS
  const parts = getBeijingParts(timestamp)

  return parts.year === year && parts.month === month && parts.day === day
}

function isValidTimeString(timeValue) {
  if (typeof timeValue !== 'string') {
    return false
  }

  const match = /^(\d{2}):(\d{2})$/.exec(timeValue)
  if (!match) {
    return false
  }

  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function composeBeijingTimestamp(dateValue, timeValue) {
  if (!isValidDateString(dateValue) || !isValidTimeString(timeValue)) {
    return NaN
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue)
  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])

  return Date.UTC(year, month - 1, day, hour, minute, 0, 0) - BEIJING_OFFSET_MS
}

function splitBeijingTimestamp(timestamp) {
  const parts = getBeijingParts(timestamp)
  return {
    date: `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`,
    time: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
  }
}

function groupByBeijingDate(list, getTimestamp) {
  const source = Array.isArray(list) ? list.slice() : []
  const timestampGetter = typeof getTimestamp === 'function'
    ? getTimestamp
    : item => item && item.eatenAt

  source.sort((left, right) => {
    const leftTime = toTimestamp(timestampGetter(left), 0)
    const rightTime = toTimestamp(timestampGetter(right), 0)
    return rightTime - leftTime
  })

  const groups = []
  const groupMap = Object.create(null)

  source.forEach(item => {
    const timestamp = toTimestamp(timestampGetter(item), 0)
    const key = formatDateKey(timestamp)
    if (!groupMap[key]) {
      const label = formatDateLabel(timestamp)
      groupMap[key] = {
        key,
        label,
        items: [],
      }
      groups.push(groupMap[key])
    }
    groupMap[key].items.push(item)
  })

  return groups
}

function sortByTimestampDesc(list, getTimestamp) {
  const source = Array.isArray(list) ? list.slice() : []
  const timestampGetter = typeof getTimestamp === 'function'
    ? getTimestamp
    : item => item && item.createdAt

  source.sort((left, right) => {
    const leftTime = toTimestamp(timestampGetter(left), 0)
    const rightTime = toTimestamp(timestampGetter(right), 0)
    return rightTime - leftTime
  })

  return source
}

module.exports = {
  BEIJING_OFFSET_MS,
  composeBeijingTimestamp,
  formatClock,
  formatDateKey,
  formatDateLabel,
  formatDateTimeLabel,
  formatExactDateTime,
  formatHumanizedClock,
  formatPickerDate,
  formatPickerTime,
  getBeijingParts,
  groupByBeijingDate,
  isValidDateString,
  isValidTimeString,
  sortByTimestampDesc,
  splitBeijingTimestamp,
  toTimestamp,
}
