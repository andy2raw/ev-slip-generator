import { PP_MULTIPLIERS, getEffectiveMult } from './ev.js'

// Generate all k-size combinations from arr
export function combinations(arr, k) {
  if (k > arr.length) return []
  if (k === 1) return arr.map(x => [x])
  const result = []
  for (let i = 0; i <= arr.length - k; i++) {
    const sub = combinations(arr.slice(i + 1), k - 1)
    for (const combo of sub) result.push([arr[i], ...combo])
  }
  return result
}

// Find best PrizePicks combos ranked by EV, preferring regular picks over Goblins.
export function findBestPPCombos(picks, legCount, maxResults = 5) {
  const baseMult = PP_MULTIPLIERS[legCount]
  if (!baseMult) return []

  // Limit input to prevent combinatorial explosion
  const limits = { 2: 30, 4: 18, 6: 13 }
  const limit = limits[legCount] || 15

  // Rank picks by probability but apply a small penalty to Goblin picks so that
  // a regular pick at the same probability always slots in ahead of a Goblin.
  const top = [...picks]
    .sort((a, b) => {
      const aEff = a.probability - (a.oddsType === 'goblin' ? 0.02 : 0)
      const bEff = b.probability - (b.oddsType === 'goblin' ? 0.02 : 0)
      return bEff - aEff
    })
    .slice(0, limit)

  return combinations(top, legCount)
    .filter(combo => {
      // No duplicate player
      const names = combo.map(p => p.playerName)
      return new Set(names).size === names.length
    })
    .map(combo => {
      const joint = combo.reduce((acc, p) => acc * p.probability, 1)
      const goblinCount = combo.filter(p => p.oddsType === 'goblin').length
      // Use the goblin-adjusted multiplier so EV reflects what you actually get paid
      const effectiveMult = getEffectiveMult(legCount, goblinCount)
      const ev = joint * effectiveMult - 1
      return { picks: combo, jointProb: joint, ev, legCount, mult: baseMult, goblinCount, effectiveMult }
    })
    .sort((a, b) => b.ev - a.ev)
    .slice(0, maxResults)
}

// Find best HardRock single bets
export function findBestSingles(bets, maxResults = 5) {
  return [...bets]
    .sort((a, b) => b.ev - a.ev)
    .slice(0, maxResults)
}

// Find best HardRock parlay combos
export function findBestHRParlays(bets, legCount, maxResults = 5) {
  const limits = { 2: 20, 4: 12 }
  const limit = limits[legCount] || 12
  const top = [...bets]
    .sort((a, b) => b.ev - a.ev)
    .slice(0, limit)

  return combinations(top, legCount)
    .filter(combo => {
      // No two outcomes from the same game (avoid correlated legs)
      const games = combo.map(b => b.gameId)
      return new Set(games).size === games.length
    })
    .map(combo => {
      const joint = combo.reduce((acc, b) => acc * b.trueProb, 1)
      const parlayDec = combo.reduce((acc, b) => acc * b.decOdds, 1)
      const ev = joint * parlayDec - 1
      // Convert parlay decimal back to American
      let parlayAmerican
      if (parlayDec >= 2) parlayAmerican = Math.round((parlayDec - 1) * 100)
      else parlayAmerican = Math.round(-100 / (parlayDec - 1))
      return { picks: combo, jointProb: joint, parlayDec, parlayAmerican, ev }
    })
    .sort((a, b) => b.ev - a.ev)
    .slice(0, maxResults)
}
