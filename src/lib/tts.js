export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

let voice = null

export function initTTS() {
  if (!ttsSupported) return
  const pick = () => {
    const vs = window.speechSynthesis.getVoices()
    voice =
      vs.find((v) => /en[-_]US/i.test(v.lang) && /Samantha|Google US English/i.test(v.name)) ||
      vs.find((v) => /en[-_]US/i.test(v.lang)) ||
      vs.find((v) => /^en/i.test(v.lang)) ||
      null
  }
  pick()
  window.speechSynthesis.onvoiceschanged = pick
}

export function speak(text, rate = 0.9, { onend } = {}) {
  if (!ttsSupported || !text) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    if (voice) u.voice = voice
    u.rate = rate
    u.pitch = 1
    if (onend) u.onend = onend
    window.speechSynthesis.speak(u)
  } catch {
    /* sessizce geç */
  }
}

export function stopSpeaking() {
  if (ttsSupported) window.speechSynthesis.cancel()
}
