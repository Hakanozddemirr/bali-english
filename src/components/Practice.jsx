import { useEffect, useMemo, useRef, useState } from 'react'
import { getDay, days } from '../content'
import { useApp, ensureDay, addMistake } from '../lib/store'
import { speak } from '../lib/tts'
import { sample, shuffle } from '../lib/quizGen'
import { grade, matchKeys } from '../lib/match'
import { compareSentence } from '../lib/similarity'
import AnswerInput from './AnswerInput'

const SPEEDS = [0.85, 1.0, 1.1, 1.2]

export default function Practice({ day, onBack }) {
  const { state, update } = useApp()
  const content = getDay(day)
  const rate = state.settings.rate
  const isFinal = !content.chunks.length

  const items = useMemo(() => {
    const src = isFinal ? { ...content, chunks: days.flatMap((d) => d.chunks) } : content
    const quick = sample(src.quick, 5).map((q) => ({ kind: 'quick', ...q }))
    const social = shuffle(src.social).map((s) => ({ kind: 'social', ...s }))
    const gIntro = [{ kind: 'gintro', grammar: src.grammar }]
    const gDrills = src.grammar.drills.map((d) => ({ kind: 'grammar', ...d }))
    const lChoose = src.listening.map((l) => ({ kind: 'listen-choose', ...l, shuffled: shuffle([...l.options]) }))
    const lType = sample(src.chunks.filter((c) => c.en.length < 45 && !c.en.includes('___')), 1).map((c) => ({
      kind: 'listen-type', audio: c.en,
    }))
    return [...quick, ...social, ...gIntro, ...gDrills, ...lChoose, ...lType]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [i, setI] = useState(0)
  useEffect(() => {
    update((s) => { ensureDay(s, day).practice = { done: 0, total: items.length } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const next = () => {
    update((s) => { const d = ensureDay(s, day); d.practice.done = Math.min(d.practice.total, i + 1) })
    setI(i + 1)
  }

  const item = items[i]

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>⚡ Gün {day} Pratik</h2>
      </div>
      <div className="progress gold" style={{ marginBottom: 14 }}>
        <i style={{ width: `${(i / items.length) * 100}%` }} />
      </div>

      {!item ? (
        <div className="task-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 46 }}>🔥</div>
          <h3 style={{ margin: '8px 0' }}>Pratik bitti!</h3>
          <p className="desc">Şimdi sıra gerçek konuşmada — Konuşma bölümüne geç.</p>
          <button className="btn primary" onClick={onBack}>Güne Dön</button>
        </div>
      ) : (
        <ItemRunner key={i} item={item} rate={rate} onDone={next} />
      )}
      {item && <p className="empty-note">{i + 1} / {items.length}</p>}
    </div>
  )
}

function ItemRunner({ item, rate, onDone }) {
  const { update } = useApp()
  if (item.kind === 'quick') return <QuickItem item={item} rate={rate} onDone={onDone} update={update} />
  if (item.kind === 'social') return <SocialItem item={item} rate={rate} onDone={onDone} update={update} />
  if (item.kind === 'gintro') return <GrammarIntro grammar={item.grammar} onDone={onDone} />
  if (item.kind === 'grammar') return <GrammarDrill item={item} rate={rate} onDone={onDone} update={update} />
  if (item.kind === 'listen-choose') return <ListenChoose item={item} rate={rate} onDone={onDone} update={update} />
  if (item.kind === 'listen-type') return <ListenType item={item} rate={rate} onDone={onDone} update={update} />
  return null
}

// ⚡ Hızlı Cevap: soru okunur, ~5 saniyede cevap ver
function QuickItem({ item, rate, onDone, update }) {
  const [left, setLeft] = useState(5)
  const [phase, setPhase] = useState('ask')
  const [attempt, setAttempt] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    speak(item.q, rate, {
      accent: 'rotate',
      onend: () => {
        timerRef.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
      },
    })
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (t) => {
    clearInterval(timerRef.current)
    setAttempt(t)
    update((s) => { s.stats.speak++; s.stats.quick++ })
    setPhase('after')
  }

  return (
    <>
      <div className="q-prompt">
        <div className="quick-badge">⚡ HIZLI CEVAP {phase === 'ask' && <span className={`tick ${left <= 2 ? 'urgent' : ''}`}>{left}</span>}</div>
        <div className="word" style={{ fontSize: 20, marginTop: 8 }}>{item.q}</div>
        <button className="btn ghost" style={{ marginTop: 10, padding: 8, fontSize: 13 }} onClick={() => speak(item.q, rate, { accent: 'rotate' })}>🔊 Tekrar dinle</button>
      </div>
      {phase === 'ask' ? (
        <>
          <AnswerInput onSubmit={submit} placeholder="Düşünme, konuş!" />
          <button className="btn ghost" onClick={() => submit('')}>Pas →</button>
        </>
      ) : (
        <>
          {attempt && <div className="heard-line">Senin cevabın: “{attempt}”</div>}
          <div className="sample-box">💬 Doğal örnek: “{item.sample}”
            <button className="speaker" style={{ marginLeft: 8 }} onClick={() => speak(item.sample, rate)}>🔊</button>
          </div>
          <button className="btn primary" onClick={onDone}>Devam →</button>
        </>
      )}
    </>
  )
}

const SOCIAL_META = {
  react: { title: 'TEPKİ VER', tip: 'Doğal bir tepki + kısa bir soru. "Nice." deyip susma!' },
  follow: { title: 'TAKİP SORUSU', tip: 'Karşıyı konuşturacak bir soru sor.' },
  build: { title: 'REACT → ADD → ASK', tip: '1) Tepki ver 2) Kendinden bir şey ekle 3) Soru sor — tek cevapta üçü birden!' },
  story: { title: 'HİKÂYE ANLAT 🎬', tip: 'Başlangıç kalıplarını kullan, 30 saniye konuş.' },
}

function SocialItem({ item, rate, onDone, update }) {
  const meta = SOCIAL_META[item.type]
  const [phase, setPhase] = useState('ask')
  const [attempt, setAttempt] = useState('')
  const isStory = item.type === 'story'

  useEffect(() => {
    if (!isStory) speak(item.stmt, rate, { accent: 'rotate' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (t) => {
    setAttempt(t)
    update((s) => { s.stats.speak++; s.stats.social++ })
    setPhase('after')
  }

  return (
    <>
      <div className="q-prompt">
        <div className="quick-badge">{meta.title}</div>
        {item.type === 'build' && (
          <div className="build-steps"><span>1️⃣ React</span><span>2️⃣ Add</span><span>3️⃣ Ask</span></div>
        )}
        <div className={isStory ? 'tr' : 'word'} style={{ fontSize: isStory ? 16 : 19, marginTop: 8 }}>
          {isStory ? item.stmt : `“${item.stmt}”`}
        </div>
        <div style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: 6 }}>{meta.tip}</div>
        {isStory && phase === 'ask' && (
          <div className="sample-box" style={{ marginTop: 10, textAlign: 'left' }}>
            {item.samples.map((s, j) => <div key={j}>· {s}</div>)}
          </div>
        )}
      </div>
      {phase === 'ask' ? (
        <>
          <AnswerInput onSubmit={submit} placeholder={isStory ? 'Hikâyeni anlat…' : 'Cevabını söyle…'} />
          <button className="btn ghost" onClick={() => submit('')}>Pas →</button>
        </>
      ) : (
        <>
          {attempt && <div className="heard-line">Senin cevabın: “{attempt}”</div>}
          {!isStory && (
            <div className="sample-box">
              <b>İyi cevap örnekleri:</b>
              {item.samples.map((s, j) => (
                <div key={j} style={{ marginTop: 4 }}>
                  · {s} <button className="speaker" style={{ fontSize: 15 }} onClick={() => speak(s, rate)}>🔊</button>
                </div>
              ))}
            </div>
          )}
          {isStory && <div className="sample-box">👏 Hikâye anlattın — Bali'de en çok bunu yapacaksın!</div>}
          <button className="btn primary" onClick={onDone}>Devam →</button>
        </>
      )}
    </>
  )
}

function GrammarIntro({ grammar, onDone }) {
  return (
    <>
      <div className="q-prompt" style={{ textAlign: 'left' }}>
        <div className="quick-badge">📐 MİKRO GRAMER</div>
        <div className="word" style={{ fontSize: 18, margin: '8px 0' }}>{grammar.title}</div>
        {grammar.intro.map((p, j) => (
          <div key={j} className="gram-row">
            <b>{p.pattern}</b>
            <span>{p.ex}</span>
          </div>
        ))}
      </div>
      <button className="btn primary" onClick={onDone}>Alıştırmalara Geç →</button>
    </>
  )
}

function GrammarDrill({ item, rate, onDone, update }) {
  const [phase, setPhase] = useState('ask')
  const [attempt, setAttempt] = useState('')
  const [ok, setOk] = useState(false)

  const submit = (t) => {
    setAttempt(t)
    const good = matchKeys(t, item.keys) || grade(t, { target: item.best }) === 'strong'
    setOk(good)
    speak(item.best, rate)
    update((s) => {
      s.stats.speak++
      if (!good && t) addMistake(s, { orig: t, fix: item.best, note: 'gramer drilli' })
    })
    setPhase('after')
  }

  return (
    <>
      <div className="q-prompt">
        <div className="quick-badge">📐 SÖYLE</div>
        <div className="tr" style={{ marginTop: 8 }}>🇹🇷 “{item.tr}”</div>
      </div>
      {phase === 'ask' ? (
        <>
          <AnswerInput onSubmit={submit} placeholder="İngilizcesini üret…" />
          <button className="btn ghost" onClick={() => submit('')}>🙈 Göster</button>
        </>
      ) : (
        <>
          <div className={`feedback ${ok ? 'good' : 'bad'}`}>{ok ? '✅ Doğru!' : 'Doğal hali:'} “{item.best}”</div>
          {attempt && !ok && <div className="heard-line">Senin cevabın: “{attempt}” (hata bankana eklendi)</div>}
          <button className="btn primary" onClick={onDone}>Devam →</button>
        </>
      )}
    </>
  )
}

function SpeedChips({ speed, setSpeed }) {
  return (
    <div className="speed-chips">
      {SPEEDS.map((s) => (
        <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{s}x</button>
      ))}
    </div>
  )
}

function ListenChoose({ item, rate, onDone, update }) {
  const [picked, setPicked] = useState(null)
  const [speed, setSpeed] = useState(1.0)
  useEffect(() => { const t = setTimeout(() => speak(item.audio, rate * speed, { accent: 'rotate' }), 300); return () => clearTimeout(t) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])

  const pick = (opt) => {
    if (picked !== null) return
    setPicked(opt)
    update((s) => { s.stats.listenTotal++; if (opt === item.options[0]) s.stats.listenOk++ })
  }

  return (
    <>
      <div className="q-prompt">
        <div className="quick-badge">🎧 DİNLE</div>
        <button className="btn soft" style={{ margin: '10px 0 6px' }} onClick={() => speak(item.audio, rate * speed, { accent: 'rotate' })}>🔊 Dinle</button>
        <SpeedChips speed={speed} setSpeed={setSpeed} />
        <div style={{ fontSize: 14, marginTop: 6 }}>{item.q}</div>
      </div>
      <div className="opt-grid">
        {item.shuffled.map((opt) => {
          let cls = 'opt full'
          if (picked !== null) {
            if (opt === item.options[0]) cls += ' good'
            else if (opt === picked) cls += ' bad'
          }
          return <button key={opt} className={cls} onClick={() => pick(opt)}>{opt}</button>
        })}
      </div>
      {picked !== null && (
        <>
          <div className="heard-line" style={{ marginTop: 8 }}>Söylenen: “{item.audio}”</div>
          <button className="btn primary" onClick={onDone}>Devam →</button>
        </>
      )}
    </>
  )
}

function ListenType({ item, rate, onDone, update }) {
  const [phase, setPhase] = useState('ask')
  const [attempt, setAttempt] = useState('')
  const [ok, setOk] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  useEffect(() => { const t = setTimeout(() => speak(item.audio, rate * speed, { accent: 'rotate' }), 300); return () => clearTimeout(t) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])

  const submit = (t) => {
    setAttempt(t)
    const good = compareSentence(item.audio, t).score >= 0.7
    setOk(good)
    update((s) => { s.stats.listenTotal++; if (good) s.stats.listenOk++ })
    setPhase('after')
  }

  return (
    <>
      <div className="q-prompt">
        <div className="quick-badge">🎧 DİNLE & YAZ</div>
        <button className="btn soft" style={{ margin: '10px 0 6px' }} onClick={() => speak(item.audio, rate * speed, { accent: 'rotate' })}>🔊 Dinle</button>
        <SpeedChips speed={speed} setSpeed={setSpeed} />
        <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 6 }}>Duyduğunu aynen yaz</div>
      </div>
      {phase === 'ask' ? (
        <AnswerInput onSubmit={submit} placeholder="Duyduğunu yaz…" />
      ) : (
        <>
          <div className={`feedback ${ok ? 'good' : 'bad'}`}>{ok ? '✅ Doğru duydun!' : 'Söylenen:'} “{item.audio}”</div>
          {attempt && <div className="heard-line">Senin yazdığın: “{attempt}”</div>}
          <button className="btn primary" onClick={onDone}>Devam →</button>
        </>
      )}
    </>
  )
}
