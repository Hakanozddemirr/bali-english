import { useRef, useState } from 'react'
import { getDay } from '../content'
import { useApp, getDayState, ensureDay } from '../lib/store'
import { speak } from '../lib/tts'
import { startListening, sttSupported } from '../lib/stt'
import { compareSentence } from '../lib/similarity'

const SHADOW_SPEEDS = [0.85, 1.0, 1.15]

// "Konuşma Netliği": konuşma tanıma seni ne kadar doğru anlıyor?
// (Gerçek fonetik analiz DEĞİL — pratik bir anlaşılabilirlik tahmini.)
export default function Clarity({ day, onBack }) {
  const { state, update } = useApp()
  const content = getDay(day)
  const st = getDayState(state, day)
  const rate = state.settings.rate
  const items = content.chunks.filter((c) => !c.en.includes('___') && c.en.length < 55).slice(0, 10)

  const [openId, setOpenId] = useState(null)
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [shadowSpeed, setShadowSpeed] = useState(0)
  const recRef = useRef(null)

  const open = (id) => {
    recRef.current?.stop()
    setListening(false)
    setResult(null)
    setErr('')
    setOpenId(openId === id ? null : id)
  }

  const listen = (chunk) => {
    if (listening) { recRef.current?.stop(); setListening(false); return }
    setErr(''); setResult(null)
    recRef.current = startListening({
      onFinal: (heard) => {
        const r = compareSentence(chunk.en, heard)
        setResult(r)
        const pct = Math.round(r.score * 100)
        if (pct >= 80) update((s) => { const d = ensureDay(s, day); d.clarity[chunk.id] = Math.max(d.clarity[chunk.id] || 0, pct) })
      },
      onError: (m) => { setErr(m); setListening(false) },
      onEnd: () => setListening(false),
    })
    if (recRef.current) setListening(true)
  }

  // Gölgeleme: dinle → kısa boşluk → otomatik mikrofon
  const shadow = (chunk) => {
    setErr(''); setResult(null)
    speak(chunk.en, rate * SHADOW_SPEEDS[shadowSpeed], {
      accent: 'rotate',
      onend: () => setTimeout(() => listen(chunk), 500),
    })
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>🎙️ Netlik — Gün {day}</h2>
      </div>

      <div className="warn-box">
        Bu puan, konuşma tanımanın cümleni doğru anlayıp anlamadığını tahmin eder — gerçek telaffuz
        analizi değildir. %80+ = büyük ihtimalle rahat anlaşılırsın.
      </div>
      {!sttSupported && (
        <div className="warn-box">Bu tarayıcıda mikrofon tanıma yok — cümleleri dinleyip yüksek sesle tekrar etmek yine de çok işe yarar.</div>
      )}

      <div className="speed-chips" style={{ marginBottom: 12 }}>
        {SHADOW_SPEEDS.map((s, j) => (
          <button key={s} className={shadowSpeed === j ? 'on' : ''} onClick={() => setShadowSpeed(j)}>{s}x</button>
        ))}
        <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', alignSelf: 'center' }}>gölgeleme hızı</span>
      </div>

      {items.map((c) => {
        const best = st.clarity[c.id] || 0
        const isOpen = openId === c.id
        return (
          <div className="pron-item" key={c.id}>
            <button className="row" onClick={() => open(c.id)}>
              <span>{best >= 80 ? '✅' : '🗣️'}</span>
              <span style={{ flex: 1 }}>{c.en}</span>
              <span className={`score-badge ${best >= 80 ? 'ok' : ''}`}>{best > 0 ? `%${best}` : '—'}</span>
            </button>
            {isOpen && (
              <div className="pron-detail">
                <div className="btn-row">
                  <button className="btn soft" onClick={() => speak(c.en, rate * SHADOW_SPEEDS[shadowSpeed], { accent: 'rotate' })}>🔊 Dinle</button>
                  <button className="btn orange" onClick={() => shadow(c)}>👥 Gölgele</button>
                  {sttSupported && (
                    <button className={`btn ${listening ? 'danger' : 'ghost'}`} onClick={() => listen(c)}>
                      {listening ? '⏹ Dinliyorum' : '🎙️ Söyle'}
                    </button>
                  )}
                </div>
                {err && <div className="error-box">{err}</div>}
                {result && (
                  <>
                    <div className="word-result">
                      {result.targetWords.map((w, j) => (
                        <span key={j} className={result.matched[j] ? 'hit' : 'miss'}>{w}</span>
                      ))}
                    </div>
                    <div className="heard-line">Duyulan: “{result.heard || '—'}”</div>
                    <div className={`feedback ${result.score >= 0.8 ? 'good' : 'bad'}`} style={{ margin: '4px 0 8px' }}>
                      %{Math.round(result.score * 100)} {result.score >= 0.8 ? '— net! ✅ Hızı artırmayı dene' : '— kırmızı kelimelere odaklan, tekrar dene'}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
