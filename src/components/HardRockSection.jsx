import { useState, useMemo } from 'react'
import { useOddsAPI, SPORTS } from '../hooks/useOddsAPI.js'
import { findBestSingles, findBestHRParlays } from '../utils/combos.js'
import { formatOdds, formatProb, formatEV, probClass, probDot, formatTime } from '../utils/ev.js'

function ProbBadge({ prob }) {
  return <span className={`prob-badge ${probClass(prob)}`}>{formatProb(prob)}</span>
}

function EVBadge({ ev }) {
  return <span className={`ev-badge ${ev >= 0 ? 'pos' : 'neg'}`}>{formatEV(ev)}</span>
}

function ComboCard({ title, subtitle, combos, isParlay }) {
  if (!combos.length) {
    return (
      <div className="combo-card">
        <div className="combo-header">
          <span className="combo-label">{title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{subtitle}</span>
        </div>
        <div className="status-box" style={{ padding: '20px' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>No positive-EV bets found</span>
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
      {combos.map((item, idx) => {
        if (!isParlay) {
          // Single bet
          return (
            <div key={idx} className="combo-item">
              <div className="combo-item-header">
                <div className="combo-picks">
                  <div className="combo-pick-line">
                    <div className="combo-pick-dot" style={{ background: probDot(item.probability) }} />
                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.game} · {item.marketLabel} · {item.sportLabel}
                  </div>
                </div>
                <EVBadge ev={item.ev} />
              </div>
              <div className="combo-footer">
                <span>Odds: <strong style={{ color: 'var(--text)' }}>{formatOdds(item.odds)}</strong></span>
                <span>True Prob: <strong style={{ color: 'var(--text)' }}>{formatProb(item.trueProb)}</strong></span>
                <span className="combo-rank">#{idx + 1}</span>
              </div>
            </div>
          )
        } else {
          // Parlay
          return (
            <div key={idx} className="combo-item">
              <div className="combo-item-header">
                <div className="combo-picks">
                  {item.picks.map((pick, pi) => (
                    <div key={pi} className="combo-pick-line">
                      <div className="combo-pick-dot" style={{ background: probDot(pick.probability) }} />
                      <span style={{ fontWeight: 500 }}>{pick.label}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {formatOdds(pick.odds)}
                      </span>
                    </div>
                  ))}
                </div>
                <EVBadge ev={item.ev} />
              </div>
              <div className="combo-footer">
                <span>Parlay: <strong style={{ color: 'var(--accent)' }}>{formatOdds(item.parlayAmerican)}</strong></span>
                <span>Joint: <strong style={{ color: 'var(--text)' }}>{formatProb(item.jointProb)}</strong></span>
                <span className="combo-rank">#{idx + 1}</span>
              </div>
            </div>
          )
        }
      })}
    </div>
  )
}

export default function HardRockSection() {
  const { bets, loading, error, lastRefresh, remaining, noHardRock, fetchOdds } = useOddsAPI()
  const [selectedSports, setSelectedSports] = useState(['basketball_nba', 'baseball_mlb'])
  const [marketFilter, setMarketFilter] = useState('ALL')

  const toggleSport = (key) => {
    setSelectedSports(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const filtered = useMemo(() => {
    return bets.filter(b => {
      if (marketFilter !== 'ALL' && b.market !== marketFilter) return false
      return true
    })
  }, [bets, marketFilter])

  const singles  = useMemo(() => findBestSingles(filtered, 5), [filtered])
  const parlays2 = useMemo(() => findBestHRParlays(filtered, 2, 5), [filtered])
  const parlays4 = useMemo(() => findBestHRParlays(filtered, 4, 5), [filtered])

  const positiveEV = filtered.filter(b => b.ev > 0)

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Hard Rock Bet</div>
          <div className="section-sub">
            EV calculated vs. no-vig market consensus · manual refresh to save API credits
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {remaining != null && (
            <span className="credits-badge">{remaining} API credits left</span>
          )}
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => fetchOdds(selectedSports)}
            disabled={loading || selectedSports.length === 0}
          >
            {loading ? <span className="spinner" /> : '↻'} Fetch Odds
          </button>
        </div>
      </div>

      {/* Sport selector */}
      <div className="sport-tabs">
        {SPORTS.map(s => (
          <button
            key={s.key}
            className={`filter-btn${selectedSports.includes(s.key) ? ' active' : ''}`}
            onClick={() => toggleSport(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-box">
          {error}
          <div className="note" style={{ marginTop: 4 }}>
            Each fetch uses API credits. If you see a 401 error, the API key may be invalid. 429 = rate limited.
          </div>
        </div>
      )}

      {noHardRock && (
        <div className="error-box" style={{ background: 'var(--yellow-bg)', borderColor: 'rgba(234,179,8,0.25)', color: 'var(--yellow)' }}>
          Hard Rock Bet isn't offering lines for these sports/markets right now. Try different sports, or check if HardRockBet.com is live in your state.
        </div>
      )}

      {/* Prompt to fetch */}
      {!loading && bets.length === 0 && !error && (
        <div className="empty-state" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 40 }}>🎰</div>
          <p style={{ marginTop: 12, fontSize: 15 }}>Select sports above, then click <strong>Fetch Odds</strong> to load Hard Rock Bet lines.</p>
          <p style={{ marginTop: 6 }}>Each fetch costs API credits — use the manual button to control usage.</p>
        </div>
      )}

      {loading && (
        <div className="status-box">
          <div className="spinner" />
          <div style={{ marginTop: 8 }}>Fetching odds from The Odds API…</div>
        </div>
      )}

      {!loading && bets.length > 0 && (
        <>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <span className="info-pill">
              {positiveEV.length} positive-EV bets found
            </span>
            <span className="info-pill">
              {bets.length} total HardRock lines
            </span>
            {/* Market filter */}
            <div className="filter-bar" style={{ marginBottom: 0 }}>
              {['ALL', 'h2h', 'spreads', 'totals'].map(m => (
                <button
                  key={m}
                  className={`filter-btn${marketFilter === m ? ' active' : ''}`}
                  onClick={() => setMarketFilter(m)}
                >
                  {m === 'ALL' ? 'All Markets' : m === 'h2h' ? 'Moneyline' : m === 'spreads' ? 'Spread' : 'Total'}
                </button>
              ))}
            </div>
          </div>

          {/* Prob legend */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span className="prob-badge green">≥65%</span>
            <span className="prob-badge yellow">57–64%</span>
            <span className="prob-badge orange">52–56%</span>
            <span className="prob-badge red">&lt;52%</span>
            <span className="note" style={{ alignSelf: 'center' }}>
              True probability derived from no-vig market consensus
            </span>
          </div>

          {/* Best combos */}
          <div className="combos-grid">
            <ComboCard
              title="Best Single Bets"
              subtitle="Positive EV vs market"
              combos={singles}
              isParlay={false}
            />
            <ComboCard
              title="Best 2-Leg Parlay"
              subtitle="Different games only"
              combos={parlays2}
              isParlay={true}
            />
            <ComboCard
              title="Best 4-Leg Parlay"
              subtitle="Highest EV combos"
              combos={parlays4}
              isParlay={true}
            />
          </div>

          {/* Full odds table */}
          <div className="picks-section">
            <div className="picks-section-title">
              All Hard Rock Bet Lines ({filtered.length})
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sport</th>
                    <th>Game</th>
                    <th>Market</th>
                    <th>Pick</th>
                    <th>HR Odds</th>
                    <th>True Prob</th>
                    <th>EV%</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id}>
                      <td><span className="tag">{b.sportLabel}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{b.game}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{b.marketLabel}</td>
                      <td style={{ fontWeight: 500 }}>{b.label}</td>
                      <td style={{ fontWeight: 600, color: b.odds > 0 ? 'var(--accent)' : 'var(--text)' }}>
                        {formatOdds(b.odds)}
                      </td>
                      <td><ProbBadge prob={b.trueProb} /></td>
                      <td><EVBadge ev={b.ev} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatTime(b.startTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
