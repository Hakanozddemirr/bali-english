export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

// Aksan havuzları: ABD / İngiliz / Avustralya — yoksa herhangi bir İngilizce sese düşer.
const pools = { us: [], gb: [], au: [], any: [] }
let rotate = true
let rotateIdx = 0

export function setVoicePrefs({ accents } = {}) {
  if (typeof accents === 'boolean') rotate = accents
}

export function initTTS() {
  if (!ttsSupported) return
  const pick = () => {
    const vs = window.speechSynthesis.getVoices()
    pools.us = vs.filter((v) => /en[-_]US/i.test(v.lang))
    pools.gb = vs.filter((v) => /en[-_]GB/i.test(v.lang))
    pools.au = vs.filter((v) => /en[-_]AU/i.test(v.lang))
    pools.any = vs.filter((v) => /^en/i.test(v.lang))
    // kaliteli sesleri öne al
    const rank = (v) => (/Samantha|Daniel|Karen|Google|Natural/i.test(v.name) ? 0 : 1)
    for (const k of Object.keys(pools)) pools[k].sort((a, b) => rank(a) - rank(b))
  }
  pick()
  window.speechSynthesis.onvoiceschanged = pick
}

function chooseVoice(accent) {
  const order =
    accent === 'gb' ? ['gb', 'us', 'au', 'any']
    : accent === 'au' ? ['au', 'gb', 'us', 'any']
    : ['us', 'gb', 'au', 'any']
  for (const k of order) if (pools[k].length) return pools[k][0]
  return null
}

// accent: 'us' | 'gb' | 'au' | 'rotate' (ayara göre döner) | undefined
export function speak(text, rate = 0.95, { onend, accent } = {}) {
  if (!ttsSupported || !text) { onend?.(); return }
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    let acc = accent
    if (accent === 'rotate') {
      acc = rotate ? ['us', 'gb', 'au'][rotateIdx++ % 3] : 'us'
    }
    const voice = chooseVoice(acc || 'us')
    u.lang = voice?.lang || 'en-US'
    if (voice) u.voice = voice
    u.rate = rate
    u.pitch = 1
    if (onend) u.onend = onend
    window.speechSynthesis.speak(u)
  } catch { onend?.() }
}

export function stopSpeaking() {
  if (ttsSupported) window.speechSynthesis.cancel()
}
