import { useState, useCallback } from 'react'
import { americanToDecimal, americanToProb, calcBetEV } from '../utils/ev.js'

const API_KEY = 'afbfc3762c40c06f63974ac101756f3c'
const BASE = 'https://api.the-odds-api.com/v4'
const HR_KEY = 'hardrockbet'

export const SPORTS = [
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'baseball_mlb', label: 'MLB' },
  { key: 'icehockey_nhl', label: 'NHL' },
  { key: 'mma_mixed_martial_arts', label: 'UFC' },
  { key: 'soccer_usa_mls', label: 'MLS' },
  { key: 'americanfootball_nfl', label: 'NFL' },
]

// Extract value bets from a game object
function parseGame(game, sportKey) {
  const bets = []
  const books = game.bookmakers || []
  const hrBook = books.find(b => b.key === HR_KEY)
  if (!hrBook) return bets

  // Build consensus odds map: outcomeName -> [all books' prices]
  function buildConsensus(marketKey) {
    const map = {}
    for (const book of books) {
      const mkt = book.markets?.find(m => m.key === marketKey)
      if (!mkt) continue
      for (const o of mkt.outcomes) {
        const nameKey = o.point != null ? `${o.name}__${o.point}` : o.name
        if (!map[nameKey]) map[nameKey] = { prices: [], point: o.point, name: o.name }
        map[nameKey].prices.push(o.price)
      }
    }
    return map
  }

  for (const hrMarket of hrBook.markets) {
    const mktKey = hrMarket.key
    const consensus = buildConsensus(mktKey)
    const outcomes = hrMarket.outcomes || []

    // For h2h and spreads we use no-vig calculation across both sides
    if (mktKey === 'h2h' || mktKey === 'spreads') {
      if (outcomes.length < 2) continue
      const sides = outcomes.map(o => {
        const nameKey = o.point != null ? `${o.name}__${o.point}` : o.name
        const allPrices = consensus[nameKey]?.prices || [o.price]
        const bestPrice = allPrices.reduce((best, p) =>
          americanToDecimal(p) > americanToDecimal(best) ? p : best
        , allPrices[0])
        return { ...o, bestPrice }
      })

      const p0 = americanToProb(sides[0].bestPrice)
      const p1 = americanToProb(sides[1].bestPrice)
      const total = p0 + p1

      for (let i = 0; i < sides.length; i++) {
        const s = sides[i]
        const trueProb = (i === 0 ? p0 : p1) / total
        const hrOdds = s.price
        const decOdds = americanToDecimal(hrOdds)
        const ev = calcBetEV(trueProb, hrOdds)
        const label = s.point != null
          ? `${s.name} ${s.point > 0 ? '+' : ''}${s.point}`
          : s.name

        bets.push({
          id: `${game.id}-${mktKey}-${s.name}-${s.point ?? ''}`,
          gameId: game.id,
          sport: sportKey,
          sportLabel: SPORTS.find(x => x.key === sportKey)?.label || sportKey,
          game: `${game.away_team} @ ${game.home_team}`,
          market: mktKey,
          marketLabel: mktKey === 'h2h' ? 'Moneyline' : 'Spread',
          name: s.name,
          label,
          odds: hrOdds,
          decOdds,
          trueProb,
          ev,
          probability: trueProb,
          startTime: game.commence_time,
        })
      }
    } else if (mktKey === 'totals') {
      // Over/Under — compare each side's implied prob vs best available
      for (const o of outcomes) {
        const nameKey = `${o.name}__${o.point}`
        const allPrices = consensus[nameKey]?.prices || [o.price]
        const bestPrice = allPrices.reduce((best, p) =>
          americanToDecimal(p) > americanToDecimal(best) ? p : best
        , allPrices[0])

        // True prob = best market price no-vig (find opposite side for no-vig)
        const opp = outcomes.find(x => x.name !== o.name && x.point === o.point)
        let trueProb
        if (opp) {
          const oppKey = `${opp.name}__${opp.point}`
          const oppPrices = consensus[oppKey]?.prices || [opp.price]
          const bestOppPrice = oppPrices.reduce((best, p) =>
            americanToDecimal(p) > americanToDecimal(best) ? p : best
          , oppPrices[0])
          const p1 = americanToProb(bestPrice)
          const p2 = americanToProb(bestOppPrice)
          trueProb = p1 / (p1 + p2)
        } else {
          trueProb = americanToProb(bestPrice)
        }

        const hrOdds = o.price
        const decOdds = americanToDecimal(hrOdds)
        const ev = calcBetEV(trueProb, hrOdds)

        bets.push({
          id: `${game.id}-totals-${o.name}-${o.point}`,
          gameId: game.id,
          sport: sportKey,
          sportLabel: SPORTS.find(x => x.key === sportKey)?.label || sportKey,
          game: `${game.away_team} @ ${game.home_team}`,
          market: 'totals',
          marketLabel: 'Total',
          name: o.name,
          label: `${o.name} ${o.point}`,
          odds: hrOdds,
          decOdds,
          trueProb,
          ev,
          probability: trueProb,
          startTime: game.commence_time,
        })
      }
    }
  }

  return bets
}

export function useOddsAPI() {
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const [noHardRock, setNoHardRock] = useState(false)

  const fetchOdds = useCallback(async (sportKeys) => {
    setLoading(true)
    setError(null)
    setNoHardRock(false)

    try {
      const allBets = []

      for (const sportKey of sportKeys) {
        const params = new URLSearchParams({
          apiKey: API_KEY,
          regions: 'us,us2',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american',
          bookmakers: [HR_KEY, 'draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbetus'].join(','),
        })
        const url = `${BASE}/sports/${sportKey}/odds?${params}`
        const res = await fetch(url)

        const rem = res.headers.get('x-requests-remaining')
        if (rem) setRemaining(Number(rem))

        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Odds API (${sportKey}): ${res.status} — ${text.slice(0, 120)}`)
        }

        const games = await res.json()
        for (const game of games) {
          allBets.push(...parseGame(game, sportKey))
        }
      }

      if (allBets.length === 0 && sportKeys.length > 0) {
        setNoHardRock(true)
      }

      allBets.sort((a, b) => b.ev - a.ev)
      setBets(allBets)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  return { bets, loading, error, lastRefresh, remaining, noHardRock, fetchOdds }
}
