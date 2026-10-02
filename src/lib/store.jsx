import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { todayISO, addDays } from './dates'
import { DEFAULT_MODEL } from './claude'
import { addCard } from './cards'

export const KEY = 'baliEnglish.v3'
const V2_KEY = 'baliEnglish.v2'
const OLD_KEY = 'baliEnglish.v1'

// Eski model kimliklerini güncel karşılıklarına taşı
const MODEL_MIGRATE = {
  'claude-opus-5': 'claude-opus-5-5',
  'claude-opus-4-6': 'claude-opus-5-5',
  'claude-sonnet-5': 'claude-sonnet-5-5',
}

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

// v3: günlük sabah sistemi. v2 alanları (7 günlük sprint) arşiv olarak korunur.
const v3Fields = () => ({
  course: { done: {}, watched: {}, labBest: {}, skipped: {} }, // ders anahtarı bazında
  labCache: {},  // API ile üretilmiş Yapı Laboratuvarı içerikleri
  book: { reading: 0, puzzle: 0 }, // en son bitirilen okuma metni / bulmaca bloğu
  cards: {},     // id -> {id,type,en,tr,ex,src,box,due,created}
  log: {},       // 'YYYY-MM-DD' -> günlük kayıt (bkz. emptyLog)
  journal: [],   // {date, text, fixed}
  weekly: [],    // {date, text, feedback}
})

export const emptyLog = () => ({
  review: false, reviewCount: 0,
  lessons: [],   // bugün Lab'ı bitirilen dersler
  book: false, bookParts: [],
  talkSec: 0,
  journal: false,
  words: 0,      // bugün eklenen kitap kelimesi
})

function defaultState() {
  return {
    version: 3,
    ...v3Fields(),
    startDate: todayISO(),
    tripDate: addDays(todayISO(), 7),
    settings: {
      apiKey: '',
      model: DEFAULT_MODEL,
      rate: 0.95,
      talkMode: 'guided', // guided | normal | realistic
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
function hydrate(s) {
  const d = defaultState()
  const out = {
    ...d, ...s,
    settings: { ...d.settings, ...s.settings },
    stats: { ...d.stats, ...s.stats },
    course: { ...d.course, ...s.course },
    book: { ...d.book, ...s.book },
  }
  out.settings.model = MODEL_MIGRATE[out.settings.model] || out.settings.model
  out.version = 3
  return out
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return hydrate(JSON.parse(raw))
    // v2 → v3: hiçbir şey silinmez, yeni alanlar eklenir
    const v2 = localStorage.getItem(V2_KEY)
    if (v2) {
      const s = hydrate(JSON.parse(v2))
      s.settings.talkMode = 'guided'
      return s
    }
    const old = localStorage.getItem(OLD_KEY)
    const fresh = defaultState()
    if (old) {
      try {
        const o = JSON.parse(old)
        if (o.settings?.apiKey) fresh.settings.apiKey = o.settings.apiKey
        if (o.settings?.model) fresh.settings.model = MODEL_MIGRATE[o.settings.model] || o.settings.model
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
  state.mistakes = state.mistakes.slice(0, 80)
  // Hatalar tekrar destesine de girer: ön yüz yanlış cümle, arka yüz doğrusu
  addCard(state, { type: 'mistake', en: fix, tr: '', ex: orig, src: note || '' })
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

// ---- v3: günlük kayıt ----
export function ensureLog(state, date = todayISO()) {
  state.log[date] = { ...emptyLog(), ...(state.log[date] || {}) }
  return state.log[date]
}

export const getLog = (state, date = todayISO()) => ({ ...emptyLog(), ...(state.log[date] || {}) })

export const MIN_TALK = 300   // minimum gün: tekrar + 5 dk konuşma
export const FULL_TALK = 600

// 'full' | 'min' | 'partial' | null
export function dayStatus(l) {
  if (!l) return null
  const full = l.review && l.lessons.length > 0 && l.book && l.talkSec >= FULL_TALK && l.journal
  if (full) return 'full'
  if (l.review && l.talkSec >= MIN_TALK) return 'min'
  if (l.review || l.lessons.length || l.book || l.talkSec > 0 || l.journal) return 'partial'
  return null
}

// Seri: en az "minimum" yapılmış ardışık günler. Bugün henüz yapılmadıysa seri dünden sayılır.
export function streak(state) {
  let n = 0
  let d = todayISO()
  const ok = (iso) => ['full', 'min'].includes(dayStatus(state.log[iso] && { ...emptyLog(), ...state.log[iso] }))
  if (!ok(d)) d = addDays(d, -1)
  while (ok(d)) { n++; d = addDays(d, -1) }
  return n
}

export function bestStreak(state) {
  const dates = Object.keys(state.log).sort()
  let best = 0, cur = 0, prev = null
  for (const iso of dates) {
    const good = ['full', 'min'].includes(dayStatus({ ...emptyLog(), ...state.log[iso] }))
    if (good && prev && addDays(prev, 1) === iso) cur++
    else cur = good ? 1 : 0
    if (!good) cur = 0
    best = Math.max(best, cur)
    prev = iso
  }
  return best
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
