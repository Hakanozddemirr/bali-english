import { useEffect, useMemo, useRef, useState } from 'react'
import { getDay, days, allChunkList } from '../content'
import { useApp, getDayState, ensureDay, recomputeDay, addMistake, readiness } from '../lib/store'
import { buildQuiz } from '../lib/quizGen'
import { speak } from '../lib/tts'
import { grade, matchKeys, bestSimilarity } from '../lib/match'
import { compareSentence } from '../lib/similarity'
import { fireConfetti } from '../lib/confetti'
import AnswerInput from './AnswerInput'

const PASS = 7

export default function Quiz({ day, onBack }) {
  const { state, update } = useApp()
  const content = getDay(day)
  const rate = state.settings.rate
  const isFinal = day === 7

  const [attempt, setAttempt] = useState(0)
  const questions = useMemo(() => buildQuiz(content, allChunkList, days), [attempt]) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const savedRef = useRef(false)
  const q = questions[i]

  useEffect(() => {
    if (!finished && (q?.type === 'listen-choose' || q?.type === 'listen-type')) {
      const t = setTimeout(() => speak(q.audio, rate, { accent: 'rotate' }), 350)
      return () => clearTimeout(t)
    }
  }, [i, attempt, finished]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!finished || savedRef.current) return
    savedRef.current = true
    const prevDone = getDayState(state, day).done
    const next = update((s) => {
      const d = ensureDay(s, day)
      d.quizBest = Math.max(d.quizBest, score)
      s.stats.quizzes++
      if (score >= PASS) d.quizDone = true
      recomputeDay(s, day)
    })
    if (score >= PASS && !prevDone && next.days[day]?.done) fireConfetti()
    else if (score >= PASS) fireConfetti(1400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  const answered = (ok) => {
    if (ok) setScore((s) => s + 1)
    if (i + 1 >= questions.length) setFinished(true)
    else setI(i + 1)
  }

  if (finished) {
    const pass = score >= PASS
    return (
      <div className="screen">
        <div className="topbar">
          <button className="back-btn" onClick={onBack}>←</button>
          <h2>📝 Gün {day} Testi</h2>
        </div>
        <div className="task-card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 56 }}>{pass ? '🏆' : '💪'}</div>
          <h3 style={{ margin: '8px 0 4px', fontSize: 26 }}>{score} / {questions.length}</h3>
          <p className="desc">{pass ? 'Geçtin!' : `Geçmek için ${PASS} gerekiyor — sorular her seferinde değişir, hemen tekrar dene.`}</p>
          {!pass && <button className="btn orange" onClick={() => { setAttempt((a) => a + 1); setI(0); setScore(0); setFinished(false); savedRef.current = false }}>🔁 Tekrar Dene</button>}
          {pass && !isFinal && <button className="btn primary" onClick={onBack}>Güne Dön</button>}
        </div>
        {pass && isFinal && <Scorecard onBack={onBack} />}
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
      <Question key={`${attempt}-${i}`} q={q} rate={rate} onAnswered={answered} update={update} />
    </div>
  )
}

function Question({ q, rate, onAnswered, update }) {
  const [picked, setPicked] = useState(null)
  const [phase, setPhase] = useState('ask')
  const [attempt, setAttempt] = useState('')
  const [ok, setOk] = useState(false)

  // --- tanıma: TR -> doğru İngilizce kalıp ---
  if (q.type === 'rec') {
    return (
      <>
        <div className="q-prompt"><div className="tr">🇹🇷 “{q.tr}” — İngilizcesi hangisi?</div></div>
        <div className="opt-grid">
          {q.options.map((opt) => {
            let cls = 'opt full'
            if (picked !== null) {
              if (opt === q.correct) cls += ' good'
              else if (opt === picked) cls += ' bad'
            }
            return (
              <button key={opt} className={cls} onClick={() => {
                if (picked !== null) return
                setPicked(opt)
                speak(q.correct, rate)
              }}>{opt}</button>
            )
          })}
        </div>
        {picked !== null && <button className="btn primary" style={{ marginTop: 10 }} onClick={() => onAnswered(picked === q.correct)}>Devam →</button>}
      </>
    )
  }

  if (q.type === 'listen-choose') {
    return (
      <>
        <div className="q-prompt">
          <button className="btn soft" onClick={() => speak(q.audio, rate, { accent: 'rotate' })}>🔊 Dinle</button>
          <div style={{ fontSize: 14, marginTop: 8 }}>{q.q}</div>
        </div>
        <div className="opt-grid">
          {q.options.map((opt) => {
            let cls = 'opt full'
            if (picked !== null) {
              if (opt === q.correct) cls += ' good'
              else if (opt === picked) cls += ' bad'
            }
            return <button key={opt} className={cls} onClick={() => picked === null && setPicked(opt)}>{opt}</button>
          })}
        </div>
        {picked !== null && <button className="btn primary" style={{ marginTop: 10 }} onClick={() => onAnswered(picked === q.correct)}>Devam →</button>}
      </>
    )
  }

  if (q.type === 'listen-type') {
    return (
      <>
        <div className="q-prompt">
          <button className="btn soft" onClick={() => speak(q.audio, rate, { accent: 'rotate' })}>🔊 Dinle</button>
          <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 6 }}>Duyduğunu yaz</div>
        </div>
        {phase === 'ask' ? (
          <AnswerInput onSubmit={(t) => { setAttempt(t); setOk(compareSentence(q.audio, t).score >= 0.7); setPhase('after') }} placeholder="Duyduğunu yaz…" />
        ) : (
          <>
            <div className={`feedback ${ok ? 'good' : 'bad'}`}>{ok ? '✅' : 'Söylenen:'} “{q.audio}”</div>
            {attempt && <div className="heard-line">Sen: “{attempt}”</div>}
            <button className="btn primary" onClick={() => onAnswered(ok)}>Devam →</button>
          </>
        )}
      </>
    )
  }

  if (q.type === 'grammar') {
    return (
      <>
        <div className="q-prompt"><div className="tr">🗣️ İngilizce söyle: “{q.tr}”</div></div>
        {phase === 'ask' ? (
          <AnswerInput onSubmit={(t) => {
            setAttempt(t)
            const good = matchKeys(t, q.keys) || grade(t, { target: q.best }) === 'strong'
            setOk(good)
            speak(q.best, rate)
            if (!good && t) update((s) => addMistake(s, { orig: t, fix: q.best, note: 'test' }))
            setPhase('after')
          }} placeholder="İngilizcesini üret…" />
        ) : (
          <>
            <div className={`feedback ${ok ? 'good' : 'bad'}`}>{ok ? '✅ Doğru!' : 'Doğal hali:'} “{q.best}”</div>
            <button className="btn primary" onClick={() => onAnswered(ok)}>Devam →</button>
          </>
        )}
      </>
    )
  }

  // --- konuşma soruları: quick / react / follow (devam ettirme) ---
  const isQuick = q.type === 'speak-quick'
  const title = isQuick ? '⚡ SESLİ CEVAPLA' : q.type === 'speak-react' ? '⚡ TEPKİ VER + SORU SOR' : '🔄 SOHBETİ DEVAM ETTİR'
  const promptText = isQuick ? q.q : q.stmt
  return (
    <>
      <div className="q-prompt">
        <div className="quick-badge">{title}</div>
        <div className="word" style={{ fontSize: 19, marginTop: 8 }}>“{promptText}”</div>
        <button className="btn ghost" style={{ marginTop: 8, padding: 8, fontSize: 13 }} onClick={() => speak(promptText, rate, { accent: 'rotate' })}>🔊 Dinle</button>
      </div>
      {phase === 'ask' ? (
        <>
          <AnswerInput onSubmit={(t) => {
            setAttempt(t)
            const sim = bestSimilarity(t, q.samples)
            setOk(sim >= 0.45 || grade(t, { samples: q.samples }) !== 'weak')
            update((s) => { s.stats.speak++ })
            setPhase('after')
          }} placeholder="Sesli cevap ver…" />
          <button className="btn ghost" onClick={() => { setAttempt(''); setOk(false); setPhase('after') }}>Pas →</button>
        </>
      ) : (
        <>
          {attempt && <div className="heard-line">Senin cevabın: “{attempt}”</div>}
          <div className="sample-box">
            <b>İyi cevap örnekleri:</b>
            {q.samples.map((s, j) => <div key={j} style={{ marginTop: 4 }}>· {s}</div>)}
          </div>
          {attempt && ok ? (
            <button className="btn primary" onClick={() => onAnswered(true)}>Sayıldı ✅ Devam</button>
          ) : (
            <div className="btn-row">
              <button className="btn primary" onClick={() => onAnswered(true)}>✅ Böyle bir şey dedim</button>
              <button className="btn danger" onClick={() => onAnswered(false)}>❌ Diyemedim</button>
            </div>
          )}
        </>
      )}
    </>
  )
}

