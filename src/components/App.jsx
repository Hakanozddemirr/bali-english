import { useEffect, useState } from 'react'
import { AppProvider } from '../lib/store'
import { initTTS } from '../lib/tts'
import Home from './Home'
import DayScreen from './DayScreen'
import Flashcards from './Flashcards'
import Quiz from './Quiz'
import Pronunciation from './Pronunciation'
import Assistant from './Assistant'
import Guide from './Guide'
import Settings from './Settings'

const TABS = [
  { name: 'home', label: 'Günler', icon: '🏝️' },
  { name: 'guide', label: 'Cep Rehberi', icon: '📖' },
  { name: 'settings', label: 'Ayarlar', icon: '⚙️' },
]

function Router() {
  const [view, setView] = useState({ name: 'home' })
  useEffect(() => initTTS(), [])

  const go = (name, day) => setView({ name, day })
  const showNav = ['home', 'guide', 'settings'].includes(view.name)

  return (
    <>
      {view.name === 'home' && <Home onOpenDay={(d) => go('day', d)} />}
      {view.name === 'day' && (
        <DayScreen
          day={view.day}
          onBack={() => go('home')}
          onOpen={(name) => go(name, view.day)}
        />
      )}
      {view.name === 'cards' && <Flashcards day={view.day} onBack={() => go('day', view.day)} />}
      {view.name === 'quiz' && <Quiz day={view.day} onBack={() => go('day', view.day)} />}
      {view.name === 'pron' && <Pronunciation day={view.day} onBack={() => go('day', view.day)} />}
      {view.name === 'talk' && <Assistant day={view.day} onBack={() => go('day', view.day)} />}
      {view.name === 'guide' && <Guide />}
      {view.name === 'settings' && <Settings />}

      {showNav && (
        <nav className="bottom-nav">
          {TABS.map((t) => (
            <button
              key={t.name}
              className={view.name === t.name ? 'on' : ''}
              onClick={() => go(t.name)}
            >
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
