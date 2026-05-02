import { useState, useMemo } from 'react'
import { usePrizePicks } from '../hooks/usePrizePicks.js'
import { findBestPPCombos } from '../utils/combos.js'
import { PP_MULTIPLIERS, formatProb, formatEV, probClass, probDot, formatTime } from '../utils/ev.js'

function ProbBadge({ prob }) {
  return <span className={`prob-badge ${probClass(prob)}`}>{formatProb(prob)}</span>
}

function EVBadge({ ev }) {
  return <span className={`ev-badge ${ev >= 0 ? 'pos' : 'neg'}`}>{formatEV(ev)}</span>
}

function OddsTypePill({ type }) {
  if (!type || type === 'standard') return null
  const colors = { demon: '#ef4444', goblin: '#22c55e', power: '#f97316' }
  const color = colors[type] || '#888'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}20`, padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' }}>
      {type}
    </span>
  )
}

// ── Line Move Panel ──────────────────────────────────────────────────────────

function LineMoveCard({ p }) {
  const m = p.lineMove
  const sign = m.delta > 0 ? '+' : ''
  return (
    <div className="line-move-card">
      <div className="line-move-player">{p.playerName}</div>
      <div className="line-move-stat">{p.statType} · {p.team} · <span className="tag" style={{ fontSize: 9 }}>{p.league}</span></div>

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

  // Sort: strongest moves first (by abs delta), then play > caution > skip
  const recOrder = { strong_play: 0, play: 1, lean_play: 2, neutral: 3, caution: 4, skip: 5 }
  const sorted = [...moves].sort((a, b) => {
    const recDiff = recOrder[a.lineMove.rec] - recOrder[b.lineMove.rec]
    if (recDiff !== 0) return recDiff
    return Math.abs(b.lineMove.delta) - Math.abs(a.lineMove.delta)
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
            {moves.filter(p => p.lineMove.rec === 'strong_play' || p.lineMove.rec === 'play').length} plays ·{' '}
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

// ── Combo Card ───────────────────────────────────────────────────────────────

function ComboCard({ title, subtitle, combos, isLoading }) {
  if (isLoading) {
    return (
      <div className="combo-card">
        <div className="combo-header"><span className="combo-label">{title}</span></div>
        <div className="status-box"><div className="spinner" /></div>
      </div>
    )
  }
  if (!combos.length) {
    return (
      <div className="combo-card">
        <div className="combo-header">
          <span className="combo-label">{title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{subtitle}</span>
        </div>
        <div className="status-box" style={{ padding: '20px' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>No combos available</span>
        </div>
      </div>
    )
  }
  return (
    <div className="combo-card">
      <div className="combo-header">
        <span className="combo-label">{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{subtitle}</span>
      </div>
      {combos.map((combo, idx) => (
        <div key={idx} className="combo-item">
          <div className="combo-item-header">
            <div className="combo-picks">
              {combo.picks.map((pick, pi) => (
                <div key={pi} className="combo-pick-line">
                  <div className="combo-pick-dot" style={{ background: probDot(pick.probability) }} />
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{pick.playerName}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Over {pick.line} {pick.statType}</span>
                  <OddsTypePill type={pick.oddsType} />
                  {pick.lineMove && (
                    <span style={{ fontSize: 10, color: pick.lineMove.direction === 'down' ? 'var(--green)' : 'var(--red)' }}>
                      {pick.lineMove.direction === 'down' ? '▼' : '▲'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <EVBadge ev={combo.ev} />
          </div>
          <div className="combo-footer">
            <span className="combo-footer-stat">
              Joint: <strong style={{ color: 'var(--text)' }}>{formatProb(combo.jointProb)}</strong>
            </span>
            <span className="combo-footer-stat">
              Payout: <strong style={{ color: 'var(--accent)' }}>{combo.mult}x</strong>
            </span>
            <span className="combo-rank">#{idx + 1}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Section ─────────────────────────────────────────────────────────────

export default function PrizePicksSection() {
  const { projections, loading, error, lastRefresh, countdown, refresh } = usePrizePicks()
  const [leagueFilter, setLeagueFilter] = useState('ALL')
  const [statFilter, setStatFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('prob')
  const [movesOnly, setMovesOnly] = useState(false)

  const lineMoves = useMemo(() => projections.filter(p => p.lineMove), [projections])

  const leagues = useMemo(() => {
    const s = new Set(projections.map(p => p.league).filter(Boolean))
    return ['ALL', ...Array.from(s).sort()]
  }, [projections])

  const statTypes = useMemo(() => {
    const s = new Set(projections.map(p => p.statType).filter(Boolean))
    return ['ALL', ...Array.from(s).sort()]
  }, [projections])

  const filtered = useMemo(() => {
    return projections
      .filter(p => leagueFilter === 'ALL' || p.league === leagueFilter)
      .filter(p => statFilter === 'ALL' || p.statType === statFilter)
      .filter(p => !movesOnly || p.lineMove)
  }, [projections, leagueFilter, statFilter, movesOnly])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'prob')  return b.probability - a.probability
      if (sortBy === 'line')  return a.line - b.line
      if (sortBy === 'player') return a.playerName.localeCompare(b.playerName)
      if (sortBy === 'moves') {
        // Moves first, then by abs delta descending
        const aHas = a.lineMove ? 1 : 0
        const bHas = b.lineMove ? 1 : 0
        if (bHas !== aHas) return bHas - aHas
        return Math.abs(b.lineMove?.delta ?? 0) - Math.abs(a.lineMove?.delta ?? 0)
      }
      return 0
    })
  }, [filtered, sortBy])

  const combos2 = useMemo(() => findBestPPCombos(filtered, 2), [filtered])
  const combos4 = useMemo(() => findBestPPCombos(filtered, 4), [filtered])
  const combos6 = useMemo(() => findBestPPCombos(filtered, 6), [filtered])

  const fmtCountdown = () => {
    const m = Math.floor(countdown / 60)
    const s = countdown % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isFirstLoad = loading && projections.length === 0

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
            The PrizePicks API is proxied through Vite — make sure you're running <code>npm run dev</code>.
          </div>
        </div>
      )}

      {/* Line Move Panel — appears after first successful refresh comparison */}
      <LineMovePanel moves={lineMoves} />

      {/* Filters */}
      <div className="filter-bar">
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>LEAGUE</span>
        {leagues.slice(0, 10).map(l => (
          <button key={l} className={`filter-btn${leagueFilter === l ? ' active' : ''}`} onClick={() => setLeagueFilter(l)}>
            {l}
          </button>
        ))}
        {leagues.length > 10 && (
          <select className="form-input" style={{ padding: '3px 8px', fontSize: 12 }} value={leagueFilter} onChange={e => setLeagueFilter(e.target.value)}>
            {leagues.map(l => <option key={l}>{l}</option>)}
          </select>
        )}
      </div>

      <div className="filter-bar" style={{ marginTop: -6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>STAT</span>
        {statTypes.slice(0, 8).map(s => (
          <button key={s} className={`filter-btn${statFilter === s ? ' active' : ''}`} onClick={() => setStatFilter(s)}>
            {s}
          </button>
        ))}
        {statTypes.length > 8 && (
          <select className="form-input" style={{ padding: '3px 8px', fontSize: 12 }} value={statFilter} onChange={e => setStatFilter(e.target.value)}>
            {statTypes.map(s => <option key={s}>{s}</option>)}
          </select>
        )}
        {lineMoves.length > 0 && (
          <button
            className={`filter-btn${movesOnly ? ' active' : ''}`}
            onClick={() => setMovesOnly(m => !m)}
            style={movesOnly ? { borderColor: 'var(--yellow)', background: 'rgba(234,179,8,0.1)', color: 'var(--yellow)' } : {}}
          >
            ⚡ Moves Only ({lineMoves.length})
          </button>
        )}
      </div>

      {/* Prob legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className="prob-badge green">≥65% Hit</span>
        <span className="prob-badge yellow">57–64%</span>
        <span className="prob-badge orange">52–56%</span>
        <span className="prob-badge red">&lt;52%</span>
        <span className="note" style={{ alignSelf: 'center' }}>
          Probabilities estimated · line moves adjust prob ±5% per point
        </span>
      </div>

      {/* Best Combos */}
      {isFirstLoad ? (
        <div className="status-box"><div className="spinner" /><div style={{ marginTop: 8 }}>Loading projections…</div></div>
      ) : (
        <div className="combos-grid">
          <ComboCard title="Best 2-Leg Slips" subtitle={`${PP_MULTIPLIERS[2]}x payout`} combos={combos2} isLoading={isFirstLoad} />
          <ComboCard title="Best 4-Leg Slips" subtitle={`${PP_MULTIPLIERS[4]}x payout`} combos={combos4} isLoading={isFirstLoad} />
          <ComboCard title="Best 6-Leg Slips" subtitle={`${PP_MULTIPLIERS[6]}x payout`} combos={combos6} isLoading={isFirstLoad} />
        </div>
      )}

      {/* All picks table */}
      <div className="picks-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="picks-section-title">
            All Projections ({filtered.length})
            {movesOnly && <span style={{ color: 'var(--yellow)', marginLeft: 6 }}>· moves only</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center' }}>Sort:</span>
            {[['prob', 'Probability'], ['moves', 'Moves'], ['line', 'Line'], ['player', 'Player']].map(([val, lbl]) => (
              <button key={val} className={`filter-btn${sortBy === val ? ' active' : ''}`} onClick={() => setSortBy(val)}>
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
                  <th>Est. Prob</th>
                  <th>2-Leg EV</th>
                  <th>4-Leg EV</th>
                  <th>6-Leg EV</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const ev2 = p.probability * PP_MULTIPLIERS[2] - 1
                  const ev4 = Math.pow(p.probability, 4) * PP_MULTIPLIERS[4] - 1
                  const ev6 = Math.pow(p.probability, 6) * PP_MULTIPLIERS[6] - 1
                  const m = p.lineMove
                  return (
                    <tr key={p.id} style={m ? { background: 'rgba(234,179,8,0.03)' } : undefined}>
                      <td style={{ fontWeight: 500 }}>{p.playerName}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.team}</td>
                      <td><span className="tag">{p.league}</span></td>
                      <td>{p.statType}</td>
                      <td>
                        <div className="line-cell">
                          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{p.line}</span>
                          {m && (
                            <span className={`line-dir ${m.direction}`} title={`Was ${m.prevLine}`}>
                              {m.direction === 'up' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {m ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span className={`rec-badge ${m.rec}`} style={{ fontSize: 10 }}>{m.label}</span>
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
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatTime(p.startTime)}</td>
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
