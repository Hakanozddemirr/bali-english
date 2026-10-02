import { useEffect, useState } from 'react'
import { AppProvider, useApp } from '../lib/store'
import { initTTS, setVoicePrefs } from '../lib/tts'
import Today from './Today'
import Courses from './Courses'
import Session from './Session'
import Lab from './Lab'
import Book from './Book'
import Review from './Review'
import Journal from './Journal'
import Capture from './Capture'
import Weekly from './Weekly'
import Words from './Words'
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
  { name: 'today', label: 'Bugün', icon: '☀️' },
  { name: 'courses', label: 'Dersler', icon: '🎬' },
  { name: 'free', label: 'Konuş', icon: '🗣️' },
  { name: 'words', label: 'Kelimeler', icon: '📗' },
  { name: 'settings', label: 'Ayarlar', icon: '⚙️' },
]
const NAV_VIEWS = ['today', 'courses', 'free', 'words', 'settings', 'guide']
const TAB_OF = { guide: 'words' }

function Router() {
  const { state } = useApp()
  const [view, setView] = useState({ name: 'today' })
  const [history, setHistory] = useState([])
  useEffect(() => initTTS(), [])
  useEffect(() => setVoicePrefs({ accents: state.settings.accents }), [state.settings.accents])
  useEffect(() => { window.scrollTo(0, 0) }, [view])

  // Sekme değişimi geçmişi sıfırlar; alt ekranlar geri tuşuyla bir önceki ekrana döner
  const go = (name, extra = {}) => {
    if (TABS.some((t) => t.name === name)) { setHistory([]); setView({ name, ...extra }); return }
    setHistory((h) => [...h, view])
    setView({ name, ...extra })
  }
  const back = () => {
    setHistory((h) => {
      const prev = h[h.length - 1]
      setView(prev || { name: 'today' })
      return h.slice(0, -1)
    })
  }
  const showNav = NAV_VIEWS.includes(view.name)
  const sprintBack = () => go('sprint')

  return (
    <>
      {view.name === 'today' && <Today go={go} />}
      {view.name === 'courses' && <Courses go={go} />}
      {view.name === 'session' && (
        <Session idx={view.idx} onBack={back}
          onLab={(key, opt = {}) => go('lab', { key, skip: !!opt.skip })}
          onSession={(idx) => setView({ name: 'session', idx })} />
      )}
      {view.name === 'lab' && <Lab key={view.key} lessonKey={view.key} skip={view.skip} onBack={back} onTalk={() => go('dailytalk')} />}
      {view.name === 'book' && <Book onBack={back} />}
      {view.name === 'review' && <Review onBack={back} />}
      {view.name === 'dailytalk' && <Talk daily onBack={back} />}
      {view.name === 'journal' && <Journal onBack={back} />}
      {view.name === 'capture' && <Capture onBack={back} />}
      {view.name === 'weekly' && <Weekly onBack={back} />}
      {view.name === 'words' && <Words go={go} />}
      {view.name === 'guide' && <Guide />}

      {view.name === 'free' && <FreeTalkHub onOpen={(ctxId) => go('freetalk', { ctxId })} onSprint={() => go('sprint')} />}
      {view.name === 'freetalk' && <Talk freeCtxId={view.ctxId} onBack={back} />}

      {/* Arşiv: 7 günlük Bali sprinti (v2) */}
      {view.name === 'sprint' && (
        <Home onOpenDay={(d) => go('day', { day: d })} onCalib={() => go('calib')} onBack={back} />
      )}
      {view.name === 'calib' && <Calibration onDone={back} />}
      {view.name === 'day' && (
        <DayScreen day={view.day} onBack={back} onOpen={(name, extra) => go(name, { day: view.day, ...extra })} />
      )}
      {view.name === 'chunks' && <Chunks day={view.day} onBack={back} />}
      {view.name === 'practice' && <Practice day={view.day} onBack={back} />}
      {view.name === 'talk' && <Talk day={view.day} simId={view.simId} onBack={back} />}
      {view.name === 'quiz' && <Quiz day={view.day} onBack={back} />}
      {view.name === 'clarity' && <Clarity day={view.day} onBack={back} />}
      {view.name === 'settings' && <Settings />}

      {showNav && (
        <nav className="bottom-nav">
          {TABS.map((t) => (
            <button key={t.name} className={(TAB_OF[view.name] || view.name) === t.name ? 'on' : ''} onClick={() => go(t.name)}>
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
