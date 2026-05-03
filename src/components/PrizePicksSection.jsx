import { useState, useMemo } from 'react'
import { usePrizePicks } from '../hooks/usePrizePicks.js'
import { findBestPPCombos } from '../utils/combos.js'
import { PP_MULTIPLIERS, getEffectiveMult, formatProb, formatEV, probClass, probDot, formatTime } from '../utils/ev.js'

// ── Sport emoji ──────────────────────────────────────────────────────────────

const SPORT_EMOJI = {
  NBA: '🏀', MLB: '⚾', NHL: '🏒', NFL: '🏈',
  NCAAF: '🏈', NCAAB: '🏀', CFB: '🏈', CBB: '🏀',
  MLS: '⚽', SOCCER: '⚽', EPL: '⚽', UCL: '⚽',
  LOL: '🎮', VALORANT: '🎯', VAL: '🎯',
  COD: '🎮', DOTA: '🎮', DOTA2: '🎮',
  CS2: '🎯', CSGO: '🎯', RL: '🚀',
  PGA: '⛳', GOLF: '⛳', UFC: '🥊', MMA: '🥊',
  TENNIS: '🎾', NASCAR: '🏁', F1: '🏎',
}

function sportEmoji(league) {
  return SPORT_EMOJI[league?.toUpperCase()] ?? '🎯'
}

// ── Atom components ──────────────────────────────────────────────────────────

function ProbBadge({ prob }) {
  return <span className={`prob-badge ${probClass(prob)}`}>{formatProb(prob)}</span>
}

function EVBadge({ ev }) {
  return <span className={`ev-badge ${ev >= 0 ? 'pos' : 'neg'}`}>{formatEV(ev)}</span>
}

function OddsTypePill({ type }) {
  if (!type || type === 'standard') return null
  const colors = { demon: '#ef4444', goblin: '#22c55e', power: '#f97316' }
  const c = colors[type] || '#888'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, color: c,
      background: `${c}22`, padding: '1px 5px',
      borderRadius: 3, textTransform: 'uppercase',
    }}>
      {type}
    </span>
  )
}

// ── Line Move Panel (unchanged) ──────────────────────────────────────────────

function LineMoveCard({ p }) {
  const m = p.lineMove
  const sign = m.delta > 0 ? '+' : ''
  return (
    <div className="line-move-card">
      <div className="line-move-player">{p.playerName}</div>
      <div className="line-move-stat">
        {p.statType} · {p.team} · <span className="tag" style={{ fontSize: 9 }}>{p.league}</span>
      </div>
      <div className="line-move-arrow">
        <span className="prev">{m.prevLine}</span>
        <span className={m.direction === 'up' ? 'arrow-up' : 'arrow-down'}>
          {m.direction === 'up' ? '▲' : '▼'}
        </span>
        <span className="curr">{m.currLine}</span>
        <span className={`delta ${m.direction}`}>{sign}{m.delta.toFixed(1)}</span>
      </div>
      <div className="line-move-stats">
        <span>
          Prob:{' '}
          <strong style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>
            {formatProb(m.prevProb)}
          </strong>
          {' → '}
          <strong className={m.direction === 'down' ? 'down' : 'up'}>
            {formatProb(p.probability)}
          </strong>
        </span>
        <span>
          2-Leg EV shift:{' '}
          <strong className={m.evDelta2 >= 0 ? 'down' : 'up'}>
            {m.evDelta2 >= 0 ? '+' : ''}{(m.evDelta2 * 100).toFixed(1)}%
          </strong>
        </span>
        <span>
          4-Leg EV shift:{' '}
          <strong className={m.evDelta4 >= 0 ? 'down' : 'up'}>
            {m.evDelta4 >= 0 ? '+' : ''}{(m.evDelta4 * 100).toFixed(1)}%
          </strong>
        </span>
      </div>
      <span className={`rec-badge ${m.rec}`}>{m.label}</span>
      <div className="rec-reason">{m.reason}</div>
    </div>
  )
}

