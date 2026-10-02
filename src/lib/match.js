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

// Gramer açısından kritik kelimeler: bunlardaki fark mikrofon hatası sayılmaz, gerçek hata sayılır
const CRIT = new Set(('am is are was were be been being do does did done have has had will would can could should must ' +
  'not no to the a an go goes going went gone want wants wanted than more most my your his her its our their me him us them ' +
  'this that these those there here i you he she it we they mine yours ours theirs myself yourself himself herself ' +
  'some any much many few little every all both either neither also too very at on in by for from since ago last ' +
  // düzensiz fiiller: yalın ↔ geçmiş farkı gerçek hatadır
  'eat ate buy bought see saw meet met take took come came get got make made say said tell told find found leave left ' +
  'sleep slept drink drank feel felt pay paid spend spent think thought know knew give gave write wrote sell sold ' +
  'send sent bring brought begin began run ran swim swam drive drove ride rode wake woke lose lost win won').split(' '))

// -ed/-s gibi ek farkları sameStem ile yakalanır (like/liked, customer/customers)
const isCrit = (w) => CRIT.has(w)
const sameStem = (a, b) => a !== b && a.length >= 3 && b.length >= 3 && a.slice(0, 3) === b.slice(0, 3)

// Kesin (birebir kelime) hizalama: eksik ve fazla kelimeleri bul
function strictAlign(T, H) {
  const m = T.length, n = H.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = T[i] === H[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const tHit = Array(m).fill(false), hHit = Array(n).fill(false)
  let i = 0, j = 0
  while (i < m && j < n) {
    if (T[i] === H[j]) { tHit[i] = hHit[j] = true; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return { missing: T.filter((_, k) => !tHit[k]), extra: H.filter((_, k) => !hHit[k]), matched: tHit }
}

// "Çok yakın": sadece içerik kelimesinde küçük fark (çoğunlukla ses tanıma). Gramer farkı asla yakın sayılmaz.
function isClose(T, H) {
  const { missing, extra } = strictAlign(T, H)
  const allowed = T.length <= 6 ? 1 : 2
  if (Math.max(missing.length, extra.length) > allowed) return false
  if (missing.some(isCrit) || extra.some(isCrit)) return false
  if (missing.some((m) => extra.some((x) => sameStem(m, x)))) return false // customer/customers, like/likes
  return true
}

// answers: kabul edilen cevaplar. Dönüş: {verdict: 'correct'|'close'|'wrong', best, score, diff}
export function checkSentence(attempt, answers) {
  const a = canon(attempt)
  if (!a) return { verdict: 'wrong', best: answers[0], score: 0 }
  const H = a.split(' ')
  let best = answers[0], bestScore = -1, diff = null, close = false
  for (const ans of answers) {
    const c = canon(ans)
    if (c === a) return { verdict: 'correct', best: ans, score: 1 }
    const T = c.split(' ')
    const al = strictAlign(T, H)
    const sc = (T.length - al.missing.length - al.extra.length * 0.5) / T.length
    if (isClose(T, H)) close = true
    if (sc > bestScore) { bestScore = sc; best = ans; diff = { targetWords: T, matched: al.matched } }
  }
  return { verdict: close ? 'close' : 'wrong', best, score: Math.max(0, bestScore), diff }
}