// Gün 7 karnesi: alan alan Hazır / Tekrar Gerekli
function Scorecard({ onBack }) {
  const { state } = useApp()
  const r = readiness(state, days.length)
  const rows = [
    ['Sohbet başlatma', r.social >= 50], ['Kişisel sorulara cevap', r.speak >= 50],
    ['Sohbeti sürdürme', r.social >= 65], ['Takip soruları', r.social >= 55],
    ['Tepkiler', r.social >= 45], ['Plan yapma', r.speak >= 60],
    ['Dinleme', r.listening >= 65], ['Pratik İngilizce', r.practical >= 70],
    ['Sohbet kurtarma', true],
  ]
  const weak = rows.filter(([, ok]) => !ok)
  return (
    <div className="task-card">
      <div className="head"><span className="ico">🌴</span><span className="name">Bali Conversation Readiness</span></div>
      {rows.map(([lbl, ok]) => (
        <div className="ready-row" key={lbl}>
          <span className="lbl" style={{ flex: 1 }}>{lbl}</span>
          <span style={{ fontWeight: 800, color: ok ? 'var(--ok)' : 'var(--accent2)' }}>{ok ? 'Hazır ✅' : 'Tekrar 🔁'}</span>
        </div>
      ))}
      <p className="desc" style={{ marginTop: 10 }}>
        {weak.length
          ? `Bu gece son tekrar: ${weak.map(([l]) => l).join(', ')} — Gün ${weak.length > 2 ? '3 ve 4' : '4'} pratiklerini bir tur daha yap, sonra Free Talk'ta 10 dakika Realistic modda konuş.`
          : 'Her alan hazır görünüyor — bu gece Free Talk\'ta Realistic modda son bir 10 dakika yap ve valizini topla! 🎉'}
      </p>
      <button className="btn primary" onClick={onBack}>Tamam</button>
    </div>
  )
}
