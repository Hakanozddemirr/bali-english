import d1 from './day1.json'
import d2 from './day2.json'
import d3 from './day3.json'
import d4 from './day4.json'
import d5 from './day5.json'
import d6 from './day6.json'
import d7 from './day7.json'
import d8 from './day8.json'
import d9 from './day9.json'
import d10 from './day10.json'
import guideData from './guide.json'

const slug = (en) => en.toLowerCase().replace(/[^a-z0-9]+/g, '-')

// src/assets/photos/{slug}.jpg|png varsa kart o fotoğrafı kullanır, yoksa emoji.
// Fotoğraf eklemek/değiştirmek için dosyayı o klasöre koymak yeterli.
const photoModules = import.meta.glob('../assets/photos/*.{jpg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const photoBySlug = {}
for (const [path, url] of Object.entries(photoModules)) {
  photoBySlug[path.split('/').pop().replace(/\.(jpg|png)$/i, '')] = url
}

const raw = [d1, d2, d3, d4, d5, d6, d7, d8, d9, d10]

export const days = raw.map((d) => ({
  ...d,
  words: d.words.map((w) => ({ id: slug(w.en), img: photoBySlug[slug(w.en)] || null, ...w })),
  sentences: d.sentences.map((en, i) => ({ id: `d${d.day}s${i + 1}`, en })),
}))

export const allCards = {}
for (const d of days) {
  for (const w of d.words) allCards[w.id] = { ...w, day: d.day }
}
export const allWords = Object.values(allCards)

export const guide = guideData
export const getDay = (n) => days[n - 1]
export const TOTAL_DAYS = days.length
