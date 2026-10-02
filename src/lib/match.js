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

// ---- Yapı Laboratuvarı: Türkçe → İngilizce cümle kontrolü ----
// Kesmesiz yazılan kısaltmalar (klavyeden "im", "dont")
const NO_APOS = [
  [/\bim\b/g, "i'm"], [/\b(do|does|did|is|are|was|were|have|has|had|could|would|should)nt\b/g, "$1n't"],
  [/\bcant\b/g, "can't"], [/\bwont\b/g, "won't"], [/\b(i|you|we|they)ve\b/g, "$1've"], [/\b(you|they)re\b/g, "$1're"],
  [/\b(that|there|what)s\b/g, "$1's"],
]

const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'], [/\b(you|we|they)'re\b/g, '$1 are'], [/\b(he|she|it|that|there|what|where|who|how)'s\b/g, '$1 is'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'], [/\b(i|you|he|she|we|they|it)'ll\b/g, '$1 will'], [/\b(i|you|he|she|we|they)'d\b/g, '$1 would'],
  [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'],
  [/\b(\w+)n't\b/g, '$1 not'], [/\blet's\b/g, 'let us'], [/\bgonna\b/g, 'going to'], [/\bwanna\b/g, 'want to'],
]

export function canon(s) {
  let t = normalize(s)
  for (const [re, rep] of NO_APOS) t = t.replace(re, rep)
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep)
  return t.replace(/\s+/g, ' ').trim()
}

// answers: kabul edilen cevaplar. Dönüş: {verdict: 'correct'|'close'|'wrong', best, score, diff}
export function checkSentence(attempt, answers) {
  const a = canon(attempt)
  if (!a) return { verdict: 'wrong', best: answers[0], score: 0 }
  let best = answers[0], bestScore = -1, diff = null
  for (const ans of answers) {
    const c = canon(ans)
    if (c === a) return { verdict: 'correct', best: ans, score: 1 }
    const cmp = compareSentence(c, a)
    // fazladan kelime de cezalandırılsın
    const extra = Math.max(0, a.split(' ').length - c.split(' ').length)
    const sc = cmp.score - extra * 0.08
    if (sc > bestScore) { bestScore = sc; best = ans; diff = cmp }
  }
  return { verdict: bestScore >= 0.86 ? 'close' : 'wrong', best, score: Math.max(0, bestScore), diff }
}
