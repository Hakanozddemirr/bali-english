import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { todayISO, addDays } from './dates'
import { DEFAULT_MODEL } from './claude'

const KEY = 'baliEnglish.v2'
const OLD_KEY = 'baliEnglish.v1'

export const emptyDay = () => ({
  seen: [],          // öğrenme modunda görülen chunk id'leri
  learnDone: false,
  drillDone: false,
  chunksDone: false, // görev 1
  practice: { done: 0, total: 0 }, // pratik ilerlemesi (opsiyonel bölüm)
  talkSec: 0,
  talkDone: false,   // görev 2 (10 dk konuşma)
  quizBest: 0,
  quizDone: false,   // görev 3
  simsDone: [],      // gün 7 mini simülasyonları
  done: false,
  doneDate: null,
  clarity: {},       // chunkId -> en iyi anlaşılabilirlik %
})

function defaultState() {
  return {
    version: 2,
    startDate: todayISO(),
    tripDate: addDays(todayISO(), 7),
    settings: {
      apiKey: '',
      model: DEFAULT_MODEL,
      rate: 0.95,
      talkMode: 'normal', // guided | normal | realistic
      accents: true,      // ABD/İngiliz/Avustralya sesleri arasında dönüşüm
    },
    srs: {},      // chunkId -> {box, due}
    known: {},    // chunkId -> true ("bunu biliyorum")
    days: {},
    favs: {},     // rehber kalıbı id -> true
    mistakes: [], // {orig, fix, note, date}
    stats: { speak: 0, quick: 0, social: 0, listenOk: 0, listenTotal: 0, quizzes: 0 },
    calib: { done: false, skipped: false, knownBasics: 0 },
  }
}

// v1'den güvenli göç: yalnızca ayarlar taşınır; eski kelime SRS'i yeni
// chunk müfredatıyla eşleşmediği için bilinçli olarak sıfırlanır.
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw)
      const d = defaultState()
      return { ...d, ...s, settings: { ...d.settings, ...s.settings }, stats: { ...d.stats, ...s.stats } }
    }
    const old = localStorage.getItem(OLD_KEY)
    const fresh = defaultState()
    if (old) {
      try {
        const o = JSON.parse(old)
        if (o.settings?.apiKey) fresh.settings.apiKey = o.settings.apiKey
        if (o.settings?.model) fresh.settings.model = o.settings.model
        if (o.settings?.rate) fresh.settings.rate = Math.max(0.85, o.settings.rate)
        if (o.tripDate && o.tripDate >= todayISO()) fresh.tripDate = o.tripDate
      } catch { /* eski veri bozuksa yok say */ }
    }
    return fresh
  } catch {
    return defaultState()
  }
}

function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* depolama hatası — sessizce geç */ }
}

// Gün tiki elle atılamaz; üç görev (kalıplar + 10 dk konuşma + test) bitince otomatik.
export function recomputeDay(state, n) {
  const d = state.days[n]
  if (!d) return false
  d.chunksDone = d.learnDone && d.drillDone
  const was = d.done
  d.done = d.chunksDone && d.talkDone && d.quizDone
  if (d.done && !was) d.doneDate = todayISO()
  return d.done && !was
}

export function getDayState(state, n) {
  return state.days[n] || emptyDay()
}

export function ensureDay(state, n) {
  if (!state.days[n]) state.days[n] = emptyDay()
  else state.days[n] = { ...emptyDay(), ...state.days[n] }
  return state.days[n]
}

export function addMistake(state, { orig, fix, note }) {
  if (!orig || !fix) return
  const dup = state.mistakes.some((m) => m.fix === fix && m.orig === orig)
  if (dup) return
  state.mistakes.unshift({ orig, fix, note: note || '', date: todayISO() })
  state.mistakes = state.mistakes.slice(0, 40)
}

// Aktif gün: tamamlanmamış ilk gün
export function activeDayNum(state, total) {
  for (let n = 1; n <= total; n++) if (!getDayState(state, n).done) return n
  return total
}

export function daysUntilTrip(state) {
  const a = new Date(todayISO() + 'T12:00:00')
  const b = new Date(state.tripDate + 'T12:00:00')
  return Math.round((b - a) / 86400000)
}

// "Bali'ye Hazırlık" tahmini (bilimsel değil — pratik gösterge)
export function readiness(state, totalDays) {
  const st = state.stats
  const days = Object.values(state.days)
  const speak = Math.min(100, Math.round(((st.speak || 0) / 90) * 100))
  const listening = st.listenTotal ? Math.round((st.listenOk / st.listenTotal) * 100) : 0
  const social = Math.min(100, Math.round(((st.social || 0) / 45) * 100))
  const quizAvg = days.length
    ? Math.round((days.reduce((a, d) => a + (d.quizBest || 0), 0) / (totalDays * 10)) * 100)
    : 0
  return { speak, listening, social, practical: quizAvg }
}

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [state, setState] = useState(loadState)
  const ref = useRef(state)

  const update = useCallback((fn) => {
    const next = structuredClone(ref.current)
    fn(next)
    ref.current = next
    saveState(next)
    setState(next)
    return next
  }, [])

  return <AppCtx.Provider value={{ state, update }}>{children}</AppCtx.Provider>
}

export function useApp() {
  return useContext(AppCtx)
}
