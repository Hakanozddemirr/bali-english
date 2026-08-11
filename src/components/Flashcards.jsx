import { useEffect, useMemo, useRef, useState } from 'react'
import { getDay, allCards, allWords } from '../content'
import { useApp, getDayState, ensureDay, recomputeDay } from '../lib/store'
import { introduceCard, answerCard, dueReviewIds, hardestCardIds } from '../lib/srs'
import { speak } from '../lib/tts'
import { shuffle, sample } from '../lib/quizGen'
import { fireConfetti } from '../lib/confetti'

const isTextVisual = (v) => /^[0-9]/.test(v)

export default function Flashcards({ day, onBack }) {
  const { state, update } = useApp()
  const content = getDay(day)
  const st = getDayState(state, day)
  const rate = state.settings.rate
  const isReview = content.words.length === 0
  const [tab, setTab] = useState(isReview || st.learnDone ? 'match' : 'learn')

  // Tekrar gününde öğrenme adımı yoktur
  useEffect(() => {
    if (isReview && !st.learnDone) {
      update((s) => {
        ensureDay(s, day).learnDone = true
        recomputeDay(s, day)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>🃏 Gün {day} Kartları</h2>
      </div>
      {!isReview && (
        <div className="tabbar">
          <button className={tab === 'learn' ? 'on' : ''} onClick={() => setTab('learn')}>
            1 · Öğren
          </button>
          <button className={tab === 'match' ? 'on' : ''} onClick={() => setTab('match')}>
            2 · Eşleştir
          </button>
        </div>
      )}
      {tab === 'learn' && !isReview ? (
        <LearnMode day={day} content={content} rate={rate} onFinish={() => setTab('match')} />
      ) : (
        <MatchMode day={day} content={content} rate={rate} isReview={isReview} />
      )}
    </div>
  )
}

function LearnMode({ day, content, rate, onFinish }) {
  const { state, update } = useApp()
  const st = getDayState(state, day)
  const firstUnseen = content.words.findIndex((w) => !st.seen.includes(w.id))
  const [idx, setIdx] = useState(firstUnseen === -1 ? 0 : firstUnseen)
  const card = content.words[idx]
  const seenCount = st.seen.length

  useEffect(() => {
    if (card) speak(card.en, rate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const next = () => {
    update((s) => {
      const d = ensureDay(s, day)
      if (!d.seen.includes(card.id)) d.seen.push(card.id)
      introduceCard(s, card.id)
      if (d.seen.length >= content.words.length) {
        d.learnDone = true
        recomputeDay(s, day)
      }
    })
    if (idx < content.words.length - 1) setIdx(idx + 1)
    else onFinish()
  }

  return (
    <>
      <div className="progress" style={{ marginBottom: 14 }}>
        <i style={{ width: `${(seenCount / content.words.length) * 100}%` }} />
      </div>
      <button
        className="flash-card"
        onClick={() => speak(card.ex ? `${card.en}. ${card.ex}` : card.en, rate)}
      >
        {card.img ? (
          <img className="photo" src={card.img} alt="" />
        ) : (
          <span className={`visual ${isTextVisual(card.v) ? 'textual' : ''}`}>{card.v}</span>
        )}
        <span className="word">{card.en}</span>
        {card.ex && <span className="ex">“{card.ex}”</span>}
        <span className="speaker">🔊</span>
        <span className="hint">Karta dokun: kelime + örnek cümleyi dinle, yüksek sesle tekrar et</span>
      </button>
      <div className="btn-row">
        {idx > 0 && (
          <button className="btn ghost" onClick={() => setIdx(idx - 1)} style={{ flex: '0 0 30%' }}>
            ← Önceki
          </button>
        )}
        <button className="btn primary" onClick={next}>
          {idx < content.words.length - 1 ? 'Sonraki →' : 'Eşleştirmeye Geç 🎯'}
        </button>
      </div>
      <p className="empty-note">
        {idx + 1} / {content.words.length}
      </p>
    </>
  )
}

function MatchMode({ day, content, rate, isReview }) {
  const { state, update } = useApp()
  const [round, setRound] = useState(0)

  const initialQueue = useMemo(() => {
    const newIds = content.words.map((w) => w.id)
    let ids
    if (isReview) {
      // içerik güncellenince eski SRS kayıtlarında kalmış kartları ele
      ids = hardestCardIds(state, 15).filter((id) => allCards[id])
      if (ids.length === 0) ids = sample(allWords, 15).map((w) => w.id)
      ids = ids.slice(0, 20)
    } else {
      const due = dueReviewIds(state, newIds).filter((id) => allCards[id])
      const reviews = sample(due, 8)
      ids = [...newIds, ...reviews]
    }
    return shuffle(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  const [queue, setQueue] = useState(initialQueue)
  const [doneCount, setDoneCount] = useState(0)
  const [feedback, setFeedback] = useState(null) // { pickedId, ok }
  const wrongRef = useRef(new Set())
  const finishedRef = useRef(false)

  useEffect(() => {
    setQueue(initialQueue)
    setDoneCount(0)
    setFeedback(null)
    wrongRef.current = new Set()
    finishedRef.current = false
  }, [initialQueue])

  const total = initialQueue.length
  const card = queue.length ? allCards[queue[0]] : null
  const mode = doneCount % 2 === 0 ? 'v2w' : 'w2v' // görselden kelime / kelimeden görsel

  const options = useMemo(() => {
    if (!card) return []
    let pool = getDay(card.day).words.filter((w) => w.id !== card.id)
    if (pool.length < 3) pool = allWords.filter((w) => w.id !== card.id)
    // Aynı görsel iki şıkta çıkmasın
    const seenV = new Set([card.v])
    const distractors = []
    for (const w of shuffle(pool)) {
      if (distractors.length === 3) break
      if (seenV.has(w.v)) continue
      seenV.add(w.v)
      distractors.push(w)
    }
    return shuffle([card, ...distractors])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, mode, round])

  // Tur bitti mi?
  useEffect(() => {
    if (total > 0 && queue.length === 0 && !finishedRef.current) {
      finishedRef.current = true
      const prevDone = getDayState(state, day).done
      const next = update((s) => {
        const d = ensureDay(s, day)
        d.matchDone = true
        recomputeDay(s, day)
      })
      if (!prevDone && next.days[day]?.done) fireConfetti()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue])

  if (total > 0 && queue.length === 0) {
    const dayDone = getDayState(state, day).done
    return (
      <div className="task-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52 }}>🎯</div>
        <h3 style={{ margin: '8px 0' }}>Eşleştirme turu bitti!</h3>
        <p className="desc">
          {dayDone
            ? 'Bugünün tüm görevleri tamam — süpersin!'
            : 'Kelime kartları görevi tamamlandı. Sırada sesli pratik ve mini sınav var.'}
        </p>
        <button className="btn soft" onClick={() => setRound((r) => r + 1)}>
          🔁 Bir Tur Daha
        </button>
      </div>
    )
  }

  if (!card) return <p className="empty-note">Kart bulunamadı.</p>

  const pick = (opt) => {
    if (feedback) return
    const ok = opt.id === card.id
    setFeedback({ pickedId: opt.id, ok })
    if (ok) {
      speak(card.en, rate)
      const firstTry = !wrongRef.current.has(card.id)
      update((s) => {
        introduceCard(s, card.id)
        if (firstTry) answerCard(s, card.id, true)
      })
      setTimeout(() => {
        setFeedback(null)
        setDoneCount((c) => c + 1)
        setQueue((q) => q.slice(1))
      }, 750)
    } else {
      if (!wrongRef.current.has(card.id)) {
        wrongRef.current.add(card.id)
        update((s) => {
          introduceCard(s, card.id)
          answerCard(s, card.id, false) // kutu 1'e döner, aynı gün tekrar gelir
        })
      }
      setTimeout(() => {
        setFeedback(null)
        setQueue((q) => [...q.slice(1), q[0]]) // sıranın sonuna
      }, 1000)
    }
  }

  return (
    <>
      <div className="progress" style={{ marginBottom: 14 }}>
        <i style={{ width: `${((total - queue.length) / total) * 100}%` }} />
      </div>

      {mode === 'v2w' ? (
        <div className="q-prompt">
          {card.img ? (
            <img className="photo" src={card.img} alt="" />
          ) : (
            <div className={`visual ${isTextVisual(card.v) ? 'textual' : ''}`}>{card.v}</div>
          )}
          <div className="hint" style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 6 }}>
            Bu hangi kelime?
          </div>
        </div>
      ) : (
        <button className="q-prompt" style={{ width: '100%' }} onClick={() => speak(card.en, rate)}>
          <div className="word">{card.en} 🔊</div>
          <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 6 }}>
            Doğru görseli seç (dinlemek için dokun)
          </div>
        </button>
      )}

      <div className="opt-grid">
        {options.map((opt) => {
          let cls = 'opt'
          if (mode === 'w2v') cls += ` visual ${!opt.img && isTextVisual(opt.v) ? 'textual' : ''}`
          if (feedback) {
            if (opt.id === card.id) cls += ' good'
            else if (opt.id === feedback.pickedId) cls += ' bad'
          }
          return (
            <button key={opt.id} className={cls} onClick={() => pick(opt)}>
              {mode === 'v2w' ? (
                opt.en
              ) : opt.img ? (
                <img className="photo" src={opt.img} alt="" />
              ) : (
                opt.v
              )}
            </button>
          )
        })}
      </div>

      <div className={`feedback ${feedback ? (feedback.ok ? 'good' : 'bad') : ''}`}>
        {feedback ? (feedback.ok ? 'Doğru! 🎉' : `Doğrusu: ${card.en}`) : ''}
      </div>
      <p className="empty-note" style={{ padding: '4px 0 0' }}>
        Kalan kart: {queue.length}
      </p>
    </>
  )
}
