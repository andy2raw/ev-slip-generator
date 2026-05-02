import { useState, useMemo } from 'react'
import { load, save } from '../utils/storage.js'
import { formatDollars, formatDate, formatShortDate } from '../utils/ev.js'

export default function HistorySection() {
  const [data, setData] = useState(() => load())
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const sorted = useMemo(() =>
    [...data.bets].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  , [data.bets])

  const filtered = useMemo(() => {
    return sorted.filter(b => {
      if (sourceFilter !== 'ALL' && b.source !== sourceFilter) return false
      if (resultFilter !== 'ALL' && b.result !== resultFilter) return false
      if (search && !b.description.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [sorted, sourceFilter, resultFilter, search])

  const resolved = sorted.filter(b => b.result !== 'pending')
  const wins     = resolved.filter(b => b.result === 'win')
  const losses   = resolved.filter(b => b.result === 'loss')
  const pending  = sorted.filter(b => b.result === 'pending')

  const totalWagered   = resolved.reduce((s, b) => s + b.amount, 0)
  const totalPayout    = wins.reduce((s, b) => s + b.payout, 0)
  const totalStake     = resolved.reduce((s, b) => s + b.amount, 0)
  const netPnL         = totalPayout - totalStake
  const roi            = totalStake > 0 ? netPnL / totalStake : 0
  const winRate        = resolved.length > 0 ? wins.length / resolved.length : 0
  const avgBet         = resolved.length > 0 ? totalStake / resolved.length : 0

  const deleteBet = (id) => {
    if (!window.confirm('Delete this bet from history?')) return
    const updated = { ...data, bets: data.bets.filter(b => b.id !== id) }
    setData(updated)
    save(updated)
  }

  const clearAll = () => {
    if (!window.confirm('Delete ALL bet history? This cannot be undone.')) return
    const updated = { ...data, bets: [] }
    setData(updated)
    save(updated)
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Bet History</div>
          <div className="section-sub">{sorted.length} total bets logged</div>
        </div>
        {sorted.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={clearAll}>
            Clear All
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Bets</div>
          <div className="stat-card-value">{resolved.length}</div>
          <div className="stat-card-sub">{pending.length} pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Win Rate</div>
          <div className={`stat-card-value ${winRate >= 0.5 ? 'pos' : 'neg'}`}>
            {(winRate * 100).toFixed(1)}%
          </div>
          <div className="stat-card-sub">{wins.length}W – {losses.length}L</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Net P&L</div>
          <div className={`stat-card-value ${netPnL >= 0 ? 'pos' : 'neg'}`}>
            {formatDollars(netPnL)}
          </div>
          <div className="stat-card-sub">on {formatDollars(totalStake)} wagered</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">ROI</div>
          <div className={`stat-card-value ${roi >= 0 ? 'pos' : 'neg'}`}>
            {roi >= 0 ? '+' : ''}{(roi * 100).toFixed(1)}%
          </div>
          <div className="stat-card-sub">avg {formatDollars(avgBet)} / bet</div>
        </div>
      </div>

      {/* Per-source breakdown */}
      {sorted.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {['PrizePicks', 'HardRock', 'Other'].map(src => {
            const srcBets    = resolved.filter(b => b.source === src)
            if (!srcBets.length) return null
            const srcWins    = srcBets.filter(b => b.result === 'win')
            const srcPayout  = srcWins.reduce((s, b) => s + b.payout, 0)
            const srcStaked  = srcBets.reduce((s, b) => s + b.amount, 0)
            const srcPnL     = srcPayout - srcStaked

            return (
              <div key={src} className="card" style={{ flex: '1 1 180px', minWidth: 160 }}>
                <div className="card-header">
                  <div className="card-title" style={{ fontSize: 12 }}>
                    <span className="tag">{src}</span>
                  </div>
                </div>
                <div className="card-body" style={{ padding: '10px 14px' }}>
                  <div className="stat-row" style={{ padding: '5px 0' }}>
                    <span className="stat-label">Bets</span>
                    <span className="stat-value" style={{ fontSize: 14 }}>{srcBets.length}</span>
                  </div>
                  <div className="stat-row" style={{ padding: '5px 0' }}>
                    <span className="stat-label">Win%</span>
                    <span className="stat-value" style={{ fontSize: 14 }}>
                      {srcBets.length > 0 ? (srcWins.length / srcBets.length * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <div className="stat-row" style={{ padding: '5px 0', borderBottom: 'none' }}>
                    <span className="stat-label">P&L</span>
                    <span className={`stat-value ${srcPnL >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 14 }}>
                      {formatDollars(srcPnL)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ width: 220, padding: '5px 10px' }}
          placeholder="Search description…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          {['ALL', 'PrizePicks', 'HardRock', 'Other'].map(s => (
            <button key={s} className={`filter-btn${sourceFilter === s ? ' active' : ''}`} onClick={() => setSourceFilter(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          {['ALL', 'win', 'loss', 'push', 'pending'].map(r => (
            <button key={r} className={`filter-btn${resultFilter === r ? ' active' : ''}`} onClick={() => setResultFilter(r)}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>📚</div>
          <p style={{ marginTop: 8 }}>{sorted.length === 0 ? 'No bets logged yet. Head to the Tracker tab to add your first bet.' : 'No bets match the current filters.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Description</th>
                <th>Bet</th>
                <th>Payout</th>
                <th>P&L</th>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const pnl = b.result === 'win'  ? b.payout - b.amount
                          : b.result === 'loss' ? -b.amount
                          : b.result === 'push' ? 0
                          : null
                return (
                  <tr key={b.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatShortDate(b.timestamp)}
                    </td>
                    <td><span className="tag">{b.source}</span></td>
                    <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.description}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatDollars(b.amount)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {b.result === 'win' ? formatDollars(b.payout) : '—'}
                    </td>
                    <td>
                      {pnl != null
                        ? <span style={{ fontWeight: 600, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatDollars(pnl)}</span>
                        : <span style={{ color: 'var(--text-dim)' }}>—</span>
                      }
                    </td>
                    <td><span className={`result-pill ${b.result}`}>{b.result}</span></td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => deleteBet(b.id)}
                        style={{ padding: '2px 6px', color: 'var(--text-dim)' }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
