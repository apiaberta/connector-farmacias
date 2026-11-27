const TZ = 'Europe/Lisbon'

function pad (n) {
    return String(n).padStart(2, '0')
}

function parseDateParts (dateStr) {
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const [dd, mm, yyyy] = dateStr.split('-').map(Number)
        return { y: yyyy, m: mm, d: dd }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [yyyy, mm, dd] = dateStr.split('-').map(Number)
        return { y: yyyy, m: mm, d: dd }
    }
    throw new Error(`Invalid date: ${dateStr}`)
}

function tzOffsetMs (date, timeZone = TZ) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date)
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]))
    const asUtc = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        Number(map.second)
    )
    return asUtc - date.getTime()
}

function formatOffset (offsetMs) {
    const sign = offsetMs >= 0 ? '+' : '-'
    const abs = Math.abs(offsetMs) / 60000
    const h = Math.floor(abs / 60)
    const min = abs % 60
    return `${sign}${pad(h)}:${pad(min)}`
}

/**
 * Pharmacy on-duty window in Portugal: 09:00 to 09:00 next day, Europe/Lisbon.
 * `dateStr` is dd-mm-yyyy (1400safe CurrentDate / NextDate) or yyyy-mm-dd.
 */
export function lisbonAtHour (dateStr, hour = 9, minute = 0) {
    const { y, m, d } = parseDateParts(dateStr)
    const guess = Date.UTC(y, m - 1, d, hour, minute, 0)
    const offsetMs = tzOffsetMs(new Date(guess), TZ)
    const instant = new Date(guess - offsetMs)
    const offsetMsAt = tzOffsetMs(instant, TZ)
    const naive = `${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00`
    return `${naive}${formatOffset(offsetMsAt)}`
}

export function shiftDayFromStart (iso) {
    return iso.slice(0, 10)
}

export function parseDotNetDate (value) {
    if (value == null) return null
    if (typeof value === 'number') return new Date(value)
    const m = String(value).match(/\/Date\((-?\d+)(?:[+-]\d+)?\)\//)
    if (m) return new Date(Number(m[1]))
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
}

function ymdInLisbon (date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date)
    const get = type => Number(parts.find(p => p.type === type)?.value)
    return { y: get('year'), m: get('month'), d: get('day'), hour: get('hour') }
}

function addDaysYmd (y, m, d, delta) {
    const utc = new Date(Date.UTC(y, m - 1, d + delta))
    return {
        y: utc.getUTCFullYear(),
        m: utc.getUTCMonth() + 1,
        d: utc.getUTCDate()
    }
}

export function currentShiftWindow (now = new Date()) {
    const { y, m, d, hour } = ymdInLisbon(now)
    const start = hour < 9 ? addDaysYmd(y, m, d, -1) : { y, m, d }
    const end = addDaysYmd(start.y, start.m, start.d, 1)
    const startStr = `${start.y}-${pad(start.m)}-${pad(start.d)}`
    return {
        shift_day: startStr,
        shift_start: lisbonAtHour(startStr, 9),
        shift_end: lisbonAtHour(`${end.y}-${pad(end.m)}-${pad(end.d)}`, 9)
    }
}
