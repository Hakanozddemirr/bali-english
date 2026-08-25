import d1 from './day1.json'
import d2 from './day2.json'
import d3 from './day3.json'
import d4 from './day4.json'
import d5 from './day5.json'
import d6 from './day6.json'
import d7 from './day7.json'
import guideData from './guide.json'
import freetalkData from './freetalk.json'

export const slug = (en) =>
  en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

const raw = [d1, d2, d3, d4, d5, d6, d7]

export const days = raw.map((d) => ({
  ...d,
  chunks: d.chunks.map((c) => ({ id: slug(c.en), ...c })),
}))

// id -> chunk (gün bilgisiyle)
export const allChunks = {}
for (const d of days) for (const c of d.chunks) allChunks[c.id] = { ...c, day: d.day }
export const allChunkList = Object.values(allChunks)

// Rehber: her kalıba favori için kimlik ver
export const guide = {
  categories: guideData.categories.map((cat) => ({
    ...cat,
    phrases: cat.phrases.map((p) => ({ id: slug(p.en), ...p })),
  })),
}

export const freetalk = freetalkData
export const getDay = (n) => days[n - 1]
export const TOTAL_DAYS = days.length
