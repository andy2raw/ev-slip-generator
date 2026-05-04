const KEY = 'ev_slip_v1'

function defaults() {
  return {
    bets: [],
    weeklyGoal: 100,
    weekStart: getMondayISO(new Date()),
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    const data = JSON.parse(raw)
    return {
      ...defaults(),
      ...data,
      // Guard against null/non-array bets from corrupted localStorage
      bets: Array.isArray(data?.bets) ? data.bets : [],
    }
  } catch {
    return defaults()
  }
}

export function save(data) {
  // Safari private mode throws on setItem — fail silently rather than crash
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {}
}

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Returns ISO date string for the Monday of the given date
export function getMondayISO(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function isSameWeek(isoDate, weekStartISO) {
  const d = new Date(isoDate)
  const ws = new Date(weekStartISO)
  const we = new Date(ws)
  we.setDate(we.getDate() + 7)
  return d >= ws && d < we
}
