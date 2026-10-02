import { useEffect, useRef, useState } from 'react'
import { useApp, addMistake } from '../lib/store'
import { todayISO } from '../lib/dates'
import { weeklyCheck } from '../lib/claude'
import { startListening, sttSupported } from '../lib/stt'
import { wordCount } from '../lib/match'

const IS_PUBLISHED = /claude(usercontent)?\.(ai|com)$/.test(window.location.hostname)
const TARGET = 120
const PROMPTS = ['What did you do this week?', 'What was the best part? Why?', 'What do you want to do next week?']

// Haftalık 2 dakikalık konuşma kaydı — haftalar arası kıyas için
export default function Weekly({ onBack }) {
  const { state, update } = useApp()
  const { apiKey, model } = state.settings
  const canClaude = !!apiKey && !IS_PUBLISHED
  const [text, setText] = useState('')
  const [secs, setSecs] = useState(0)
  const [running, setRunning] = useState(false)
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)
  const recRef = useRef(null)
  const baseRef = useRef('')
  const wantRef = useRef(false)

  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(iv)
  }, [running])

  // Tarayıcı tanıması kısa sessizlikte kapanır; 2 dk boyunca otomatik yeniden başlat
  const listen = () => {
    recRef.current = startListening({
      onInterim: (t) => setText((baseRef.current ? baseRef.current + ' ' : '') + t),
      onFinal: (t) => { baseRef.current = (baseRef.current ? baseRef.current + ' ' : '') + t; setText(baseRef.current) },
      onError: (m) => { setErr(m); wantRef.current = false; setListening(false) },
      onEnd: () => { if (wantRef.current) listen(); else setListening(false) },
    })
    setListening(!!recRef.current)
  }

  const start = () => { setErr(''); setRunning(true); wantRef.current = true; listen() }
  const stop = () => { wantRef.current = false; recRef.current?.stop(); setRunning(false); setListening(false) }

  useEffect(() => () => { wantRef.current = false; recRef.current?.stop() }, [])

  const submit = async () => {
    stop()
    const entry = { date: todayISO(), seconds: secs, words: wordCount(text), text }
    if (canClaude) {
      setBusy(true)
      try {
        const out = await weeklyCheck({ apiKey, model, text, seconds: secs })
        Object.assign(entry, out)
        update((s) => out.fixes.forEach((f) => addMistake(s, { orig: f.wrong, fix: f.right, note: 'Haftalık kontrol' })))
      } catch (e) { setErr(e.message) } finally { setBusy(false) }
    }
    update((s) => { s.weekly.unshift(entry); s.weekly = s.weekly.slice(0, 60) })
    setResult(entry)
  }

  const history = state.weekly.slice(0, 8)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>📈 Haftalık Kontrol</h2>
        <span className={`timer-chip ${secs >= TARGET ? 'done' : ''}`}>⏱ {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
      </div>

      {!result ? (
        <div className="task-card">
          <div className="desc">Her pazar: <b>2 dakika durmadan</b> konuş. Mükemmel değil, akıcı olsun. Aynı soruları her hafta cevaplarsın — fark böyle görünür.</div>
          {PROMPTS.map((p) => <div key={p} className="use-chip" style={{ marginBottom: 6 }}>{p}</div>)}
          <textarea className="coach-area" rows={6} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={sttSupported ? 'Başlat\'a bas ve konuş — yazıya dökülecek.' : 'Bu tarayıcıda mikrofon yok — konuşur gibi yaz.'} />
          {err && <div className="error-box">{err}</div>}
          <div className="btn-row">
            {sttSupported && (running
              ? <button className="btn danger" onClick={stop}>⏹ Durdur</button>
              : <button className="btn orange" onClick={start}>🎙️ {secs ? 'Devam' : 'Başlat'}</button>)}
            <button className="btn primary" disabled={busy || wordCount(text) < 10} onClick={submit}>
              {busy ? '⏳ Değerlendiriliyor…' : 'Bitir'}
            </button>
          </div>
          {listening && <p className="desc" style={{ marginTop: 6 }}>🔴 Dinliyorum…</p>}
        </div>
      ) : (
        <div className="task-card">
          <div className="head"><span className="ico">📊</span><span className="name">Bu haftanın sonucu</span></div>
          <div className="score-grid">
            <div><b>{result.words}</b><span>kelime</span></div>
            {result.fluency != null && <div><b>{result.fluency}/10</b><span>akıcılık</span></div>}
            {result.accuracy != null && <div><b>{result.accuracy}/10</b><span>doğruluk</span></div>}
            {result.range != null && <div><b>{result.range}/10</b><span>çeşitlilik</span></div>}
          </div>
          {result.summaryTr && <div className="sample-box">{result.summaryTr}</div>}
          {result.fixes?.map((f, i) => (
            <div className="fix-row" key={i}><span className="wrong">{f.wrong}</span> → <b>{f.right}</b><div className="note">{f.noteTr}</div></div>
          ))}
          {result.nextFocusTr && <div className="sample-box">🎯 <b>Gelecek hafta:</b> {result.nextFocusTr}</div>}
          <button className="btn ghost" onClick={onBack}>Tamam</button>
        </div>
      )}

      {history.length > 0 && (
        <>
          <div className="section-title">Geçmiş haftalar</div>
          <div className="task-card">
            <table className="hist">
              <thead><tr><th>Tarih</th><th>Kelime</th><th>Akıcılık</th><th>Doğruluk</th><th>Çeşit.</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}><td>{h.date.slice(5)}</td><td>{h.words}</td><td>{h.fluency ?? '—'}</td><td>{h.accuracy ?? '—'}</td><td>{h.range ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
