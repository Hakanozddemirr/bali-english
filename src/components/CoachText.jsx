import { useRef, useState } from 'react'
import { useApp, addMistake } from '../lib/store'
import { correctText } from '../lib/claude'
import { startListening, sttSupported } from '../lib/stt'
import { speak, stopSpeaking } from '../lib/tts'
import { wordCount } from '../lib/match'

const IS_PUBLISHED = /claude(usercontent)?\.(ai|com)$/.test(window.location.hostname)

// Birkaç cümlelik serbest üretim: mikrofonla cümle cümle ekle ya da yaz → Claude düzeltir → hatalar desteye
export default function CoachText({ task, placeholder, minWords = 8, onDone, doneLabel, onResult }) {
  const { state, update } = useApp()
  const { apiKey, model, rate } = state.settings
  const canClaude = !!apiKey && !IS_PUBLISHED
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [fb, setFb] = useState(null)
  const recRef = useRef(null)

  const mic = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return }
    setErr(''); stopSpeaking()
    let base = text
    recRef.current = startListening({
      onInterim: (t) => setText((base ? base + ' ' : '') + t),
      onFinal: (t) => { base = (base ? base + ' ' : '') + t; setText(base); setListening(false) },
      onError: (m) => { setErr(m); setListening(false) },
      onEnd: () => setListening(false),
    })
    if (recRef.current) setListening(true)
  }

  const enough = wordCount(text) >= minWords

  const submit = async () => {
    if (!canClaude) { onDone?.(text); return }
    setBusy(true); setErr('')
    try {
      const out = await correctText({ apiKey, model, text, task })
      setFb(out)
      update((s) => out.mistakes.forEach((m) => addMistake(s, { orig: m.wrong, fix: m.right, note: m.noteTr })))
      onResult?.(out)
      onDone?.(text)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (fb) {
    return (
      <div className="coach-fb">
        <div className="sample-box">👏 {fb.praiseTr}</div>
        {fb.mistakes.length > 0 && (
          <>
            <div className="mini-title">🔧 Düzeltmeler (tekrar destene eklendi)</div>
            {fb.mistakes.map((m, i) => (
              <div className="fix-row" key={i}>
                <span className="wrong">{m.wrong}</span> → <b>{m.right}</b>
                <div className="note">{m.noteTr}</div>
              </div>
            ))}
          </>
        )}
        <div className="mini-title">💬 Bir dahaki sefere şöyle de diyebilirsin</div>
        <div className="phrase" style={{ boxShadow: 'none', background: 'var(--accent-soft)' }}>
          <div className="txt"><div className="en">{fb.better}</div></div>
          <button className="speaker" onClick={() => speak(fb.better, rate)}>🔊</button>
        </div>
        <p className="desc">Bu versiyonu bir kez <b>sesli</b> oku.</p>
        <button className="link-btn" onClick={() => { setFb(null); setText('') }}>↺ Yeniden yaz</button>
      </div>
    )
  }

  return (
    <div>
      <textarea className="coach-area" rows={4} value={text} placeholder={placeholder}
        onChange={(e) => setText(e.target.value)} autoCapitalize="sentences" />
      {err && <div className="error-box">{err}</div>}
      <div className="btn-row">
        {sttSupported && (
          <button className={`btn ghost ${listening ? 'rec-btn' : ''}`} onClick={mic}>
            {listening ? '⏹ Durdur' : '🎙️ Cümle söyle'}
          </button>
        )}
        <button className="btn primary" disabled={!enough || busy} onClick={submit}>
          {busy ? '⏳ Kontrol…' : canClaude ? 'Kontrol et' : 'Kaydet'}
        </button>
      </div>
      <p className="desc" style={{ marginTop: 6 }}>
        {enough ? (doneLabel || '') : `En az ${minWords} kelime (${wordCount(text)}/${minWords}).`}
        {!canClaude && ' API anahtarı olmadan düzeltme yok — yine de sesli söylemek asıl kazanç.'}
      </p>
    </div>
  )
}
