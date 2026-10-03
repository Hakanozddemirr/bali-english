import { useEffect, useMemo, useRef, useState } from 'react'
import { getDay, freetalk, TOTAL_DAYS, allChunkList, guide } from '../content'
import { useApp, getDayState, ensureDay, recomputeDay, addMistake, activeDayNum, ensureLog, getLog, FULL_TALK } from '../lib/store'
import { todayFocus } from '../lib/course'
import { dueCards } from '../lib/cards'
import { todayISO } from '../lib/dates'
import { speak, stopSpeaking } from '../lib/tts'
import { chatReply, buildTalkPrompt, parseMistakes } from '../lib/claude'
import { pickPersona, fill, runBeatTurn, offlineFeedback } from '../lib/beats'
import { wordCount } from '../lib/match'
import { fireConfetti } from '../lib/confetti'
import AnswerInput from './AnswerInput'

const TARGET_SEC = 600

// Günlük konuşma için Bali + gündelik hayat bağlamları
const LIFE_CONTEXTS = [
  { id: 'istanbul-cafe', title: 'İstanbul\'da Kafe', emoji: '☕', settingEn: 'a cafe in Istanbul; you are a tourist visiting Istanbul and you start chatting with him at the next table', situationTr: 'İstanbul\'da bir kafede yan masadaki turist seninle sohbet ediyor.' },
  { id: 'coworking', title: 'Coworking Tanışma', emoji: '💻', settingEn: 'a coworking space in Canggu; you are a digital nomad meeting him at the coffee machine', situationTr: 'Canggu\'da coworking\'desin; kahve makinesinin başında biriyle tanışıyorsun.' },
  { id: 'gym', title: 'Spor Salonu', emoji: '🏋️', settingEn: 'a gym; you are another regular who chats with him between sets', situationTr: 'Spor salonunda setler arasında biriyle sohbet.' },
  { id: 'business', title: 'İş Sohbeti', emoji: '🛍️', settingEn: 'a networking event for online sellers; you run a small e-commerce brand and ask about his online clothing shop', situationTr: 'E-ticaret networking etkinliği; biri senin online mağazanı soruyor.' },
  { id: 'weekend', title: 'Hafta Sonu Planları', emoji: '📅', settingEn: 'a video call with a friend you met in Bali; you catch up about last week and plans', situationTr: 'Bali\'de tanıştığın bir arkadaşla görüntülü konuşma: geçen hafta ne yaptın, planın ne?' },
]
const IS_PUBLISHED = /claude(usercontent)?\.(ai|com)$/.test(window.location.hostname)

// Claude cevabındaki "Try: ___" kalıbını ayır (ayrı balonda gösterilir, sesli okunmaz)
function splitTry(reply) {
  const m = reply.match(/\n?\s*Try:\s*(.+)\s*$/i)
  if (!m) return { body: reply, tryLine: null }
  return { body: reply.slice(0, m.index).trim(), tryLine: m[1].replace(/^["“]|["”]$/g, '') }
}

// Konuşmada kelime sesli okunurken parantez/köşeli parantez içi atlanır
const forSpeech = (t) => t.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '')

const RESCUE = [
  ['How do you say ___ in English?', '___ İngilizcede nasıl denir?'],
  ["Sorry, can you say that again?", 'Pardon, tekrar eder misin?'],
  ['Can you speak slowly, please?', 'Yavaş konuşur musun?'],
  ["I don't know the word, but…", 'Kelimeyi bilmiyorum ama…'],
  ['What does ___ mean?', '___ ne demek?'],
]

