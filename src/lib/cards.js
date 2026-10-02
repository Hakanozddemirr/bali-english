// Kişisel tekrar kartları (kitap kelimeleri, hatalar, Lab cümleleri, "Yakala").
// Uzun vadeli aralıklı tekrar: 0 → 1 → 3 → 7 → 16 → 35 gün.
import { todayISO, addDays } from './dates'

export const CARD_INTERVALS = [0, 1, 3, 7, 16, 35]
export const MAX_BOX = CARD_INTERVALS.length - 1

export const CARD_TYPES = {
  word: { label: 'Kelime', icon: '📗' },
  mistake: { label: 'Hata', icon: '🔧' },
  lab: { label: 'Lab cümlesi', icon: '🧪' },
  capture: { label: 'Yakalanan', icon: '🎣' },
}

const cardId = (en) =>
  en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

// Aynı İngilizce ifade tekrar eklenirse kart sıfırlanmaz, sadece eksik alanlar dolar.
export function addCard(state, { type = 'word', en, tr = '', ex = '', src = '' }) {
  en = (en || '').trim()
  if (!en) return null
  const id = cardId(en)
  if (!id) return null
  const old = state.cards[id]
  if (old) {
    state.cards[id] = { ...old, tr: old.tr || tr, ex: old.ex || ex }
    // hata olarak tekrar geldiyse yeniden öne al
    if (type === 'mistake') { state.cards[id].box = 0; state.cards[id].due = todayISO() }
    return state.cards[id]
  }
  state.cards[id] = { id, type, en, tr: tr.trim(), ex: ex.trim(), src, box: 0, due: todayISO(), created: todayISO() }
  return state.cards[id]
}

export function gradeCard(state, id, correct) {
  const c = state.cards[id]
  if (!c) return
  c.box = correct ? Math.min(MAX_BOX, c.box + 1) : 0
  c.due = addDays(todayISO(), correct ? CARD_INTERVALS[c.box] : 1)
  c.seen = (c.seen || 0) + 1
  if (!correct) c.misses = (c.misses || 0) + 1
}

export function dueCards(state, limit = 40) {
  const today = todayISO()
  return Object.values(state.cards)
    .filter((c) => c.due <= today)
    // önce hatalar, sonra en zayıf kutular
    .sort((a, b) => (a.type === 'mistake' ? -1 : 0) - (b.type === 'mistake' ? -1 : 0) || a.box - b.box)
    .slice(0, limit)
}

export const learnedCount = (state) => Object.values(state.cards).filter((c) => c.box >= 3).length
