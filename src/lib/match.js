// Esnek cevap değerlendirme: amaç konuşturmak, "parser'ı yenmek" değil.
import { normalize, compareSentence } from './similarity'

export const wordCount = (s) => normalize(s).split(' ').filter(Boolean).length

// Tek kelimede kelime sınırı arar; çok kelimeli kalıpta düz içerme yeter.
export function containsPhrase(text, phrase) {
  const padded = ` ${normalize(text)} `
  const n = normalize(phrase)
  if (!n) return false
  return n.includes(' ') ? padded.includes(n) : padded.includes(` ${n} `)
}

// keys: [["thinking","of"],["might"]] → herhangi bir grup TAMAMEN geçiyorsa eşleşti.
export function matchKeys(text, keys) {
  if (!keys || !keys.length) return false
  return keys.some((group) => group.every((k) => containsPhrase(text, k)))
}

// Örnek cümlelerden en iyi benzerlik puanı (0-1)
export function bestSimilarity(attempt, samples) {
  if (!samples || !samples.length) return 0
  return Math.max(...samples.map((s) => compareSentence(s, attempt).score))
}

// Genel kabul: 'strong' = hedefi tutturdu, 'ok' = anlamlı bir deneme (kabul),
// 'weak' = çok kısa/boş (nazik dürtme).
export function grade(attempt, { keys, samples, target, minWords = 2 } = {}) {
  const wc = wordCount(attempt)
  if (wc === 0) return 'weak'
  const strong =
    (keys && matchKeys(attempt, keys)) ||
    (target && compareSentence(target, attempt).score >= 0.6) ||
    (samples && bestSimilarity(attempt, samples) >= 0.55)
  if (strong) return 'strong'
  return wc >= minWords ? 'ok' : 'weak'
}
