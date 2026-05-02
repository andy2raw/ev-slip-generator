import { useState } from 'react'
import PrizePicksSection from './components/PrizePicksSection.jsx'
import HardRockSection from './components/HardRockSection.jsx'
import TrackerSection from './components/TrackerSection.jsx'
import HistorySection from './components/HistorySection.jsx'

const TABS = [
  { id: 'prizepicks', label: 'PrizePicks' },
  { id: 'hardrock',   label: 'HardRock'   },
  { id: 'tracker',    label: 'Tracker'    },
  { id: 'history',    label: 'History'    },
]

export default function App() {
  const [tab, setTab] = useState('prizepicks')

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">EV <span>Slip Generator</span></div>
        <nav className="nav-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === 'prizepicks' && <PrizePicksSection />}
        {tab === 'hardrock'   && <HardRockSection />}
        {tab === 'tracker'    && <TrackerSection />}
        {tab === 'history'    && <HistorySection />}
      </main>
    </div>
  )
}
