import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { todayISO, addDays, diffDays } from './dates'
import { DEFAULT_MODEL } from './claude'

const KEY = 'baliEnglish.v1'

export const emptyDay = () => ({
  seen: [],
  learnDone: false,
  matchDone: false,
  cardsDone: false,
  talkSec: 0,
  talkDone: false,
  quizBest: 0,
  quizDone: false,
  done: false,
  doneDate: null,
  pron: {},
})

function defaultState() {
  return {
    version: 1,
    startDate: todayISO(),
    tripDate: addDays(todayISO(), 12),
    settings: { apiKey: '', model: DEFAULT_MODEL, rate: 0.9 },
    srs: {},
    days: {},
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const s = JSON.parse(raw)
    return { ...defaultState(), ...s, settings: { ...defaultState().settings, ...s.settings } }
  } catch {
    return defaultState()
  }
}

function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* depolama dolu vb. — sessizce geç */
  }
}

// Gün içindeki üç görevin durumundan gün tamamlanmasını hesaplar.
// Tik elle atılamaz; yalnızca burada, otomatik atılır.
export function recomputeDay(state, n) {
  const d = state.days[n]
  if (!d) return false
  d.cardsDone = d.learnDone && d.matchDone
  const was = d.done
  d.done = d.cardsDone && d.talkDone && d.quizDone
  if (d.done && !was) d.doneDate = todayISO()
  return d.done && !was
}

export function getDayState(state, n) {
  return state.days[n] || emptyDay()
}

export function ensureDay(state, n) {
  if (!state.days[n]) state.days[n] = emptyDay()
  return state.days[n]
}

export function countStreak(state) {
  const dates = new Set(
    Object.values(state.days)
      .filter((d) => d.done && d.doneDate)
      .map((d) => d.doneDate),
  )
  if (dates.size === 0) return 0
  let cursor = todayISO()
  if (!dates.has(cursor)) cursor = addDays(cursor, -1) // bugün henüz yapılmadıysa dünden say
  let streak = 0
  while (dates.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function daysUntilTrip(state) {
  return diffDays(todayISO(), state.tripDate)
}

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [state, setState] = useState(loadState)
  const ref = useRef(state)

  // update(fn): fn state kopyasını değiştirir; yeni state'i döndürür (senkron).
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
