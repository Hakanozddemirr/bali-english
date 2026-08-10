import { todayISO, addDays } from './dates'

// Basit Leitner kutusu: kutu -> kaç gün sonra tekrar
export const INTERVALS = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 7 }

export function introduceCard(state, id) {
  if (!state.srs[id]) state.srs[id] = { box: 1, due: todayISO() }
}

export function answerCard(state, id, correct) {
  if (!state.srs[id]) state.srs[id] = { box: 1, due: todayISO() }
  const c = state.srs[id]
  c.box = correct ? Math.min(5, c.box + 1) : 1
  c.due = addDays(todayISO(), INTERVALS[c.box])
}

// Tekrar zamanı gelmiş eski kartlar (bugünün yeni kelimeleri hariç)
export function dueReviewIds(state, excludeIds = []) {
  const today = todayISO()
  const ex = new Set(excludeIds)
  return Object.entries(state.srs)
    .filter(([id, c]) => c.due <= today && !ex.has(id))
    .map(([id]) => id)
}

// Gün 10 için: en zayıf kartlar (kutu 1-2 + vadesi gelenler)
export function hardestCardIds(state, minCount = 15) {
  const entries = Object.entries(state.srs)
  const weak = entries.filter(([, c]) => c.box <= 2 || c.due <= todayISO()).map(([id]) => id)
  if (weak.length >= minCount) return weak
  const rest = entries
    .filter(([id]) => !weak.includes(id))
    .sort((a, b) => a[1].box - b[1].box)
    .map(([id]) => id)
  return [...weak, ...rest.slice(0, minCount - weak.length)]
}
