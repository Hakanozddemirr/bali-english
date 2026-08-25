import { useEffect, useMemo, useRef, useState } from 'react'
import { getDay, allChunks, allChunkList } from '../content'
import { useApp, getDayState, ensureDay, recomputeDay } from '../lib/store'
import { introduceCard, answerCard, dueReviewIds } from '../lib/srs'
import { speak } from '../lib/tts'
import { shuffle, sample } from '../lib/quizGen'
import { grade } from '../lib/match'
import { fireConfetti } from '../lib/confetti'
import AnswerInput from './AnswerInput'

export default function Chunks({ day, onBack }) {
  const { state } = useApp()
  const content = getDay(day)
  const st = getDayState(state, day)
  const [tab, setTab] = useState(st.learnDone ? 'drill' : 'learn')

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>💬 Gün {day} Kalıpları</h2>
      </div>
      <div className="tabbar">
        <button className={tab === 'learn' ? 'on' : ''} onClick={() => setTab('learn')}>1 · Öğren</button>
        <button className={tab === 'drill' ? 'on' : ''} onClick={() => setTab('drill')}>2 · Üret</button>
      </div>
      {tab === 'learn' ? (
        <LearnMode day={day} content={content} onFinish={() => setTab('drill')} />
      ) : (
        <DrillMode day={day} content={content} />
      )}
    </div>
  )
}

function LearnMode({ day, content, onFinish }) {
  const { state, update } = useApp()
  const st = getDayState(state, day)
  const rate = state.settings.rate
  const queue = useMemo(
    () => content.chunks.filter((c) => !st.seen.includes(c.id) && !state.known[c.id]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [idx, setIdx] = useState(0)
  const chunk = queue[idx]

  useEffect(() => {
    if (chunk) speak(chunk.en, rate, { accent: 'rotate' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const advance = (know) => {
    update((s) => {
      const d = ensureDay(s, day)
      if (!d.seen.includes(chunk.id)) d.seen.push(chunk.id)
      if (know) {
        s.known[chunk.id] = true // "Biliyorum" → SRS'e girmez, ustalaşıldı sayılır
        delete s.srs[chunk.id]
      } else {
        introduceCard(s, chunk.id)
      }
      const remaining = content.chunks.filter((c) => !d.seen.includes(c.id) && !s.known[c.id])
      if (remaining.length === 0) { d.learnDone = true; recomputeDay(s, day) }
    })
    if (idx + 1 >= queue.length) onFinish()
    else setIdx(idx + 1)
  }

  if (!chunk)
    return (
      <div className="task-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>🎉</div>
        <p className="desc">Bugünün tüm kalıplarını gördün. Şimdi "2 · Üret" sekmesine geç!</p>
        <button className="btn primary" onClick={onFinish}>Üretime Geç →</button>
      </div>
    )

  return (
    <>
      <div className="progress" style={{ marginBottom: 14 }}>
        <i style={{ width: `${(idx / Math.max(1, queue.length)) * 100}%` }} />
      </div>
      <button className="flash-card" style={{ minHeight: 260 }} onClick={() => speak(chunk.ex ? `${chunk.en}. ... ${chunk.ex}` : chunk.en, rate, { accent: 'rotate' })}>
        <span className="word" style={{ fontSize: 25 }}>{chunk.en}</span>
        <span className="ex" style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>{chunk.tr}</span>
        {chunk.use && <span className="use-chip">💡 {chunk.use}</span>}
        {chunk.ex && <span className="ex">“{chunk.ex}”</span>}
        <span className="hint">Dokun: kalıbı + örneği dinle, yüksek sesle tekrar et</span>
      </button>
      <div className="btn-row">
        <button className="btn ghost" onClick={() => advance(true)}>✅ Biliyorum</button>
        <button className="btn primary" onClick={() => advance(false)}>Öğren →</button>
      </div>
      <p className="empty-note">{idx + 1} / {queue.length} · "Biliyorum" dersen bir daha vaktini almaz</p>
    </>
  )
}

function DrillMode({ day, content }) {
  const { state, update } = useApp()
  const rate = state.settings.rate

  const initialQueue = useMemo(() => {
    const newIds = content.chunks.filter((c) => !state.known[c.id]).map((c) => c.id)
    const due = dueReviewIds(state, newIds).filter((id) => allChunks[id] && !state.known[id])
    const ids = [...sample(newIds, 12), ...sample(due, 6)]
    return shuffle(ids.length ? ids : sample(allChunkList.filter((c) => !state.known[c.id]), 10).map((c) => c.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [queue, setQueue] = useState(initialQueue)
  const [phase, setPhase] = useState('ask') // ask | reveal
  const [attempt, setAttempt] = useState('')
  const [autoOk, setAutoOk] = useState(false)
  const finishedRef = useRef(false)
  const total = initialQueue.length
  const chunk = queue.length ? allChunks[queue[0]] : null

  useEffect(() => {
    if (total > 0 && queue.length === 0 && !finishedRef.current) {
      finishedRef.current = true
      const prevDone = getDayState(state, day).done
      const next = update((s) => {
        const d = ensureDay(s, day)
        d.drillDone = true
        recomputeDay(s, day)
      })
      if (!prevDone && next.days[day]?.done) fireConfetti()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue])

  if (!chunk)
    return (
      <div className="task-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>🎯</div>
        <p className="desc">Üretim turu bitti! Kalıplar tekrar zamanı geldikçe önüne gelecek.</p>
      </div>
    )

  const submit = (t) => {
    setAttempt(t)
    const g = grade(t, { target: chunk.en })
    setAutoOk(g === 'strong')
    speak(chunk.en, rate, { accent: 'rotate' })
    update((s) => { s.stats.speak++ })
    setPhase('reveal')
  }

  const settle = (ok) => {
    update((s) => {
      introduceCard(s, chunk.id)
      answerCard(s, chunk.id, ok)
    })
    setPhase('ask')
    setAttempt('')
    setQueue((q) => (ok ? q.slice(1) : [...q.slice(1), q[0]]))
  }

  return (
    <>
      <div className="progress" style={{ marginBottom: 14 }}>
        <i style={{ width: `${((total - queue.length) / total) * 100}%` }} />
      </div>
      <div className="q-prompt">
        <div className="tr">🇹🇷 “{chunk.tr}”</div>
        <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 6 }}>Bunu İngilizce SÖYLE (ya da yaz)</div>
      </div>

      {phase === 'ask' ? (
        <>
          <AnswerInput onSubmit={submit} placeholder="İngilizcesini söyle…" />
          <div className="btn-row">
            <button className="btn ghost" onClick={() => submit('')}>🙈 Bilemedim, göster</button>
            <button className="btn ghost" onClick={() => { update((s) => { s.known[chunk.id] = true; delete s.srs[chunk.id] }); setQueue((q) => q.slice(1)) }}>✅ Biliyorum</button>
          </div>
        </>
      ) : (
        <>
          <div className={`feedback ${autoOk ? 'good' : ''}`} style={{ fontSize: 19 }}>“{chunk.en}”</div>
          {attempt && <div className="heard-line">Senin cevabın: “{attempt}”</div>}
          {autoOk ? (
            <button className="btn primary" onClick={() => settle(true)}>Doğruydu ✅ Devam</button>
          ) : (
            <div className="btn-row">
              <button className="btn primary" onClick={() => settle(true)}>✅ Söyleyebildim</button>
              <button className="btn danger" onClick={() => settle(false)}>❌ Tekrar gelsin</button>
            </div>
          )}
        </>
      )}
      <p className="empty-note">Kalan: {queue.length}</p>
    </>
  )
}