function LineMovePanel({ moves }) {
  const [collapsed, setCollapsed] = useState(false)
  if (!moves.length) return null
  const recOrder = { strong_play: 0, play: 1, lean_play: 2, neutral: 3, caution: 4, skip: 5 }
  const sorted = [...moves].sort((a, b) => {
    const d = recOrder[a.lineMove.rec] - recOrder[b.lineMove.rec]
    return d !== 0 ? d : Math.abs(b.lineMove.delta) - Math.abs(a.lineMove.delta)
  })
  return (
    <div className="line-move-panel">
      <div className="line-move-header" onClick={() => setCollapsed(c => !c)}>
        <div className="line-move-title">
          ⚡ Line Moves Detected
          <span className="line-move-badge">{moves.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {moves.filter(p => ['strong_play', 'play'].includes(p.lineMove.rec)).length} plays ·{' '}
            {moves.filter(p => p.lineMove.rec === 'skip').length} skips
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{collapsed ? '▶' : '▼'}</span>
        </div>
      </div>
      {!collapsed && (
        <div className="line-move-grid">
          {sorted.map(p => <LineMoveCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  )
}

// ── SlipCard — one combo rendered as a full slip ─────────────────────────────

function SlipCard({ combo, rank, showLeague }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>

      {/* Rank + EV */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 9,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
          color: 'var(--text-dim)',
        }}>
          SLIP #{rank}
        </span>
        <EVBadge ev={combo.ev} />
      </div>

      {/* Pick rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 9 }}>
        {combo.picks.map((pick, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>

            {/* Colour dot */}
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: probDot(pick.probability), marginTop: 5,
            }} />

            {/* Player + stat */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: 5, flexWrap: 'wrap', marginBottom: 2,
              }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  {pick.playerName}
                </span>
                {pick.team && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pick.team}</span>
                )}
                {showLeague && pick.league && (
                  <span className="tag" style={{ fontSize: 9 }}>{pick.league}</span>
                )}
                <OddsTypePill type={pick.oddsType} />
                {pick.lineMove && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: pick.lineMove.direction === 'down' ? 'var(--green)' : 'var(--red)',
                  }}>
                    {pick.lineMove.direction === 'down' ? '▼' : '▲'} moved
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{
                  color: 'var(--accent)', fontWeight: 700, fontSize: 13,
                }}>
                  Over {pick.line}
                </span>
                <span>{pick.statType}</span>
              </div>
            </div>

            {/* Per-pick probability */}
            <div style={{ flexShrink: 0, paddingTop: 1 }}>
              <ProbBadge prob={pick.probability} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer: joint prob + payout (goblin-adjusted) */}
      <div style={{
        display: 'flex', gap: 14, fontSize: 11,
        color: 'var(--text-muted)', paddingTop: 7,
        borderTop: '1px solid var(--border)',
      }}>
        <span>
          Joint hit:{' '}
          <strong style={{ color: 'var(--text)' }}>{formatProb(combo.jointProb)}</strong>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          Payout:{' '}
          <strong style={{ color: combo.goblinCount > 0 ? 'var(--yellow)' : 'var(--accent)' }}>
            {combo.effectiveMult}x
          </strong>
          {combo.goblinCount > 0 && combo.effectiveMult < combo.mult && (
            <span style={{
              color: 'var(--text-dim)', textDecoration: 'line-through', fontSize: 10,
            }}>
              {combo.mult}x
            </span>
          )}
        </span>
      </div>

      {/* Goblin warning strip */}
      {combo.goblinCount > 0 && (
        <div style={{
          marginTop: 7,
          padding: '5px 8px',
          background: 'rgba(234,179,8,0.08)',
          border: '1px solid rgba(234,179,8,0.22)',
          borderRadius: 5,
          fontSize: 11,
          color: 'var(--yellow)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          ⚠ {combo.goblinCount} goblin pick{combo.goblinCount > 1 ? 's' : ''} — payout
          reduced from {combo.mult}x to {combo.effectiveMult}x
        </div>
      )}
    </div>
  )
}

// ── ComboColumn — card wrapper: header + slip list ───────────────────────────

