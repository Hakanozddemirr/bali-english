const SR =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export const sttSupported = !!SR

const ERROR_TR = {
  'not-allowed': 'Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofona izin ver.',
  'service-not-allowed': 'Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofona izin ver.',
  'no-speech': 'Ses algılanamadı. Mikrofona biraz daha yakın ve yüksek sesle konuş.',
  'audio-capture': 'Mikrofon bulunamadı. Cihazının mikrofonunu kontrol et.',
  network: 'Konuşma tanıma için internet gerekiyor. Bağlantını kontrol et.',
  aborted: '',
}

// Tek seferlik dinleme başlatır; durdurmak için dönen nesnede .stop() çağır.
export function startListening({ onInterim, onFinal, onError, onEnd }) {
  if (!SR) {
    onError?.('Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome veya Safari kullanmayı dene — ya da "yazarak cevapla" seçeneğini kullan.')
    return null
  }
  const r = new SR()
  r.lang = 'en-US'
  r.interimResults = true
  r.maxAlternatives = 1
  r.continuous = false

  let finalText = ''
  r.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += t
      else interim += t
    }
    if (interim) onInterim?.(interim)
    if (finalText) onInterim?.(finalText)
  }
  r.onerror = (e) => {
    const msg = ERROR_TR[e.error]
    if (msg !== '') onError?.(msg || `Konuşma tanıma hatası: ${e.error}`)
  }
  r.onend = () => {
    if (finalText.trim()) onFinal?.(finalText.trim())
    onEnd?.()
  }
  try {
    r.start()
  } catch {
    onError?.('Mikrofon başlatılamadı. Sayfayı yenileyip tekrar dene.')
    return null
  }
  return r
}
