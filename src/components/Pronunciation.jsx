import { useRef, useState } from 'react'
import { getDay } from '../content'
import { useApp, getDayState, ensureDay } from '../lib/store'
import { speak } from '../lib/tts'
import { startListening, sttSupported } from '../lib/stt'
import { compareSentence } from '../lib/similarity'

export default function Pronunciation({ day, onBack }) {
  const { state, update } = useApp()
  const content = getDay(day)
  const st = getDayState(state, day)
  const rate = state.settings.rate

  const [openId, setOpenId] = useState(null)
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const recRef = useRef(null)

  const open = (sid) => {
    recRef.current?.stop()
    setListening(false)
    setResult(null)
    setErr('')
    setOpenId(openId === sid ? null : sid)
  }

  const listen = (sentence) => {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    setErr('')
    setResult(null)
    recRef.current = startListening({
      onFinal: (heard) => {
        const r = compareSentence(sentence.en, heard)
        setResult(r)
        const pct = Math.round(r.score * 100)
        if (pct >= 80) {
          update((s) => {
            const d = ensureDay(s, day)
            d.pron[sentence.id] = Math.max(d.pron[sentence.id] || 0, pct)
          })
        }
      },
      onError: (m) => {
        setErr(m)
        setListening(false)
      },
      onEnd: () => setListening(false),
    })
    if (recRef.current) setListening(true)
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>🎙️ Telaffuz — Gün {day}</h2>
      </div>

      {!sttSupported && (
        <div className="warn-box">
          Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome (Android/masaüstü) veya Safari (iPhone)
          kullanmayı dene. Cümleleri yine de dinleyip yüksek sesle tekrar edebilirsin.
        </div>
      )}

      <p className="empty-note" style={{ padding: '0 4px 14px', textAlign: 'left' }}>
        Cümleye dokun → 🔊 ile dinle → 🎙️ ile aynı cümleyi söyle. %80 ve üzeri eşleşme yeşil tik
        kazandırır.
      </p>

      {content.sentences.map((sen) => {
        const best = st.pron[sen.id] || 0
        const isOpen = openId === sen.id
        return (
          <div className="pron-item" key={sen.id}>
            <button className="row" onClick={() => open(sen.id)}>
              <span>{best >= 80 ? '✅' : '🗣️'}</span>
              <span style={{ flex: 1 }}>{sen.en}</span>
              <span className={`score-badge ${best >= 80 ? 'ok' : ''}`}>
                {best > 0 ? `%${best}` : '—'}
              </span>
            </button>
            {isOpen && (
              <div className="pron-detail">
                <div className="btn-row">
                  <button className="btn soft" onClick={() => speak(sen.en, rate)}>
                    🔊 Dinle
                  </button>
                  <button
                    className={`btn ${listening ? 'danger' : 'orange'}`}
                    onClick={() => listen(sen)}
                  >
                    {listening ? '⏹ Dinliyorum… (durdur)' : '🎙️ Şimdi Sen Söyle'}
                  </button>
                </div>

                {err && <div className="error-box">{err}</div>}

                {result && (
                  <>
                    <div className="word-result">
                      {result.targetWords.map((w, i) => (
                        <span key={i} className={result.matched[i] ? 'hit' : 'miss'}>
                          {w}
                        </span>
                      ))}
                    </div>
                    <div className="heard-line">Duyulan: “{result.heard || '—'}”</div>
                    <div
                      className={`feedback ${result.score >= 0.8 ? 'good' : 'bad'}`}
                      style={{ margin: '4px 0 10px' }}
                    >
                      %{Math.round(result.score * 100)}{' '}
                      {result.score >= 0.8 ? '— Harika! ✅' : '— Kırmızı kelimelere odaklan'}
                    </div>
                    {result.score < 0.8 && (
                      <button className="btn ghost" onClick={() => listen(sen)}>
                        🔁 Tekrar Dene
                      </button>
                    )}
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
