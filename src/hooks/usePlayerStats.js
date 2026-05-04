import { useState, useEffect, useRef } from 'react'

const BDL = 'https://api.balldontlie.io/v1'
const SEASON = 2024

// Normalize PrizePicks stat type string to a lookup key
function normalizeKey(s) {
  return (s || '').toLowerCase().replace(/\s+/g, '')
}

const STAT_MAP = {
  'points':                  ['pts'],
  'rebounds':                ['reb'],
  'assists':                 ['ast'],
  'blocks':                  ['blk'],
  'steals':                  ['stl'],
  'turnovers':               ['turnover'],
  '3-ptmade':                ['fg3m'],
  'points+rebounds+assists': ['pts', 'reb', 'ast'],
  'pts+rebs+asts':           ['pts', 'reb', 'ast'],
  'points+rebounds':         ['pts', 'reb'],
  'points+assists':          ['pts', 'ast'],
  'rebounds+assists':        ['reb', 'ast'],
  'steals+blocks':           ['stl', 'blk'],
}

export function getStatFields(statType) {
  return STAT_MAP[normalizeKey(statType)] ?? null
}

function sumFields(obj, fields) {
  if (!obj || !fields?.length) return null
  const vals = fields.map(f => parseFloat(obj[f]))
  if (vals.some(isNaN)) return null
  return +vals.reduce((a, b) => a + b, 0).toFixed(1)
}

async function searchBDLPlayer(name) {
  const r = await fetch(`${BDL}/players?search=${encodeURIComponent(name)}&per_page=5`)
  if (!r.ok) return null
  const j = await r.json()
  const lower = name.toLowerCase()
  // Prefer exact match, fall back to first result
  return (
    j.data?.find(p => `${p.first_name} ${p.last_name}`.toLowerCase() === lower) ??
    j.data?.[0] ??
    null
  )
}

export function usePlayerStats(projections) {
  const [statsByName, setStatsByName] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)
  const fetchedRef = useRef(new Set())

  useEffect(() => {
    const nbaNames = [
      ...new Set(projections.filter(p => p.league === 'NBA').map(p => p.playerName)),
    ].filter(n => !fetchedRef.current.has(n))

    if (!nbaNames.length) return
    let cancelled = false

    async function run() {
      setStatsLoading(true)
      try {
        // 1. Resolve BDL player IDs in parallel
        const idMap = {} // playerName -> bdlId
        await Promise.allSettled(
          nbaNames.map(async name => {
            try {
              const player = await searchBDLPlayer(name)
              if (player) idMap[name] = player.id
            } catch {}
          })
        )
        if (cancelled) return

        const ids = Object.values(idMap)
        if (!ids.length) return

        // 2. Season averages — single batched request
        const seasonById = {}
        try {
          const qs = ids.map(id => `player_ids[]=${id}`).join('&')
          const r = await fetch(`${BDL}/season_averages?season=${SEASON}&${qs}`)
          if (r.ok) {
            const j = await r.json()
            for (const row of j.data || []) seasonById[row.player_id] = row
          }
        } catch {}
        if (cancelled) return

        // 3. Last-5-game stats — parallel per player
        // BDL returns game stats ascending by date; we take the last 5 from
        // a full-season fetch so we get the most recent games regardless of
        // how far into the season we are.
        const recentById = {}
        await Promise.allSettled(
          ids.map(async id => {
            try {
              const r = await fetch(
                `${BDL}/stats?seasons[]=${SEASON}&player_ids[]=${id}&per_page=100`
              )
              if (!r.ok) return
              const j = await r.json()
              const games = (j.data || []).slice(-5)
              if (!games.length) return
              const FIELDS = ['pts', 'reb', 'ast', 'blk', 'stl', 'turnover', 'fg3m']
              const avgs = {}
              for (const f of FIELDS) {
                const vals = games.map(g => parseFloat(g[f]) || 0)
                avgs[f] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
              }
              recentById[id] = avgs
            } catch {}
          })
        )
        if (cancelled) return

        // 4. Merge results
        const updates = {}
        for (const [name, id] of Object.entries(idMap)) {
          updates[name] = {
            season: seasonById[id] ?? null,
            recent: recentById[id] ?? null,
          }
          fetchedRef.current.add(name)
        }
        setStatsByName(prev => ({ ...prev, ...updates }))
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [projections])

  function getStatLine(playerName, statType) {
    const entry = statsByName[playerName]
    if (!entry) return null
    const fields = getStatFields(statType)
    if (!fields) return null
    const seasonAvg = sumFields(entry.season, fields)
    const last5Avg  = sumFields(entry.recent, fields)
    return seasonAvg != null || last5Avg != null ? { seasonAvg, last5Avg } : null
  }

  return { getStatLine, statsLoading }
}
