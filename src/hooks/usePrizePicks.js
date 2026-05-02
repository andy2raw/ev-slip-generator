import { useState, useEffect, useCallback, useRef } from 'react'
import { PP_MULTIPLIERS } from '../utils/ev.js'

const API_URL = '/api/prizepicks/projections?per_page=1000&single_stat=true'
const REFRESH_MS = 5 * 60 * 1000

function estimateProb(attrs, statType) {
  let p = 0.54

  if (attrs.is_promo) p += 0.04
  if (attrs.odds_type === 'demon') p -= 0.03
  if (attrs.odds_type === 'goblin') p += 0.03

  const highVar = ['3-PT Made', 'Blocks', 'Home Runs', 'Stolen Bases', 'Turnovers']
  if (highVar.some(s => statType?.includes(s))) p -= 0.025

  const stable = ['Passing Yards', 'Rushing Yards', 'Points + Rebounds + Assists', 'Hits + Runs + RBIs']
  if (stable.some(s => statType?.includes(s))) p += 0.015

  const frac = attrs.line_score % 1
  if (frac >= 0.4 && frac <= 0.6) p += 0.01

  return Math.min(0.74, Math.max(0.46, p))
}

// Returns recommendation based on direction and magnitude of line move.
// delta > 0 means line went UP — Over is harder — bad for bettors.
// delta < 0 means line went DOWN — Over is easier — good for bettors.
function getRecommendation(delta) {
  const abs = Math.abs(delta).toFixed(1)
  if (delta <= -1.0) return { rec: 'strong_play', label: 'STRONG PLAY', reason: `Line dropped ${abs} pts — sharp steam down, Over is now softer` }
  if (delta <= -0.5) return { rec: 'play',        label: 'PLAY',        reason: `Line dropped ${abs} pts — move is in your favor` }
  if (delta <  0)    return { rec: 'lean_play',   label: 'LEAN PLAY',   reason: `Minor ${abs} pt drop — slight edge, still playable` }
  if (delta >= 1.0)  return { rec: 'skip',        label: 'SKIP',        reason: `Line steamed up ${abs} pts — Over is significantly harder` }
  if (delta >= 0.5)  return { rec: 'caution',     label: 'CAUTION',     reason: `Line rose ${abs} pts — reassess before playing` }
  return {             rec: 'neutral',   label: 'NEUTRAL',     reason: `Minor ${delta > 0 ? '+' : ''}${abs} pt tweak — no strong signal` }
}

export function usePrizePicks() {
  const [projections, setProjections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [countdown, setCountdown] = useState(300)
  const timerRef = useRef(null)
  const countRef = useRef(null)
  // Persists between refreshes: id -> { line, probability }
  const prevSnapshotRef = useRef({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status} — check if PrizePicks API is reachable`)
      const json = await res.json()

      const inc = {}
      for (const item of json.included || []) {
        if (!inc[item.type]) inc[item.type] = {}
        inc[item.type][item.id] = item
      }

      const parsed = (json.data || [])
        .filter(p => {
          const s = p.attributes.status
          return s === 'pre_game' || s === 'in_progress'
        })
        .map(p => {
          const a = p.attributes
          const playerRef = p.relationships?.new_player?.data
          const player = playerRef ? inc?.new_player?.[playerRef.id] : null

          const leagueName =
            player?.attributes?.league_name ||
            player?.attributes?.league ||
            a.league ||
            a.name ||
            ''

          const line = parseFloat(a.line_score) || 0
          const baseProb = estimateProb(a, a.stat_type)

          // Detect line move against previous snapshot
          const prev = prevSnapshotRef.current[p.id]
          let probability = baseProb
          let lineMove = null

          if (prev && prev.line !== line) {
            const delta = line - prev.line
            // Each full-point increase makes the Over ~5% harder to hit
            probability = Math.min(0.74, Math.max(0.46, baseProb - delta * 0.05))
            const probDelta = probability - prev.probability
            lineMove = {
              prevLine: prev.line,
              currLine: line,
              delta,
              direction: delta > 0 ? 'up' : 'down',
              prevProb: prev.probability,
              probDelta,
              // EV delta is linear in prob for a single pick in a combo
              evDelta2: probDelta * PP_MULTIPLIERS[2],
              evDelta4: probDelta * PP_MULTIPLIERS[4],
              evDelta6: probDelta * PP_MULTIPLIERS[6],
              detectedAt: new Date().toISOString(),
              ...getRecommendation(delta),
            }
          }

          return {
            id: p.id,
            playerName: player?.attributes?.display_name || a.description || 'Unknown',
            team: player?.attributes?.team_name || player?.attributes?.team || '',
            position: player?.attributes?.position || '',
            league: leagueName,
            statType: a.stat_type || '',
            line,
            startTime: a.start_time,
            isPromo: Boolean(a.is_promo),
            oddsType: a.odds_type || 'standard',
            status: a.status,
            probability,
            lineMove,
          }
        })

      // Update snapshot for next refresh
      prevSnapshotRef.current = Object.fromEntries(
        parsed.map(p => [p.id, { line: p.line, probability: p.probability }])
      )

      setProjections(parsed)
      setLastRefresh(new Date())
      setCountdown(300)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, REFRESH_MS)
    countRef.current = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : 0)), 1000)
    return () => {
      clearInterval(timerRef.current)
      clearInterval(countRef.current)
    }
  }, [fetchData])

  return { projections, loading, error, lastRefresh, countdown, refresh: fetchData }
}
