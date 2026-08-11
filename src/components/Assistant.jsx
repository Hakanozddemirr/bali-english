import { useEffect, useMemo, useRef, useState } from 'react'
import { getDay, allWords } from '../content'
import { useApp, getDayState, ensureDay, recomputeDay } from '../lib/store'
import { speak, stopSpeaking } from '../lib/tts'
import { startListening, sttSupported } from '../lib/stt'
import { chatReply, buildSystemPrompt } from '../lib/claude'
import { compareSentence, normalize } from '../lib/similarity'
import { sample } from '../lib/quizGen'
import { fireConfetti } from '../lib/confetti'

const TARGET_SEC = 600
// claude.ai üzerinde yayınlanan sürümde dış API çağrıları güvenlik nedeniyle engellidir
const IS_PUBLISHED = /claude(usercontent)?\.(ai|com)$/.test(window.location.hostname)

const PRAISES = ['Great!', 'Very good!', 'Perfect!', 'Nice!', 'Well done!', 'Excellent!']

function fmt(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

const hasWord = (rawText, phrase) => {
  const padded = ` ${normalize(rawText)} `
  const n = normalize(phrase)
  return n.includes(' ') ? padded.includes(n) : padded.includes(` ${n} `)
}

// Sadece tek başına "help"/"yardım" yazılırsa yardım isteğidir —
// "Help me, please!" gibi cümleler normal cevap sayılır.
const isHelpRequest = (t) => /^\s*(help|yardim|yardım)[.!?]*\s*$/i.test(t)

// --- Tur 1: senaryo motoru ---
function runScriptTurn(script, idx, rawText) {
  const step = script[idx]
  if (isHelpRequest(rawText)) {
    return { display: `🇹🇷 “${step.tr}”\n\n${step.ai}`, speakText: step.ai, next: idx }
  }
  const matched =
    step.expect.some((p) => hasWord(rawText, p)) ||
    compareSentence(step.say, rawText).score >= 0.55
  if (!matched) {
    return {
      display: `You can say: “${step.say}” — try it! 🎯`,
      speakText: `You can say: ${step.say}`,
      next: idx,
    }
  }
  const praise = PRAISES[idx % PRAISES.length]
  const nextIdx = idx + 1
  if (nextIdx >= script.length) {
    return { display: `${praise} 🎉`, speakText: praise, next: 0, finished: true }
  }
  return {
    display: `${praise} ${script[nextIdx].ai}`,
    speakText: `${praise} ${script[nextIdx].ai}`,
    next: nextIdx,
  }
}

// --- Tur 2: kelime koçu — örneği göster, kullanıcı kendi cümlesini kursun ---
const wordPrompt = (w) => `Make a sentence with “${w.en}”. Example: “${w.ex}”`

function runWordTurn(word, rawText, tries) {
  const wordCount = normalize(rawText).split(' ').filter(Boolean).length
  const used = hasWord(rawText, word.en)
  if (isHelpRequest(rawText)) {
    return {
      display: `💡 Example: “${word.ex}” — you can repeat it, or make your own!`,
      speakText: word.ex,
      advance: false,
      tries,
    }
  }
  if (used && (wordCount >= 3 || tries >= 1)) {
    return { advance: true }
  }
  if (used) {
    return {
      display: `Good start! Now a little longer sentence, please. Example: “${word.ex}”`,
      speakText: `Good start! A longer sentence, please.`,
      advance: false,
      tries: tries + 1,
    }
  }
  if (tries >= 2) {
    return { advance: true, skipped: true }
  }
  return {
    display: `Use the word “${word.en}”. Example: “${word.ex}” — try again!`,
    speakText: `Use the word ${word.en}. For example: ${word.ex}`,
    advance: false,
    tries: tries + 1,
  }
}

export default function Assistant({ day, onBack }) {
  const { state, update } = useApp()
  const content = getDay(day)
  const scenario = content.scenario
  const script = scenario.script || []
  const st = getDayState(state, day)
  const { apiKey, model, rate } = state.settings
  const mode = apiKey ? 'claude' : 'script'

  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant'|'sys', text}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(st.talkSec)
  const [phase, setPhase] = useState('script') // 'script' | 'words'
  const [stepIdx, setStepIdx] = useState(0)
  const [wordIdx, setWordIdx] = useState(0)
  const triesRef = useRef(0)

  // 2. tur için kelime destesi (örneği olan kelimeler)
  const coachWords = useMemo(() => {
    const pool = (content.words.length ? content.words : allWords).filter((w) => w.ex)
    return sample(pool, Math.min(12, pool.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

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

  const firstLine = mode === 'script' && script.length ? script[0].ai : scenario.firstLine

  const start = () => {
    setStarted(true)
    setPhase('script')
    setStepIdx(0)
    setWordIdx(0)
    triesRef.current = 0
    setMessages([{ role: 'assistant', text: firstLine }])
    speak(firstLine, rate)
  }

  const enterWordsPhase = (out) => {
    out.push({
      role: 'sys',
      text: '🎉 1. tur bitti! 2. TUR: Şimdi günün kelimeleriyle KENDİ cümlelerini kur. Örneği dinle, sonra kendi cümleni söyle.',
    })
    out.push({ role: 'assistant', text: wordPrompt(coachWords[0]) })
  }

  const backToScript = (out) => {
    out.push({
      role: 'sys',
      text: '🏁 Kelime turu da bitti! Senaryo baştan başlıyor — bu kez ipucusuz dene, süre saymaya devam ediyor.',
    })
    out.push({ role: 'assistant', text: script[0].ai })
  }

  const send = async (rawText) => {
    const text = (rawText ?? input).trim()
    if (!text || busy) return
    setErr('')
    setInput('')

    // --- Ücretsiz yerleşik mod ---
    if (mode === 'script') {
      if (!script.length) {
        setErr('Bu senaryo için yerleşik diyalog bulunamadı.')
        return
      }
      if (phase === 'script') {
        const turn = runScriptTurn(script, stepIdx, text)
        const out = [{ role: 'user', text }, { role: 'assistant', text: turn.display }]
        let speakText = turn.speakText
        if (turn.finished && coachWords.length) {
          enterWordsPhase(out)
          setPhase('words')
          setWordIdx(0)
          triesRef.current = 0
          speakText = `${turn.speakText} Now let's use today's words! ${wordPrompt(coachWords[0])}`
        } else if (turn.finished) {
          backToScript(out)
        }
        setMessages((m) => [...m, ...out])
        setStepIdx(turn.next)
        speak(speakText, rate)
      } else {
        // kelime koçu turu
        const word = coachWords[wordIdx]
        const turn = runWordTurn(word, text, triesRef.current)
        const out = [{ role: 'user', text }]
        if (turn.advance) {
          triesRef.current = 0
          const praise = turn.skipped ? "Okay, let's continue!" : PRAISES[wordIdx % PRAISES.length]
          const nextIdx = wordIdx + 1
          if (nextIdx >= coachWords.length) {
            out.push({ role: 'assistant', text: `${praise} 🎉 You used ${coachWords.length} words!` })
            backToScript(out)
            setPhase('script')
            setStepIdx(0)
            setWordIdx(0)
            speak(`${praise} Amazing! Let's do the scenario again. ${script[0].ai}`, rate)
          } else {
            const nextPrompt = wordPrompt(coachWords[nextIdx])
            out.push({ role: 'assistant', text: `${praise} ${nextPrompt}` })
            setWordIdx(nextIdx)
            speak(`${praise} ${nextPrompt}`, rate)
          }
        } else {
          triesRef.current = turn.tries
          out.push({ role: 'assistant', text: turn.display })
          speak(turn.speakText, rate)
        }
        setMessages((m) => [...m, ...out])
      }
      return
    }

    // --- Claude modu (API anahtarı girilmişse) ---
    const newMsgs = [...messages.filter((m) => m.role !== 'sys'), { role: 'user', text }]
    setMessages((m) => [...m, { role: 'user', text }])
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
  const curStep = script[stepIdx]
  const curWord = coachWords[wordIdx]

  const showHelp = () => {
    if (mode === 'claude') {
      send('help')
      return
    }
    if (phase === 'words' && curWord) {
      setMessages((m) => [...m, { role: 'sys', text: `💡 Örnek: “${curWord.ex}” — aynısını da söyleyebilirsin.` }])
      speak(curWord.ex, rate)
      return
    }
    if (!curStep) return
    setMessages((m) => [...m, { role: 'assistant', text: `🇹🇷 “${curStep.tr}”\n\n${curStep.ai}` }])
    speak(curStep.ai, rate)
  }

  const showHint = () => {
    if (phase === 'words' && curWord) {
      setMessages((m) => [...m, { role: 'sys', text: `💡 Örnek: “${curWord.ex}”` }])
      speak(curWord.ex, rate)
      return
    }
    if (!curStep) return
    setMessages((m) => [...m, { role: 'sys', text: `💡 Şöyle diyebilirsin: “${curStep.say}”` }])
    speak(curStep.say, rate)
  }

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
            {mode === 'script' ? (
              <p className="desc">
                🎁 <b>Ücretsiz yerleşik mod, 2 turlu:</b> Önce senaryoyu oyna ({script.length} replik) —
                sonra günün kelimeleriyle <b>kendi cümlelerini</b> kur. Takılırsan 💡 örneği gösterir,
                🆘 Türkçesini verir. İnternet ve API anahtarı gerekmez.
              </p>
            ) : (
              <p className="desc">
                💡 Takılırsan mikrofona <b>“help”</b> de ya da 🆘 butonuna bas — Claude son cümlenin
                Türkçesini söyler.
              </p>
            )}
            {!sttSupported && (
              <div className="warn-box">
                Bu tarayıcıda mikrofonla konuşma çalışmıyor; yazarak cevap verebilirsin. En iyi
                deneyim için Chrome veya Safari kullan.
              </div>
            )}
            {IS_PUBLISHED && mode === 'claude' && (
              <div className="warn-box">
                ⚠️ Bu claude.ai sürümünde Claude modu çalışmaz (sayfa dış bağlantı kuramıyor).
                Anahtarı silersen ücretsiz yerleşik mod devreye girer — o her yerde çalışır.
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
                  style={{ display: 'block', textAlign: 'left', whiteSpace: 'pre-wrap' }}
                  onClick={() => speak(m.text.replace(/🇹🇷 “[^”]*”\s*/g, ''), rate)}
                >
                  {m.text}
                  <div className="re-listen">🔊 tekrar dinle</div>
                </button>
              ) : m.role === 'user' ? (
                <div key={i} className="bubble me">{m.text}</div>
              ) : (
                <div key={i} className="bubble sys">{m.text}</div>
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
            {!(mode === 'script' && phase === 'words') && (
              <button className="btn ghost" style={{ padding: 9, fontSize: 13.5 }} onClick={showHelp}>
                🆘 Türkçesi
              </button>
            )}
            {mode === 'script' ? (
              <button className="btn ghost" style={{ padding: 9, fontSize: 13.5 }} onClick={showHint}>
                💡 {phase === 'words' ? 'Örneği Göster' : 'Ne diyeyim?'}
              </button>
            ) : (
              <button
                className="btn ghost"
                style={{ padding: 9, fontSize: 13.5 }}
                onClick={() => lastAi && speak(lastAi.text, rate)}
              >
                🔊 Son Cümleyi Dinle
              </button>
            )}
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