// Çevrimdışı kelime arama: Bali kalıpları + rehber + kendi kartların
function localLookup(q, cards) {
  const n = (x) => (x || '').toLocaleLowerCase('tr').trim()
  const query = n(q)
  if (!query) return []
  const pool = [
    ...Object.values(cards).map((c) => ({ tr: c.tr, en: c.en })),
    ...allChunkList.map((c) => ({ tr: c.tr, en: c.en })),
    ...guide.categories.flatMap((c) => c.phrases.map((p) => ({ tr: p.tr, en: p.en }))),
  ]
  // Türkçe ekler için kök yakalama: "hesap" → "hesa" (hesabı, hesabı alabilir miyiz…)
  const stem = query.length > 4 ? query.slice(0, Math.max(4, query.length - 1)) : query
  const hits = pool.filter((p) => p.tr && n(p.tr).includes(stem))
  hits.sort((a, b) => a.tr.length - b.tr.length)
  const seen = new Set()
  return hits.filter((h) => !seen.has(h.en) && seen.add(h.en)).slice(0, 3)
}

function fmt(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

const MODES = [
  { id: 'guided', label: '🐢 Guided', descTr: 'Yavaş ve basit; örnek cevaplar gösterilir.' },
  { id: 'normal', label: '💬 Normal', descTr: 'Doğal gezgin İngilizcesi.' },
  { id: 'realistic', label: '⚡ Realistic', descTr: 'Gerçek hız, beklenmedik sorular.' },
]

export default function Talk({ day, simId, freeCtxId, daily, onBack }) {
  const { state, update } = useApp()
  const { apiKey, model, rate, talkMode } = state.settings
  // Günlük ve serbest konuşma bugünün kaydına yazılır; eski 7 günlük sprint kendi gününe
  const toLog = daily || !!freeCtxId
  const creditDay = day || activeDayNum(state, TOTAL_DAYS)
  const st = getDayState(state, creditDay)
  const todayLog = getLog(state)
  const [ctxSeed, setCtxSeed] = useState(() => Math.random())

  // Kaynak senaryoyu çöz: gün senaryosu / gün-7 simülasyonu / free talk bağlamı
  const src = useMemo(() => {
    if (daily) {
      const pool = [...LIFE_CONTEXTS, ...freetalk.contexts]
      const ctx = pool[Math.floor(ctxSeed * pool.length)]
      return {
        title: `${ctx.emoji} ${ctx.title}`, situationTr: ctx.situationTr,
        settingEn: ctx.settingEn, beats: freetalk.beats, personas: freetalk.personas,
        goalTr: 'Her cevaba en az 2 cümle: …because… / …and… Bugünkü yapıyı kullan.',
      }
    }
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
  }, [day, simId, freeCtxId, daily, ctxSeed])

  // Bugünün odağı: sabah çalışılan yapı + kitaptan eklenen / vadesi gelen kelimeler
  const focus = useMemo(() => {
    if (!toLog) return null
    const f = todayFocus(state, todayLog.lessons)
    const words = [
      ...Object.values(state.cards).filter((c) => c.type === 'word' && c.created === todayISO()),
      ...dueCards(state).filter((c) => c.type === 'word'),
    ].map((c) => c.en)
    return { ...f, words: [...new Set(words)].slice(0, 6) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toLog])

  const persona = useMemo(() => pickPersona(src.personas), [src])
  const mode = talkMode || 'normal'
  const claudeMode = !!apiKey && !IS_PUBLISHED

  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant'|'sys', text, tr?}
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(toLog ? todayLog.talkSec : st.talkSec)
  const target = toLog ? FULL_TALK : TARGET_SEC
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
      if (toLog) {
        const l = ensureLog(s)
        if (secsRef.current > l.talkSec) l.talkSec = secsRef.current
        return
      }
      const d = ensureDay(s, creditDay)
      if (secsRef.current > d.talkSec) d.talkSec = secsRef.current
      if (d.talkSec >= TARGET_SEC && !d.talkDone) {
        d.talkDone = true
        recomputeDay(s, creditDay)
      }
    })

  useEffect(() => {
    if (!started || secs === 0) return
    if (toLog) {
      if (secs % 10 === 0) persist()
      if (secs === target) fireConfetti(1400)
      return
    }
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
        const personaLine = daily
          ? `${persona.name}, a friendly person from ${persona.from} (fit the character to the setting)`
          : `${persona.name}, a traveler from ${persona.from} who has been in Bali for ${persona.days || 'a while'}`
        const reply = await chatReply({
          apiKey, model,
          system: buildTalkPrompt({ personaLine, settingEn: src.settingEn, mode, focus }),
          history,
        })
        if (text === '[[feedback]]') {
          setMessages((m) => [...m, { role: 'sys', text: reply }])
          const found = parseMistakes(reply)
          if (found.length) update((s) => found.forEach((f) => addMistake(s, { ...f, note: src.title })))
          markSimDone()
        } else {
          const { body, tryLine } = splitTry(reply)
          setMessages((m) => [...m, { role: 'assistant', text: body, tryLine }])
          speak(forSpeech(body), rate, { accent: 'rotate' })
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

  const [wordOpen, setWordOpen] = useState(false)
  const [wordQ, setWordQ] = useState('')
  const askWord = () => {
    const q = wordQ.trim()
    if (!q) return
    setWordQ(''); setWordOpen(false)
    if (claudeMode) return send(`[[word: ${q}]]`)
    const hits = localLookup(q, state.cards)
    pushSys(hits.length
      ? `🇹🇷→🇬🇧 “${q}”:\n` + hits.map((h) => `• ${h.en} — ${h.tr}`).join('\n')
      : `“${q}” kayıtlı kalıplarda yok. API anahtarı girersen her kelimeyi sorabilirsin. Şimdilik: “I don't know the word, but…” deyip anlatmayı dene.`)
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
          <span className={`timer-chip ${(!toLog && st.talkDone) || secs >= target ? 'done' : ''}`}>
            ⏱ {fmt(Math.min(secs, target))} {(!toLog && st.talkDone) || secs >= target ? '✓' : ''}
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
            {focus && (
              <div className="sample-box">
                🎯 <b>Bugünkü yapı:</b> {focus.pattern}
                {focus.words.length > 0 && <><br />📗 <b>Kullanmaya çalış:</b> {focus.words.join(', ')}</>}
              </div>
            )}
            {daily && <button className="link-btn" onClick={() => setCtxSeed(Math.random())}>🔀 Başka senaryo</button>}
            <div className="sample-box">
              <b>🛟 Takılınca:</b> Türkçe kelime karıştırmak serbest (“I went to the <i>plaj</i>”) — doğrusunu söyler.
              Ya da 🇹🇷 <b>Kelime sor</b>. Kurtarıcı cümleler:
              {RESCUE.map(([en, tr]) => <div key={en} className="rescue">• <b>{en}</b> <span>{tr}</span></div>)}
            </div>
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
                <div key={i}>
                  <button className="bubble ai" style={{ display: 'block', textAlign: 'left', whiteSpace: 'pre-wrap' }}
                    onClick={() => speak(forSpeech(m.text), rate, { accent: 'rotate' })}>
                    {m.text}
                    <div className="re-listen">🔊 tekrar dinle</div>
                  </button>
                  {m.tryLine && <div className="try-bubble">💬 Şöyle başla: <b>{m.tryLine}</b></div>}
                </div>
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
            <button onClick={() => setWordOpen((v) => !v)}>🇹🇷 Kelime sor</button>
            <button onClick={finishFeedback}>🏁 Bitir</button>
          </div>
          {wordOpen && (
            <div className="word-ask">
              <input value={wordQ} onChange={(e) => setWordQ(e.target.value)} placeholder="Türkçe kelime (ör. kiralamak)"
                onKeyDown={(e) => e.key === 'Enter' && askWord()} autoFocus />
              <button className="btn primary" onClick={askWord} disabled={!wordQ.trim() || busy}>Sor</button>
            </div>
          )}
          <div style={{ padding: '0 16px calc(10px + env(safe-area-inset-bottom))' }}>
            <AnswerInput onSubmit={send} disabled={busy} />
          </div>
        </>
      )}
    </div>
  )
}
