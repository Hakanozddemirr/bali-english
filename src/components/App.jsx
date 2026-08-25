import { useEffect, useState } from 'react'
import { AppProvider, useApp } from '../lib/store'
import { initTTS, setVoicePrefs } from '../lib/tts'
import Home from './Home'
import DayScreen from './DayScreen'
import Chunks from './Chunks'
import Practice from './Practice'
import Talk from './Talk'
import FreeTalkHub from './FreeTalkHub'
import Quiz from './Quiz'
import Clarity from './Clarity'
import Guide from './Guide'
import Settings from './Settings'
import Calibration from './Calibration'

const TABS = [
  { name: 'home', label: 'Günler', icon: '🏝️' },
  { name: 'free', label: 'Free Talk', icon: '🗣️' },
  { name: 'guide', label: 'Rehber', icon: '📖' },
  { name: 'settings', label: 'Ayarlar', icon: '⚙️' },
]

function Router() {
  const { state } = useApp()
  const [view, setView] = useState({ name: 'home' })
  useEffect(() => initTTS(), [])
  useEffect(() => setVoicePrefs({ accents: state.settings.accents }), [state.settings.accents])

  const go = (name, extra = {}) => setView({ name, ...extra })
  const showNav = ['home', 'free', 'guide', 'settings'].includes(view.name)

  return (
    <>
      {view.name === 'home' && (
        <Home onOpenDay={(d) => go('day', { day: d })} onCalib={() => go('calib')} />
      )}
      {view.name === 'calib' && <Calibration onDone={() => go('home')} />}
      {view.name === 'day' && (
        <DayScreen day={view.day} onBack={() => go('home')} onOpen={(name, extra) => go(name, { day: view.day, ...extra })} />
      )}
      {view.name === 'chunks' && <Chunks day={view.day} onBack={() => go('day', { day: view.day })} />}
      {view.name === 'practice' && <Practice day={view.day} onBack={() => go('day', { day: view.day })} />}
      {view.name === 'talk' && (
        <Talk day={view.day} simId={view.simId} onBack={() => go('day', { day: view.day })} />
      )}
      {view.name === 'quiz' && <Quiz day={view.day} onBack={() => go('day', { day: view.day })} />}
      {view.name === 'clarity' && <Clarity day={view.day} onBack={() => go('day', { day: view.day })} />}
      {view.name === 'free' && <FreeTalkHub onOpen={(ctxId) => go('freetalk', { ctxId })} />}
      {view.name === 'freetalk' && <Talk freeCtxId={view.ctxId} onBack={() => go('free')} />}
      {view.name === 'guide' && <Guide />}
      {view.name === 'settings' && <Settings />}

      {showNav && (
        <nav className="bottom-nav">
          {TABS.map((t) => (
            <button key={t.name} className={view.name === t.name ? 'on' : ''} onClick={() => go(t.name)}>
              <span className="i">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}
