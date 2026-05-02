import { useState, useEffect, useMemo } from 'react'
import { load, save, uid, getMondayISO, isSameWeek } from '../utils/storage.js'
import { formatDollars, formatShortDate } from '../utils/ev.js'

function WeeklyGoal({ data, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [goalInput, setGoalInput] = useState(data.weeklyGoal)

  const weeklyBets = useMemo(() =>
    data.bets.filter(b => isSameWeek(b.timestamp, data.weekStart))
  , [data])

  const weeklyProfit = useMemo(() =>
    weeklyBets.reduce((acc, b) => {
      if (b.result === 'win')  return acc + b.payout - b.amount
      if (b.result === 'loss') return acc - b.amount
      if (b.result === 'push') return acc
      return acc
    }, 0)
  , [weeklyBets])

  const goalProgress = Math.max(0, Math.min(1, weeklyProfit / data.weeklyGoal))

  const saveGoal = () => {
    const g = parseFloat(goalInput)
    if (!isNaN(g) && g > 0) {
      onUpdate({ ...data, weeklyGoal: g })
    }
    setEditing(false)
  }

  const resetWeek = () => {
    if (window.confirm('Reset weekly progress? This updates the week start date to today.')) {
      onUpdate({ ...data, weekStart: getMondayISO(new Date()) })
    }
  }

  return (
    <div className="goal-section">
      <div className="goal-top">
        <span className="goal-label">Weekly Goal Progress</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editing ? (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Goal $</span>
              <input
                className="form-input"
                style={{ width: 80, padding: '3px 8px', fontSize: 13 }}
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveGoal()}
              />
              <button className="btn btn-primary btn-sm" onClick={saveGoal}>Save</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <>
              <span className="goal-amounts">
                <strong style={{ color: weeklyProfit >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                  {formatDollars(weeklyProfit)}
                </strong>
                {' / '}
                {formatDollars(data.weeklyGoal)}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit Goal</button>
              <button className="btn btn-ghost btn-sm" onClick={resetWeek}>↺</button>
            </>
          )}
        </div>
      </div>

      <div className="progress-wrap">
        <div
          className="progress-fill"
          style={{
            width: `${goalProgress * 100}%`,
            background: weeklyProfit < 0
              ? 'linear-gradient(90deg, #7f1d1d, var(--red))'
              : undefined,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          ['Bets this week', weeklyBets.length],
          ['Wins', weeklyBets.filter(b => b.result === 'win').length],
          ['Losses', weeklyBets.filter(b => b.result === 'loss').length],
          ['Pending', weeklyBets.filter(b => b.result === 'pending').length],
        ].map(([label, val]) => (
          <div key={label} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {label}: <strong style={{ color: 'var(--text)' }}>{val}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function AddBetForm({ onAdd }) {
  const [form, setForm] = useState({
    source: 'PrizePicks',
    description: '',
    amount: '',
    payout: '',
    result: 'pending',
  })

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const submit = (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.description.trim() || isNaN(amount) || amount <= 0) return

    const payout = form.result === 'win' ? parseFloat(form.payout) || 0 : 0

    onAdd({
      id: uid(),
      timestamp: new Date().toISOString(),
      source: form.source,
      description: form.description.trim(),
      amount,
      payout,
      result: form.result,
    })

    setForm({ source: form.source, description: '', amount: '', payout: '', result: 'pending' })
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Log a Bet</div>
      </div>
      <div className="card-body">
        <form onSubmit={submit}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Source</label>
              <select
                className="form-input"
                value={form.source}
                onChange={e => set('source', e.target.value)}
              >
                <option>PrizePicks</option>
                <option>HardRock</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Bet Amount ($)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="10.00"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Description (picks, slip details)</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. LeBron Over 18.5 Pts + Curry Over 4.5 3PM (2-leg)"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Result</label>
            <div className="outcome-row">
              {[['win', 'Win'], ['loss', 'Loss'], ['push', 'Push'], ['pending', 'Pending']].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  className={`outcome-btn ${val}${form.result === val ? ' active' : ''}`}
                  onClick={() => set('result', val)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {form.result === 'win' && (
            <div className="form-field">
              <label className="form-label">Total Payout Received ($)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="30.00"
                value={form.payout}
                onChange={e => set('payout', e.target.value)}
              />
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Log Bet
          </button>
        </form>
      </div>
    </div>
  )
}

function RecentBets({ bets, onUpdate }) {
  const recent = [...bets].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10)

  const setResult = (id, result, payout) => {
    onUpdate(bets.map(b => b.id === id ? { ...b, result, payout: payout ?? b.payout } : b))
  }

  const deleteBet = (id) => {
    if (window.confirm('Delete this bet?')) {
      onUpdate(bets.filter(b => b.id !== id))
    }
  }

  if (!recent.length) {
    return (
      <div className="card">
        <div className="card-header"><div className="card-title">Recent Bets</div></div>
        <div className="empty-state"><div style={{ fontSize: 28 }}>📋</div><p>No bets logged yet.</p></div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Recent Bets</div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last 10</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
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
            {recent.map(b => {
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
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.description}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatDollars(b.amount)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{b.result === 'win' ? formatDollars(b.payout) : '—'}</td>
                  <td>
                    {pnl != null
                      ? <span style={{ fontWeight: 600, color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatDollars(pnl)}</span>
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>
                    }
                  </td>
                  <td>
                    {b.result === 'pending' ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm" style={{ background: 'var(--green-bg)', color: 'var(--green)', border: 'none', padding: '2px 8px' }}
                          onClick={() => {
                            const p = window.prompt('Enter payout amount received ($):')
                            if (p) setResult(b.id, 'win', parseFloat(p))
                          }}>W</button>
                        <button className="btn btn-sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: 'none', padding: '2px 8px' }}
                          onClick={() => setResult(b.id, 'loss', 0)}>L</button>
                        <button className="btn btn-sm" style={{ background: 'var(--yellow-bg)', color: 'var(--yellow)', border: 'none', padding: '2px 8px' }}
                          onClick={() => setResult(b.id, 'push', b.amount)}>P</button>
                      </div>
                    ) : (
                      <span className={`result-pill ${b.result}`}>{b.result}</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteBet(b.id)} style={{ padding: '2px 6px', color: 'var(--text-dim)' }}>×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function TrackerSection() {
  const [data, setData] = useState(() => load())

  const persist = (newData) => {
    setData(newData)
    save(newData)
  }

  const addBet = (bet) => {
    persist({ ...data, bets: [bet, ...data.bets] })
  }

  const updateBets = (newBets) => {
    persist({ ...data, bets: newBets })
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Bet Tracker</div>
          <div className="section-sub">Log bets, track weekly goal, monitor results</div>
        </div>
      </div>

      <WeeklyGoal data={data} onUpdate={persist} />

      <div className="tracker-grid">
        <AddBetForm onAdd={addBet} />

        <div className="card">
          <div className="card-header"><div className="card-title">All-Time Summary</div></div>
          <div className="card-body">
            {(() => {
              const resolved = data.bets.filter(b => b.result !== 'pending')
              const wins = resolved.filter(b => b.result === 'win')
              const losses = resolved.filter(b => b.result === 'loss')
              const totalWagered = resolved.reduce((s, b) => s + b.amount, 0)
              const totalPayout  = wins.reduce((s, b) => s + b.payout, 0)
              const totalStake   = wins.reduce((s, b) => s + b.amount, 0) + losses.reduce((s, b) => s + b.amount, 0)
              const netPnL       = totalPayout - totalWagered
              const roi          = totalWagered > 0 ? netPnL / totalWagered : 0
              const winRate      = resolved.length > 0 ? wins.length / resolved.length : 0

              return (
                <>
                  {[
                    ['Total Bets', resolved.length],
                    ['Win Rate', `${(winRate * 100).toFixed(1)}%`],
                    ['Total Wagered', formatDollars(totalWagered)],
                    ['Net P&L', formatDollars(netPnL), netPnL >= 0 ? 'pos' : 'neg'],
                    ['ROI', `${(roi * 100).toFixed(1)}%`, roi >= 0 ? 'pos' : 'neg'],
                    ['Pending', data.bets.filter(b => b.result === 'pending').length],
                  ].map(([label, val, cls]) => (
                    <div key={label} className="stat-row">
                      <span className="stat-label">{label}</span>
                      <span className={`stat-value${cls ? ` ${cls}` : ''}`}>{val}</span>
                    </div>
                  ))}
                </>
              )
            })()}
          </div>
        </div>
      </div>

      <RecentBets bets={data.bets} onUpdate={updateBets} />
    </div>
  )
}
