import { useEffect, useRef, useState } from 'react'
import { getDay } from '../content'
import { useApp, getDayState, ensureDay, recomputeDay } from '../lib/store'
import { speak, stopSpeaking } from '../lib/tts'
import { startListening, sttSupported } from '../lib/stt'
import { chatReply, buildSystemPrompt } from '../lib/claude'
import { fireConfetti } from '../lib/confetti'

const TARGET_SEC = 600
// claude.ai üzerinde yayınlanan sürümde dış API çağrıları güvenlik nedeniyle engellidir
const IS_PUBLISHED = /claude(usercontent)?\.(ai|com)$/.test(window.location.hostname)

function fmt(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function Assistant({ day, onBack }) {
  const { state, update } = useApp()
  const content = getDay(day)
  const scenario = content.scenario
  const st = getDayState(state, day)
  const { apiKey, model, rate } = state.settings

  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant', text}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(st.talkSec)

  const recRef = useRef(null)
  const scrollRef = useRef(null)
  const secsRef = useRef(secs)
  secsRef.current = secs

  // --- süre sayacı: oturum açıkken sayar, 10 dk dolunca görev (b) tamamlanır ---
  useEffect(() => {
    if (!started) return
    const iv = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(iv)
  }, [started])

  const persist = () => {
    return update((s) => {
      const d = ensureDay(s, day)
      if (secsRef.current > d.talkSec) d.talkSec = secsRef.current
      if (d.talkSec >= TARGET_SEC && !d.talkDone) {
        d.talkDone = true
        recomputeDay(s, day)
      }
    })
  }

  useEffect(() => {
    if (!started || secs === 0) return
    if (secs % 10 === 0 || secs === TARGET_SEC) {
      const prevDone = getDayState(state, day).done
      const prevTalk = getDayState(state, day).talkDone
      const next = persist()
      const nd = next.days[day]
      if (!prevDone && nd?.done) fireConfetti()
      else if (!prevTalk && nd?.talkDone) fireConfetti(1400)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs])

  // Ekrandan çıkarken süreyi kaydet, sesi ve mikrofonu durdur
  useEffect(
    () => () => {
      persist()
      stopSpeaking()
      recRef.current?.stop()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  const start = () => {
    setStarted(true)
    setMessages([{ role: 'assistant', text: scenario.firstLine }])
    speak(scenario.firstLine, rate)
  }

  const send = async (rawText) => {
    const text = (rawText ?? input).trim()
    if (!text || busy) return
    if (!apiKey) {
      setErr('Sesli asistan için önce Ayarlar ekranından Anthropic API anahtarını girmen gerekiyor.')
      return
    }
    setErr('')
    setInput('')
    const newMsgs = [...messages, { role: 'user', text }]
    setMessages(newMsgs)
    setBusy(true)
    try {
      const history = [
        { role: 'user', content: '(The traveler approaches. Begin the role-play.)' },
        ...newMsgs.map((m) => ({ role: m.role, content: m.text })),
      ]
      const reply = await chatReply({
        apiKey,
        model,
        system: buildSystemPrompt(scenario),
        history,
      })
      setMessages((m) => [...m, { role: 'assistant', text: reply }])
      speak(reply, rate)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleMic = () => {
    if (busy) return
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    setErr('')
    stopSpeaking()
    recRef.current = startListening({
      onInterim: (t) => setInput(t),
      onFinal: (t) => {
        setListening(false)
        send(t)
      },
      onError: (m) => {
        setErr(m)
        setListening(false)
      },
      onEnd: () => setListening(false),
    })
    if (recRef.current) setListening(true)
  }

  const lastAi = [...messages].reverse().find((m) => m.role === 'assistant')

  return (
    <div className="chat-wrap">
      <div className="chat-head">
        <div className="topbar" style={{ marginBottom: 6 }}>
          <button className="back-btn" onClick={onBack}>←</button>
          <h2 style={{ fontSize: 18 }}>🗣️ {scenario.title}</h2>
          <span className={`timer-chip ${st.talkDone || secs >= TARGET_SEC ? 'done' : ''}`}>
            ⏱ {fmt(Math.min(secs, TARGET_SEC))} / 10:00 {st.talkDone || secs >= TARGET_SEC ? '✓' : ''}
          </span>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {!started ? (
          <div className="task-card">
            <div className="head">
              <span className="ico">{content.emoji}</span>
              <span className="name">{scenario.title}</span>
            </div>
            <p className="desc">📍 {scenario.situationTr}</p>
            <p className="desc">🎯 Hedefin: {scenario.goalTr}</p>
            <p className="desc">
              💡 Takılırsan mikrofona <b>“help”</b> de ya da 🆘 butonuna bas — Claude son cümlenin
              Türkçesini söyler.
            </p>
            {!sttSupported && (
              <div className="warn-box">
                Bu tarayıcıda mikrofonla konuşma çalışmıyor; yazarak cevap verebilirsin. En iyi
                deneyim için Chrome veya Safari kullan.
              </div>
            )}
            {IS_PUBLISHED && (
              <div className="warn-box">
                ⚠️ Bu paylaşılan web sürümünde sesli asistan çalışmaz (sayfa dış bağlantı
                kuramıyor). Kartlar, sınav, telaffuz ve rehber tam çalışır. Asistan için
                bilgisayardaki yerel sürümü kullan.
              </div>
            )}
            <button className="btn orange" onClick={start}>▶️ Senaryoyu Başlat</button>
          </div>
        ) : (
          <>
            <div className="bubble sys">
              🎬 {scenario.situationTr} — Balonlara dokunarak tekrar dinleyebilirsin.
            </div>
            {messages.map((m, i) =>
              m.role === 'assistant' ? (
                <button
                  key={i}
                  className="bubble ai"
                  style={{ display: 'block', textAlign: 'left' }}
                  onClick={() => speak(m.text, rate)}
                >
                  {m.text}
                  <div className="re-listen">🔊 tekrar dinle</div>
                </button>
              ) : (
                <div key={i} className="bubble me">{m.text}</div>
              ),
            )}
            {busy && <div className="bubble ai">💭 …</div>}
          </>
        )}
        {err && <div className="error-box">{err}</div>}
      </div>

      {started && (
        <>
          <div style={{ display: 'flex', gap: 8, padding: '0 16px 6px' }}>
            <button className="btn ghost" style={{ padding: 9, fontSize: 13.5 }} onClick={() => send('help')}>
              🆘 Yardım (Türkçesi)
            </button>
            <button
              className="btn ghost"
              style={{ padding: 9, fontSize: 13.5 }}
              onClick={() => lastAi && speak(lastAi.text, rate)}
            >
              🔊 Son Cümleyi Dinle
            </button>
          </div>
          <div className="chat-input">
            <button
              className={`round-btn ${listening ? 'rec' : ''}`}
              onClick={toggleMic}
              title="Mikrofonla konuş"
            >
              {listening ? '⏹' : '🎙️'}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={listening ? 'Dinliyorum…' : 'Konuş ya da yazarak cevapla…'}
            />
            <button className="round-btn send" onClick={() => send()} disabled={busy}>
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  )
}
