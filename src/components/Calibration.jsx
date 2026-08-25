import { useMemo, useState } from 'react'
import { allChunkList } from '../content'
import { useApp } from '../lib/store'
import { sample } from '../lib/quizGen'
import { grade } from '../lib/match'
import { speak } from '../lib/tts'
import AnswerInput from './AnswerInput'

// 3 dakikalık isteğe bağlı seviye ayarı: kolay kalıpları ele.
export default function Calibration({ onDone }) {
  const { state, update } = useApp()
  const rate = state.settings.rate

  const items = useMemo(() => {
    const basics = sample(allChunkList.filter((c) => c.basic), 8)
    const speaks = [
      { tr: 'Ne kadar kalacaksın?', keys: [['how', 'long', 'are', 'you', 'here']], best: 'How long are you here for?' },
      { tr: 'Sonra bir şeyler içelim mi?', keys: [['wanna', 'drink'], ['want', 'to', 'drink'], ['grab', 'a', 'drink']], best: 'Wanna grab a drink later?' },
    ]
    return [...basics.map((c) => ({ type: 'know', chunk: c })), ...speaks.map((s) => ({ type: 'speak', ...s }))]
  }, [])

  const [i, setI] = useState(0)
  const [knownCount, setKnownCount] = useState(0)
  const [reveal, setReveal] = useState(null)
  const item = items[i]

  const finish = (finalKnown) => {
    update((s) => {
      s.calib.done = true
      s.calib.knownBasics = finalKnown
      // 8 kolaydan 6+'sını biliyorsa: tüm 'basic' kalıpları öğrenilmiş say
      if (finalKnown >= 6) {
        for (const c of allChunkList) if (c.basic) s.known[c.id] = true
      }
    })
    onDone()
  }

  const next = (didKnow) => {
    const k = knownCount + (didKnow ? 1 : 0)
    setKnownCount(k)
    setReveal(null)
    if (i + 1 >= items.length) finish(k)
    else setI(i + 1)
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onDone}>←</button>
        <h2>🎯 Seviye Ayarı</h2>
        <button className="btn ghost" style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
          onClick={() => { update((s) => { s.calib.skipped = true }); onDone() }}>
          Atla
        </button>
      </div>
      <div className="progress" style={{ marginBottom: 14 }}>
        <i style={{ width: `${(i / items.length) * 100}%` }} />
      </div>

      {item.type === 'know' ? (
        <>
          <div className="q-prompt">
            <div className="word" style={{ fontSize: 23 }}>{item.chunk.en}</div>
            <div style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 8 }}>
              Bu kalıbı sohbette rahatça KULLANABİLİR misin?
            </div>
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={() => next(true)}>✅ Rahatça</button>
            <button className="btn ghost" onClick={() => next(false)}>🤔 Emin değilim</button>
          </div>
        </>
      ) : (
        <>
          <div className="q-prompt">
            <div className="tr">🗣️ İngilizce söyle: “{item.tr}”</div>
          </div>
          {reveal ? (
            <>
              <div className={`feedback ${reveal.ok ? 'good' : 'bad'}`}>
                {reveal.ok ? 'Süper! ✅' : 'Doğal hali:'} “{item.best}”
              </div>
              <button className="btn primary" onClick={() => next(reveal.ok)}>Devam →</button>
            </>
          ) : (
            <AnswerInput onSubmit={(t) => {
              const g = grade(t, { keys: item.keys, target: item.best })
              speak(item.best, rate)
              setReveal({ ok: g === 'strong' })
            }} />
          )}
        </>
      )}
      <p className="empty-note">{i + 1} / {items.length} · Amaç sınav değil — kolay kartları elemek.</p>
    </div>
  )
}
