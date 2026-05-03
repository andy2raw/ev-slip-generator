// PrizePicks power play multipliers (all regular picks)
export const PP_MULTIPLIERS = { 2: 3, 3: 5, 4: 10, 5: 20, 6: 25 }

// Payout multipliers when the slip contains Goblin picks.
// GOBLIN_MULTIPLIERS[legCount][goblinCount] = effective payout multiplier.
// Goblin lines are softer but each one steps down the multiplier tier.
export const GOBLIN_MULTIPLIERS = {
  2: [3,  2],
  3: [5,  3.5, 2.25],
  4: [10, 6,   4,   2.5],
  5: [20, 12,  7,   4,   2],
  6: [25, 15,  9,   5,   3,  1.5],
}

export function getEffectiveMult(legCount, goblinCount) {
  const row = GOBLIN_MULTIPLIERS[legCount]
  if (!row) return PP_MULTIPLIERS[legCount] ?? 1
  return row[Math.min(goblinCount, row.length - 1)]
}

export function americanToDecimal(odds) {
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1
}

export function americanToProb(odds) {
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

// Remove vig: given two American odds, return the no-vig probability for side 1
export function noVigProb(odds1, odds2) {
  const p1 = americanToProb(odds1)
  const p2 = americanToProb(odds2)
  return p1 / (p1 + p2)
}

// EV per unit bet: positive means edge
export function calcBetEV(trueProb, americanOdds) {
  const dec = americanToDecimal(americanOdds)
  return trueProb * (dec - 1) - (1 - trueProb)
}

// Joint probability * multiplier - 1
export function calcPPSlipEV(picks, legCount) {
  const mult = PP_MULTIPLIERS[legCount]
  if (!mult) return 0
  const joint = picks.reduce((acc, p) => acc * p.probability, 1)
  return joint * mult - 1
}

export function formatOdds(american) {
  if (american == null) return '—'
  return american > 0 ? `+${american}` : `${american}`
}

export function formatEV(ev) {
  const pct = ev * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

export function formatProb(p) {
  return `${(p * 100).toFixed(1)}%`
}

export function probClass(p) {
  const pct = p * 100
  if (pct >= 65) return 'green'
  if (pct >= 57) return 'yellow'
  if (pct >= 52) return 'orange'
  return 'red'
}

export function probDot(p) {
  const cls = probClass(p)
  const map = { green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444' }
  return map[cls]
}

export function formatDollars(n) {
  if (n == null) return '—'
  const sign = n >= 0 ? '' : '-'
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function formatShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
