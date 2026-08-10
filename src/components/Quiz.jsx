import { useEffect, useMemo, useRef, useState } from 'react'
import { getDay, allWords } from '../content'
import { useApp, getDayState, ensureDay, recomputeDay } from '../lib/store'
import { buildQuiz } from '../lib/quizGen'
import { speak } from '../lib/tts'
import { fireConfetti } from '../lib/confetti'

const isTextVisual = (v) => /^[0-9]/.test(v)
const PASS = 8

export default function Quiz({ day, onBack }) {
  const { state, update } = useApp()
  const content = getDay(day)
  const rate = state.settings.rate

  const [attempt, setAttempt] = useState(0)
  const questions = useMemo(() => buildQuiz(content, allWords), [attempt]) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState(null)
  const [finished, setFinished] = useState(false)
  const savedRef = useRef(false)

  const q = questions[i]

  // Dinleme sorusu açılınca cümleyi otomatik oku (metin ekranda GÖSTERİLMEZ)
  useEffect(() => {
    if (!finished && q?.type === 'listen') {
      const t = setTimeout(() => speak(q.audio, rate), 350)
      return () => clearTimeout(t)
    }
  }, [i, attempt, finished]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sınav bitince skoru kaydet
  useEffect(() => {
    if (!finished || savedRef.current) return
    savedRef.current = true
    const prevDone = getDayState(state, day).done
    const next = update((s) => {
      const d = ensureDay(s, day)
      d.quizBest = Math.max(d.quizBest, score)
      if (score >= PASS) d.quizDone = true
      recomputeDay(s, day)
    })
    if (score >= PASS && (!prevDone && next.days[day]?.done)) fireConfetti()
    else if (score >= PASS) fireConfetti(1400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  const pick = (opt) => {
    if (picked !== null) return
    setPicked(opt)
    const ok = opt === q.correct
    if (ok) setScore((s) => s + 1)
    if (q.type === 'match') speak(q.correct, rate)
    if (q.type === 'sit') speak(q.correct, rate)
  }

  const nextQ = () => {
    if (i < questions.length - 1) {
      setI(i + 1)
      setPicked(null)
    } else {
      setFinished(true)
    }
  }

  const retry = () => {
    setAttempt((a) => a + 1)
    setI(0)
    setScore(0)
    setPicked(null)
    setFinished(false)
    savedRef.current = false
  }

  if (finished) {
    const pass = score >= PASS
    return (
      <div className="screen">
        <div className="topbar">
          <button className="back-btn" onClick={onBack}>←</button>
          <h2>📝 Gün {day} Sınavı</h2>
        </div>
        <div className="task-card" style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 60 }}>{pass ? '🏆' : '💪'}</div>
          <h3 style={{ margin: '10px 0 4px', fontSize: 26 }}>{score} / {questions.length}</h3>
          <p className="desc">
            {pass
              ? 'Geçtin! Mini sınav görevi tamamlandı.'
              : `Geçmek için ${PASS} doğru gerekiyor. Sorular her seferinde karışır — hemen tekrar dene!`}
          </p>
          {!pass && (
            <button className="btn orange" onClick={retry}>🔁 Tekrar Dene</button>
          )}
          {pass && (
            <button className="btn primary" onClick={onBack}>Güne Dön</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>📝 Soru {i + 1} / {questions.length}</h2>
      </div>
      <div className="progress gold" style={{ marginBottom: 14 }}>
        <i style={{ width: `${(i / questions.length) * 100}%` }} />
      </div>

      {q.type === 'match' && (
        <div className="q-prompt">
          {q.img ? (
            <img className="photo" src={q.img} alt="" />
          ) : (
            <div className={`visual ${isTextVisual(q.visual) ? 'textual' : ''}`}>{q.visual}</div>
          )}
          <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 6 }}>Bu hangi kelime?</div>
        </div>
      )}
      {q.type === 'sit' && (
        <div className="q-prompt">
          <div className="tr">🤔 {q.q}</div>
        </div>
      )}
      {q.type === 'listen' && (
        <div className="q-prompt">
          <button className="btn soft" style={{ marginBottom: 8 }} onClick={() => speak(q.audio, rate)}>
            🔊 Cümleyi Dinle
          </button>
          <div className="tr" style={{ fontSize: 15 }}>{q.q}</div>
        </div>
      )}

      <div className="opt-grid">
        {q.options.map((opt) => {
          let cls = 'opt full'
          if (picked !== null) {
            if (opt === q.correct) cls += ' good'
            else if (opt === picked) cls += ' bad'
          }
          return (
            <button key={opt} className={cls} onClick={() => pick(opt)}>
              {opt}
            </button>
          )
        })}
      </div>

      <div className={`feedback ${picked !== null ? (picked === q.correct ? 'good' : 'bad') : ''}`}>
        {picked !== null ? (picked === q.correct ? 'Doğru! 🎉' : 'Yanlış — doğrusu işaretlendi') : ''}
      </div>

      {picked !== null && (
        <button className="btn primary" onClick={nextQ}>
          {i < questions.length - 1 ? 'Devam →' : 'Sonucu Gör 🏁'}
        </button>
      )}
    </div>
  )
}