function ComboColumn({ legCount, combos, showLeague, isLoading }) {
  const mult = PP_MULTIPLIERS[legCount]

  if (isLoading) {
    return (
      <div className="combo-card">
        <div className="combo-header">
          <span className="combo-label">{legCount}-Leg Slips</span>
        </div>
        <div className="status-box"><div className="spinner" /></div>
      </div>
    )
  }

  if (!combos.length) {
    return (
      <div className="combo-card">
        <div className="combo-header">
          <span className="combo-label">{legCount}-Leg Slips</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{mult}x payout</span>
        </div>
        <div className="status-box" style={{ padding: '28px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Not enough picks for a {legCount}-leg slip
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="combo-card">
      <div className="combo-header">
        <span className="combo-label">{legCount}-Leg Slips</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{mult}x payout</span>
      </div>
      {combos.map((combo, idx) => (
        <SlipCard
          key={idx}
          combo={combo}
          rank={idx + 1}
          showLeague={showLeague}
        />
      ))}
    </div>
  )
}

// ── Main Section ─────────────────────────────────────────────────────────────

export default function PrizePicksSection() {
  const { projections, loading, error, lastRefresh, countdown, refresh } = usePrizePicks()
  const [leagueFilter, setLeagueFilter] = useState('ALL')
  const [statFilter, setStatFilter]     = useState('ALL')
  const [sortBy, setSortBy]             = useState('prob')
  const [movesOnly, setMovesOnly]       = useState(false)

  const lineMoves = useMemo(() => projections.filter(p => p.lineMove), [projections])

  const leagues = useMemo(() => {
    const s = new Set(projections.map(p => p.league).filter(Boolean))
    return ['ALL', ...Array.from(s).sort()]
  }, [projections])

  const statTypes = useMemo(() => {
    const s = new Set(projections.map(p => p.statType).filter(Boolean))
    return ['ALL', ...Array.from(s).sort()]
  }, [projections])

  // Projections scoped to the current league + stat + moves filters
  const filtered = useMemo(() => projections
    .filter(p => leagueFilter === 'ALL' || p.league === leagueFilter)
    .filter(p => statFilter  === 'ALL' || p.statType === statFilter)
    .filter(p => !movesOnly  || p.lineMove)
  , [projections, leagueFilter, statFilter, movesOnly])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'prob')   return b.probability - a.probability
    if (sortBy === 'line')   return a.line - b.line
    if (sortBy === 'player') return a.playerName.localeCompare(b.playerName)
    if (sortBy === 'moves') {
      const aH = a.lineMove ? 1 : 0, bH = b.lineMove ? 1 : 0
      if (bH !== aH) return bH - aH
      return Math.abs(b.lineMove?.delta ?? 0) - Math.abs(a.lineMove?.delta ?? 0)
    }
    return 0
  }), [filtered, sortBy])

  // Combos use the same filtered pool — sport-specific when a league is active
  const combos2 = useMemo(() => findBestPPCombos(filtered, 2), [filtered])
  const combos4 = useMemo(() => findBestPPCombos(filtered, 4), [filtered])
  const combos6 = useMemo(() => findBestPPCombos(filtered, 6), [filtered])

  const isAllLeagues  = leagueFilter === 'ALL'
  const isFirstLoad   = loading && projections.length === 0

  // Section heading above the combo grid
  const slipsHeading = isAllLeagues
    ? 'Best Cross-Sport Slips'
    : `${sportEmoji(leagueFilter)} Best ${leagueFilter} Slips`
  const slipsCount = isAllLeagues
    ? `${filtered.length} projections across all leagues`
    : `${filtered.length} ${leagueFilter} projections`

  const fmtCountdown = () => {
    const m = Math.floor(countdown / 60)
    const s = countdown % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">PrizePicks</div>
          <div className="section-sub">
            {projections.length > 0
              ? `${projections.length} live projections · auto-refreshes every 5 min`
              : 'Live player prop projections'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastRefresh && (
            <div className="refresh-info">
              <div className="refresh-dot" />
              Next refresh {fmtCountdown()}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            {loading ? <span className="spinner" /> : '↻'} Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box">
          {error}
          <div className="note" style={{ marginTop: 4 }}>
            Make sure you're running <code>npm run dev</code> or the Vercel function is deployed.
          </div>
        </div>
      )}

      {/* Line move alert panel */}
      <LineMovePanel moves={lineMoves} />

      {/* League filter */}
      <div className="filter-bar">
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>LEAGUE</span>
        {leagues.slice(0, 12).map(l => (
          <button
            key={l}
            className={`filter-btn${leagueFilter === l ? ' active' : ''}`}
            onClick={() => { setLeagueFilter(l); setStatFilter('ALL') }}
          >
            {l !== 'ALL' ? `${sportEmoji(l)} ` : ''}{l}
          </button>
        ))}
        {leagues.length > 12 && (
          <select
            className="form-input"
            style={{ padding: '3px 8px', fontSize: 12 }}
            value={leagueFilter}
            onChange={e => { setLeagueFilter(e.target.value); setStatFilter('ALL') }}
          >
            {leagues.map(l => <option key={l}>{l}</option>)}
          </select>
        )}
      </div>

      {/* Stat filter — only shows stat types for the active league */}
      <div className="filter-bar" style={{ marginTop: -6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>STAT</span>
        {statTypes.slice(0, 8).map(s => (
          <button
            key={s}
            className={`filter-btn${statFilter === s ? ' active' : ''}`}
            onClick={() => setStatFilter(s)}
          >
            {s}
          </button>
        ))}
        {statTypes.length > 8 && (
          <select
            className="form-input"
            style={{ padding: '3px 8px', fontSize: 12 }}
            value={statFilter}
            onChange={e => setStatFilter(e.target.value)}
          >
            {statTypes.map(s => <option key={s}>{s}</option>)}
          </select>
        )}
        {lineMoves.length > 0 && (
          <button
            className={`filter-btn${movesOnly ? ' active' : ''}`}
            onClick={() => setMovesOnly(m => !m)}
            style={movesOnly
              ? { borderColor: 'var(--yellow)', background: 'rgba(234,179,8,0.1)', color: 'var(--yellow)' }
              : {}}
          >
            ⚡ Moves Only ({lineMoves.length})
          </button>
        )}
      </div>

      {/* Probability legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <span className="prob-badge green">≥65% Hit</span>
        <span className="prob-badge yellow">57–64%</span>
        <span className="prob-badge orange">52–56%</span>
        <span className="prob-badge red">&lt;52%</span>
        <span className="note" style={{ alignSelf: 'center' }}>
          Probabilities estimated · line moves adjust ±5% per point
        </span>
      </div>

      {/* ── Slips section ──────────────────────────────────────── */}
      {isFirstLoad ? (
        <div className="status-box">
          <div className="spinner" />
          <div style={{ marginTop: 8 }}>Loading projections…</div>
        </div>
      ) : (
        <>
          {/* Sport-aware heading */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10,
            marginBottom: 14,
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {slipsHeading}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{slipsCount}</span>
          </div>

          <div className="combos-grid">
            <ComboColumn
              legCount={2}
              combos={combos2}
              showLeague={isAllLeagues}
              isLoading={false}
            />
            <ComboColumn
              legCount={4}
              combos={combos4}
              showLeague={isAllLeagues}
              isLoading={false}
            />
            <ComboColumn
              legCount={6}
              combos={combos6}
              showLeague={isAllLeagues}
              isLoading={false}
            />
          </div>
        </>
      )}

      {/* ── All picks table ────────────────────────────────────── */}
      <div className="picks-section">
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 10,
        }}>
          <div className="picks-section-title">
            All Projections ({filtered.length})
            {!isAllLeagues && (
              <span style={{ color: 'var(--accent)', marginLeft: 6 }}>
                · {leagueFilter} only
              </span>
            )}
            {movesOnly && (
              <span style={{ color: 'var(--yellow)', marginLeft: 6 }}>· moves only</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center' }}>Sort:</span>
            {[
              ['prob',   'Probability'],
              ['moves',  'Moves'],
              ['line',   'Line'],
              ['player', 'Player'],
            ].map(([val, lbl]) => (
              <button
                key={val}
                className={`filter-btn${sortBy === val ? ' active' : ''}`}
                onClick={() => setSortBy(val)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {sorted.length === 0 && !loading ? (
          <div className="empty-state">
            <div style={{ fontSize: 32 }}>📭</div>
            <p>No projections match the current filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>League</th>
                  <th>Stat</th>
                  <th>Line</th>
                  <th>Move</th>
                  <th>Type</th>
                  <th>Hit Prob</th>
                  <th>2-Leg EV</th>
                  <th>4-Leg EV</th>
                  <th>6-Leg EV</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const isGoblin = p.oddsType === 'goblin'
                  const mult2 = isGoblin ? getEffectiveMult(2, 1) : PP_MULTIPLIERS[2]
                  const mult4 = isGoblin ? getEffectiveMult(4, 1) : PP_MULTIPLIERS[4]
                  const mult6 = isGoblin ? getEffectiveMult(6, 1) : PP_MULTIPLIERS[6]
                  const ev2 = Math.pow(p.probability, 2) * mult2 - 1
                  const ev4 = Math.pow(p.probability, 4) * mult4 - 1
                  const ev6 = Math.pow(p.probability, 6) * mult6 - 1
                  const m = p.lineMove
                  return (
                    <tr key={p.id} style={m ? { background: 'rgba(234,179,8,0.03)' } : undefined}>
                      <td style={{ fontWeight: 500 }}>{p.playerName}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.team}</td>
                      <td>
                        <span className="tag">{p.league}</span>
                      </td>
                      <td>{p.statType}</td>
                      <td>
                        <div className="line-cell">
                          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{p.line}</span>
                          {m && (
                            <span
                              className={`line-dir ${m.direction}`}
                              title={`Was ${m.prevLine}`}
                            >
                              {m.direction === 'up' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {m ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span className={`rec-badge ${m.rec}`} style={{ fontSize: 10 }}>
                              {m.label}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                              {m.prevLine} → {m.currLine}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td><OddsTypePill type={p.oddsType} /></td>
                      <td><ProbBadge prob={p.probability} /></td>
                      <td><EVBadge ev={ev2} /></td>
                      <td><EVBadge ev={ev4} /></td>
                      <td><EVBadge ev={ev6} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {formatTime(p.startTime)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
