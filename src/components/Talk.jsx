import { useEffect, useMemo, useRef, useState } from 'react'
import { getDay, freetalk, TOTAL_DAYS } from '../content'
import { useApp, getDayState, ensureDay, recomputeDay, addMistake, activeDayNum } from '../lib/store'
import { speak, stopSpeaking } from '../lib/tts'
import { chatReply, buildTalkPrompt, parseMistakes } from '../lib/claude'
import { pickPersona, fill, runBeatTurn, offlineFeedback } from '../lib/beats'
import { wordCount } from '../lib/match'
import { fireConfetti } from '../lib/confetti'
import AnswerInput from './AnswerInput'

const TARGET_SEC = 600
const IS_PUBLISHED = /claude(usercontent)?\.(ai|com)$/.test(window.location.hostname)

function fmt(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

const MODES = [
  { id: 'guided', label: '🐢 Guided', descTr: 'Yavaş ve basit; örnek cevaplar gösterilir.' },
  { id: 'normal', label: '💬 Normal', descTr: 'Doğal gezgin İngilizcesi.' },
  { id: 'realistic', label: '⚡ Realistic', descTr: 'Gerçek hız, beklenmedik sorular.' },
]

export default function Talk({ day, simId, freeCtxId, onBack }) {
  const { state, update } = useApp()
  const { apiKey, model, rate, talkMode } = state.settings
  const creditDay = day || activeDayNum(state, TOTAL_DAYS)
  const st = getDayState(state, creditDay)

  // Kaynak senaryoyu çöz: gün senaryosu / gün-7 simülasyonu / free talk bağlamı
  const src = useMemo(() => {
    if (freeCtxId) {
      const ctx = freetalk.contexts.find((c) => c.id === freeCtxId)
      return {
        title: `${ctx.emoji} ${ctx.title}`, situationTr: ctx.situationTr,
        settingEn: ctx.settingEn, beats: freetalk.beats, personas: freetalk.personas,
        goalTr: 'Aç, tepki ver, soru sor, plan yap — en az 5 dakika konuş.',
      }
    }
    const content = getDay(day)
    if (simId) {
      const sim = content.sims.find((s) => s.id === simId)
      return {
        title: sim.title, situationTr: sim.situationTr, settingEn: `a realistic Bali moment: ${sim.title}`,
        beats: sim.beats, personas: [sim.persona], simId, goalTr: content.goalTr, fast: sim.fast,
      }
    }
    const sc = content.scenario
    return {
      title: sc.title, situationTr: sc.situationTr, settingEn: sc.situationTr, beats: sc.beats,
      personas: sc.personas, goalTr: sc.goalTr,
    }
  }, [day, simId, freeCtxId])

  const persona = useMemo(() => pickPersona(src.personas), [src])
  const mode = talkMode || 'normal'
  const claudeMode = !!apiKey && !IS_PUBLISHED

  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant'|'sys', text, tr?}
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(st.talkSec)
  const [stepIdx, setStepIdx] = useState(0)
  const statsRef = useRef({ turns: 0, nudges: 0 })
  const scrollRef = useRef(null)
  const secsRef = useRef(secs)
  secsRef.current = secs

  useEffect(() => {
    if (!started) return
    const iv = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(iv)
  }, [started])

  const persist = () =>
    update((s) => {
      const d = ensureDay(s, creditDay)
      if (secsRef.current > d.talkSec) d.talkSec = secsRef.current
      if (d.talkSec >= TARGET_SEC && !d.talkDone) {
        d.talkDone = true
        recomputeDay(s, creditDay)
      }
    })

  useEffect(() => {
    if (!started || secs === 0) return
    if (secs % 10 === 0 || secs === TARGET_SEC) {
      const prevDone = getDayState(state, creditDay).done
      const prevTalk = getDayState(state, creditDay).talkDone
      const next = persist()
      const nd = next.days[creditDay]
      if (!prevDone && nd?.done) fireConfetti()
      else if (!prevTalk && nd?.talkDone) fireConfetti(1400)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs])

  useEffect(
    () => () => { persist(); stopSpeaking() },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  const firstLine = fill(src.beats[0].ai, persona)

  const start = () => {
    setStarted(true)
    setStepIdx(0)
    setMessages([{ role: 'assistant', text: firstLine, tr: fill(src.beats[0].tr, persona) }])
    speak(firstLine, rate * (src.fast ? 1.15 : 1), { accent: 'rotate' })
  }

  const pushSys = (text) => setMessages((m) => [...m, { role: 'sys', text }])

  const markSimDone = () =>
    update((s) => {
      const d = ensureDay(s, 7)
      if (src.simId && !d.simsDone.includes(src.simId)) d.simsDone.push(src.simId)
    })

  const send = async (text) => {
    if (busy) return
    setErr('')
    const isCmd = text.startsWith('[[')
    if (!isCmd) {
      setMessages((m) => [...m, { role: 'user', text }])
      statsRef.current.turns++
      update((s) => { s.stats.speak++ })
    }

    if (claudeMode) {
      setBusy(true)
      try {
        const history = [
          { role: 'user', content: '(The learner walks up. Begin the role-play with your opening line.)' },
          ...[...messages.filter((m) => m.role !== 'sys'), ...(isCmd ? [] : [{ role: 'user', text }])].map((m) => ({
            role: m.role, content: m.text,
          })),
          ...(isCmd ? [{ role: 'user', content: text }] : []),
        ]
        const personaLine = `${persona.name}, a traveler from ${persona.from} who has been in Bali for ${persona.days || 'a while'}`
        const reply = await chatReply({
          apiKey, model,
          system: buildTalkPrompt({ personaLine, settingEn: src.settingEn, mode }),
          history,
        })
        if (text === '[[feedback]]') {
          setMessages((m) => [...m, { role: 'sys', text: reply }])
          const found = parseMistakes(reply)
          if (found.length) update((s) => found.forEach((f) => addMistake(s, { ...f, note: src.title })))
          markSimDone()
        } else {
          setMessages((m) => [...m, { role: 'assistant', text: reply }])
          speak(reply.replace(/\(.*?\)/g, ''), rate, { accent: 'rotate' })
        }
      } catch (e) {
        setErr(e.message)
      } finally {
        setBusy(false)
      }
      return
    }

    // --- Çevrimdışı beat motoru: kabul-öncelikli ---
    if (isCmd) return
    const turn = runBeatTurn({ beats: src.beats, idx: stepIdx, persona, text })
    if (turn.nudged) statsRef.current.nudges++
    const out = []
    // "daha doğal örnek"i moda göre göster: guided her zaman, normal kısa cevapta
    if (turn.coach && (mode === 'guided' || (mode === 'normal' && wordCount(text) < 4))) {
      out.push({ role: 'sys', text: `💬 Daha doğal: “${turn.coach}”` })
    }
    if (turn.done) {
      out.push({ role: 'assistant', text: turn.reply })
      out.push({ role: 'sys', text: offlineFeedback({ turns: statsRef.current.turns, nudges: statsRef.current.nudges, dayChunks: day ? getDay(day).chunks : [] }) })
      markSimDone()
      setMessages((m) => [...m, ...out])
      speak(turn.reply, rate, { accent: 'rotate' })
      setStepIdx(0)
      return
    }
    out.push({ role: 'assistant', text: turn.reply, tr: turn.trOfReply })
    setMessages((m) => [...m, ...out])
    if (turn.advance) setStepIdx((i) => i + 1)
    speak(turn.reply, rate * (src.fast ? 1.15 : 1), { accent: 'rotate' })
  }

  const lastAi = [...messages].reverse().find((m) => m.role === 'assistant')
  const curBeat = src.beats[stepIdx]

  // --- Sosyal acil durum butonları ---
  const hint = () => {
    if (claudeMode) return send('[[hint]]')
    const s = fill(curBeat?.sample || '', persona)
    pushSys(`💡 Şöyle başlayabilirsin: “${s.split(' ').slice(0, 4).join(' ')}…”`)
  }
  const answer = () => {
    if (claudeMode) return send('[[answer]]')
    const s = fill(curBeat?.sample || '', persona)
    pushSys(`🗣️ Tam cevap: “${s}”`)
    speak(s, rate)
  }
  const whatTr = () => {
    if (claudeMode) return send('yardım')
    if (lastAi?.tr) pushSys(`🇹🇷 “${lastAi.tr}”`)
  }
  const replay = () => lastAi && speak(lastAi.text.replace(/\(.*?\)/g, ''), rate, { accent: 'rotate' })
  const slower = () => {
    if (claudeMode) return send('[[slower]]')
    lastAi && speak(lastAi.text.replace(/\(.*?\)/g, ''), rate * 0.72)
  }
  const finishFeedback = () => {
    if (claudeMode) return send('[[feedback]]')
    pushSys(offlineFeedback({ turns: statsRef.current.turns, nudges: statsRef.current.nudges, dayChunks: day ? getDay(day).chunks : [] }))
    markSimDone()
  }

  return (
    <div className="chat-wrap">
      <div className="chat-head">
        <div className="topbar" style={{ marginBottom: 6 }}>
          <button className="back-btn" onClick={onBack}>←</button>
          <h2 style={{ fontSize: 17 }}>{src.title}</h2>
          <span className={`timer-chip ${st.talkDone || secs >= TARGET_SEC ? 'done' : ''}`}>
            ⏱ {fmt(Math.min(secs, TARGET_SEC))} {st.talkDone || secs >= TARGET_SEC ? '✓' : ''}
          </span>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {!started ? (
          <div className="task-card">
            <div className="head"><span className="ico">🎬</span><span className="name">{src.title}</span></div>
            <p className="desc">📍 {src.situationTr}</p>
            <p className="desc">🎯 {src.goalTr}</p>
            <p className="desc">👤 Karşındaki: <b>{persona.name}</b> ({persona.from})</p>
            <div className="mode-chips">
              {MODES.map((m) => (
                <button key={m.id} className={mode === m.id ? 'on' : ''}
                  onClick={() => update((s) => { s.settings.talkMode = m.id })}>
                  {m.label}
                </button>
              ))}
            </div>
            <p className="desc" style={{ marginTop: 6 }}>{MODES.find((m) => m.id === mode)?.descTr}</p>
            {!claudeMode && (
              <p className="desc">
                🎁 Yerleşik mod aktif (ücretsiz, çevrimdışı). {apiKey && IS_PUBLISHED ? 'Bu claude.ai sürümünde Claude modu çalışmaz.' : 'Ayarlar\'a API anahtarı girersen Claude gerçek bir gezgin gibi serbest sohbet eder.'}
              </p>
            )}
            <button className="btn orange" onClick={start}>▶️ Konuşmayı Başlat</button>
          </div>
        ) : (
          <>
            <div className="bubble sys">🎬 {src.situationTr}</div>
            {messages.map((m, i) =>
              m.role === 'assistant' ? (
                <button key={i} className="bubble ai" style={{ display: 'block', textAlign: 'left', whiteSpace: 'pre-wrap' }}
                  onClick={() => speak(m.text.replace(/\(.*?\)/g, ''), rate, { accent: 'rotate' })}>
                  {m.text}
                  <div className="re-listen">🔊 tekrar dinle</div>
                </button>
              ) : m.role === 'user' ? (
                <div key={i} className="bubble me">{m.text}</div>
              ) : (
                <div key={i} className="bubble sys" style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{m.text}</div>
              ),
            )}
            {busy && <div className="bubble ai">💭 …</div>}
          </>
        )}
        {err && <div className="error-box">{err}</div>}
      </div>

      {started && (
        <>
          <div className="sos-row">
            <button onClick={hint}>💡 İpucu</button>
            <button onClick={answer}>🗣️ Cevap</button>
            <button onClick={whatTr}>🇹🇷 Ne dedi?</button>
            <button onClick={replay}>🔁</button>
            <button onClick={slower}>🐢</button>
            <button onClick={finishFeedback}>🏁 Bitir</button>
          </div>
          <div style={{ padding: '0 16px calc(10px + env(safe-area-inset-bottom))' }}>
            <AnswerInput onSubmit={send} disabled={busy} />
          </div>
        </>
      )}
    </div>
  )
}
