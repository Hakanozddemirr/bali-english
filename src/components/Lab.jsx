import { useMemo, useRef, useState } from 'react'
import { useApp, ensureLog } from '../lib/store'
import { todayISO } from '../lib/dates'
import { lessonByKey, labFor, lessonLabel } from '../lib/course'
import { checkSentence, canon } from '../lib/match'
import { addCard } from '../lib/cards'
import { judgeLabAnswer, generateLab } from '../lib/claude'
import { speak } from '../lib/tts'
import { fireConfetti } from '../lib/confetti'
import AnswerInput from './AnswerInput'
import WordDiff from './WordDiff'

const TILE_ITEMS = 4
const PASS = 50       // dersi tamamlamak için ilk denemede doğru oranı
const PASS_SKIP = 60  // videoyu atlayıp "biliyorum" diyorsa
const IS_PUBLISHED = /claude(usercontent)?\.(ai|com)$/.test(window.location.hostname)

// Kelime kartlarını karıştır; orijinal sırayı verirse en fazla birkaç kez yeniden dene
const shuffle = (arr) => {
  let a = arr
  for (let tries = 0; tries < 5; tries++) {
    a = [...arr]
    for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] }
    if (a.map((t) => t.w).join(' ') !== arr.map((t) => t.w).join(' ')) break
  }
  return a
}

const tilesOf = (sentence) => sentence.replace(/[.?!,]+$/g, '').split(/\s+/).filter(Boolean)

// Kelime dizme: dokun = ekle/çıkar, sürükle = sıradaki yerini değiştir (dokunmatik + fare)
function Tiles({ item, onResult, rate }) {
  const words = useMemo(() => tilesOf(item.en[0]), [item])
  const [pool, setPool] = useState(() => shuffle(words.map((w, i) => ({ w, i }))))
  const [line, setLine] = useState([])
  const [dragId, setDragId] = useState(null)
  const drag = useRef(null)       // {id, x, y, moved}
  const refs = useRef({})         // tile id -> DOM
  const full = line.length === words.length

  const take = (t) => { setPool((p) => p.filter((x) => x !== t)); setLine((l) => [...l, t]) }
  const drop = (t) => { setLine((l) => l.filter((x) => x !== t)); setPool((p) => [...p, t]) }
  const undo = () => line.length && drop(line[line.length - 1])
  const clear = () => { setPool((p) => [...p, ...line]); setLine([]) }

  const onDown = (e, t) => {
    drag.current = { id: t.i, x: e.clientX, y: e.clientY, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return
    if (!d.moved) { d.moved = true; setDragId(d.id) }
    // Parmağa en yakın kutunun yerine taşı
    setLine((l) => {
      let best = -1, bestDist = Infinity
      l.forEach((t, k) => {
        const r = refs.current[t.i]?.getBoundingClientRect()
        if (!r) return
        const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
        if (dist < bestDist) { bestDist = dist; best = k }
      })
      const from = l.findIndex((t) => t.i === d.id)
      if (best < 0 || from < 0 || best === from) return l
      const next = [...l]
      const [moving] = next.splice(from, 1)
      next.splice(best, 0, moving)
      return next
    })
  }
  const onUp = (t) => {
    const d = drag.current
    drag.current = null
    setDragId(null)
    if (d && !d.moved) drop(t) // sürüklemeden bırakıldı = dokunma → geri gönder
  }

  const check = () => onResult(line.map((t) => t.w).join(' '))

  return (
    <div>
      <div className="tile-line">
        {line.length === 0 && <span className="tile-ph">Kelimelere sırayla dokun…</span>}
        {line.map((t) => (
          <button key={t.i} ref={(el) => { refs.current[t.i] = el }}
            className={`tile on ${dragId === t.i ? 'dragging' : ''}`}
            onPointerDown={(e) => onDown(e, t)} onPointerMove={onMove} onPointerUp={() => onUp(t)}
            onPointerCancel={() => { drag.current = null; setDragId(null) }}>
            {t.w}
          </button>
        ))}
      </div>
      <div className="tile-help">Dokun: ekle / geri çıkar · Sürükle: yerini değiştir</div>
      <div className="tile-pool">
        {pool.map((t) => <button key={t.i} className="tile" onClick={() => take(t)}>{t.w}</button>)}
      </div>
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <button className="btn ghost" disabled={!line.length} onClick={undo}>↩ Geri al</button>
        <button className="btn ghost" disabled={!line.length} onClick={clear}>🗑 Temizle</button>
      </div>
      <button className="btn primary" disabled={!full} onClick={check}>Kontrol et</button>
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => speak(item.en[0], rate * 0.85)}>🐢 Doğrusunu dinle (ipucu)</button>
    </div>
  )
}

export default function Lab({ lessonKey, skip, onBack, onTalk }) {
  const { state, update } = useApp()
  const { apiKey, model, rate } = state.settings
  const canClaude = !!apiKey && !IS_PUBLISHED
  const lesson = lessonByKey[lessonKey]
  const lab = labFor(state, lessonKey)

  const [phase, setPhase] = useState('intro') // intro | run | end
  const [i, setI] = useState(0)
  const [res, setRes] = useState(null) // {attempt, verdict, best, diff, ai}
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // Puan: ilk denemede doğru/çok yakın = 1, sonraki denemede doğru = 0,5
  const [points, setPoints] = useState(0)
  const [showTip, setShowTip] = useState(false)
  const [tries, setTries] = useState(0)
  const [missed, setMissed] = useState(false) // bu cümlede gerçek bir yanlış oldu mu
  const [lastAi, setLastAi] = useState(null)   // son yanlışın Claude düzeltmesi

  const items = lab?.items || []
  const item = items[i]

  const generate = async () => {
    setBusy(true); setErr('')
    try {
      const out = await generateLab({ apiKey, model, lesson })
      update((s) => { s.labCache[lessonKey] = out })
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const award = (firstAttempt) => setPoints((p) => p + (firstAttempt ? 1 : 0.5))

  const evaluate = async (attempt, { voice = false } = {}) => {
    const local = checkSentence(attempt, item.en)
    // Kelime dizmede tüm kelimeler verili: sıra tam doğru olmalı, "yakın" yok
    if (i < TILE_ITEMS && local.verdict === 'close') local.verdict = 'wrong'
    let r = { attempt, ...local, ai: null, voice }
    if (local.verdict !== 'correct' && canClaude) {
      setBusy(true); setErr('')
      try {
        const ai = await judgeLabAnswer({ apiKey, tr: item.tr, expected: item.en, attempt, focus: lab.pattern || lesson.title })
        r = { ...r, ai, verdict: ai.ok ? 'correct' : local.verdict }
      } catch (e) { setErr(e.message) } finally { setBusy(false) }
    }
    // "Çok yakın" (küçük kayma ya da ses tanıma hatası) doğru sayılır
    const ok = r.verdict === 'correct' || r.verdict === 'close'
    if (ok) award(tries === 0)
    else { setMissed(true); if (r.ai?.noteTr) setLastAi({ attempt, ...r.ai }) }
    setTries((n) => n + 1)
    setRes(r)
    speak(r.verdict === 'correct' ? attempt : item.en[0], rate)
  }

  // Mikrofon yanlış duyduysa: kullanıcının beyanıyla doğru say, desteye ekleme
  const micOverride = () => {
    award(tries === 1)
    setMissed(false)
    setLastAi(null)
    setRes((r) => ({ ...r, verdict: 'correct', overridden: true }))
  }

  const next = () => {
    // Desteye sadece gerçekten yanlış yapılan cümleler girer
    if (missed) {
      update((s) => {
        addCard(s, { type: 'lab', en: item.en[0], tr: item.tr, src: lessonLabel(lesson) })
        if (lastAi && canon(lastAi.attempt) !== canon(lastAi.corrected)) {
          s.mistakes.unshift({ orig: lastAi.attempt, fix: lastAi.corrected, note: lastAi.noteTr, date: todayISO() })
          s.mistakes = s.mistakes.slice(0, 80)
        }
      })
    }
    setRes(null); setShowTip(false); setTries(0); setMissed(false); setLastAi(null)
    if (i + 1 >= items.length) return finish()
    setI(i + 1)
  }

  const finish = () => {
    const pct = Math.round((points / items.length) * 100)
    update((s) => {
      s.course.labBest[lessonKey] = Math.max(s.course.labBest[lessonKey] || 0, pct)
      if (pct >= (skip ? PASS_SKIP : PASS)) {
        s.course.done[lessonKey] = s.course.done[lessonKey] || todayISO()
        if (skip) s.course.skipped[lessonKey] = true
        const l = ensureLog(s)
        if (!l.lessons.includes(lessonKey)) l.lessons.push(lessonKey)
      }
    })
    if (pct >= 70) fireConfetti()
    setPhase('end')
  }

  const header = (
    <div className="topbar">
      <button className="back-btn" onClick={onBack}>←</button>
      <h2>🧪 Yapı Lab</h2>
      {phase === 'run' && <span className="timer-chip">{i + 1}/{items.length}</span>}
    </div>
  )

  if (!lab) {
    return (
      <div className="screen">
        {header}
        <div className="task-card">
          <div className="head"><span className="ico">📘</span><span className="name">{lessonLabel(lesson)} · {lesson.title}</span></div>
          <p className="desc">Bu ders için hazır Lab içeriği henüz yok.</p>
          {canClaude ? (
            <button className="btn primary" disabled={busy} onClick={generate}>{busy ? '⏳ Hazırlanıyor (~30 sn)…' : '✨ Claude ile bu dersin Lab\'ını hazırla'}</button>
          ) : (
            <p className="desc">Ayarlar'a Claude API anahtarı girersen bu dersin cümleleri otomatik hazırlanır. Şimdilik: videodaki örnekleri durdurup sesli tekrar et ve kendi hayatından 5 cümle kur.</p>
          )}
          {err && <div className="error-box">{err}</div>}
        </div>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div className="screen">
        {header}
        <div className="task-card">
          <div className="head"><span className="ico">📘</span><span className="name">{lessonLabel(lesson)} · {lesson.title}</span></div>
          <div className="sample-box"><b>🎯 Kural:</b> {lab.focusTr}{lab.pattern && <div className="pattern">{lab.pattern}</div>}</div>
          <p className="desc">
            {items.length} cümle. İlk {TILE_ITEMS}'ü kelime dizme (ısınma), sonrası Türkçeyi görüp <b>İngilizcesini sesli söylemek</b>.
            Yanlışlar tekrar destene eklenir — bu iyi bir şey.
          </p>
          <div className="warn-box">
            {skip ? `Videoyu atlıyorsun: ilk denemede %${PASS_SKIP} ve üstü yaparsan ders tamamlanır.` : `İlk denemede %${PASS} ve üstü doğru → ders tamamlanır.`}
          </div>
          {!canClaude && <p className="desc">Not: API anahtarı yoksa cevabın sadece kayıtlı doğru cevaplarla karşılaştırılır.</p>}
          <button className="btn primary" onClick={() => setPhase('run')}>Başla</button>
        </div>
      </div>
    )
  }

  if (phase === 'end') {
    const pct = Math.round((points / items.length) * 100)
    return (
      <div className="screen">
        {header}
        <div className="task-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>{pct >= 70 ? '🎉' : '💪'}</div>
          <p className="desc"><b>Puan: %{pct}</b> (ilk denemede doğru = 1, ikinci denemede = ½).  {pct >= 70 ? 'Bu yapı oturuyor.' : 'Bu yapı birkaç tekrar daha istiyor — yanlışlar tekrar destende.'}</p>
          {pct < (skip ? PASS_SKIP : PASS) && (
            <div className="warn-box">
              %{skip ? PASS_SKIP : PASS}'ın altında kaldı — ders henüz tamamlanmadı. {skip ? 'Videoyu izleyip' : 'Alıştırma videosuna tekrar bakıp'} Lab'ı yeniden çöz.
              Yanlışların zaten tekrar destende.
            </div>
          )}
        </div>
        {lab.talk?.length > 0 && (
          <div className="task-card">
            <div className="head"><span className="ico">🗣️</span><span className="name">Konuşmada bu sorular gelecek</span></div>
            {lab.talk.map((q) => (
              <div className="phrase" key={q} style={{ boxShadow: 'none', background: 'var(--bg)' }}>
                <div className="txt"><div className="en">{q}</div></div>
                <button className="speaker" onClick={() => speak(q, rate)}>🔊</button>
              </div>
            ))}
            <p className="desc">Her birine en az 2 cümleyle cevap vermeyi dene (…because…, …and…).</p>
          </div>
        )}
        <div className="btn-row">
          <button className="btn ghost" onClick={onBack}>Derse dön</button>
          <button className="btn orange" onClick={onTalk}>🗣️ Konuşmaya geç</button>
        </div>
      </div>
    )
  }

  const isTiles = i < TILE_ITEMS
  const ok = res?.verdict === 'correct'
  const close = res?.verdict === 'close'
  const wrong = res && !ok && !close
  return (
    <div className="screen">
      {header}
      <div className="progress"><i style={{ width: `${(i / items.length) * 100}%` }} /></div>
      <div className="q-prompt">
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>{isTiles ? 'Kelimeleri doğru sıraya diz' : 'İngilizcesini sesli söyle'}</div>
        <div className="word" style={{ fontSize: 22 }}>🇹🇷 {item.tr}</div>
        {!res && !isTiles && (
          <button className="hint-btn" onClick={() => setShowTip(true)}>
            {showTip ? `💡 ${item.tip || `Başlangıç: “${tilesOf(item.en[0]).slice(0, 2).join(' ')}…”`}` : '💡 İpucu'}
          </button>
        )}
      </div>

      {!res && (isTiles
        ? <Tiles key={i} item={item} rate={rate} onResult={evaluate} />
        : <AnswerInput onSubmit={(t, meta) => evaluate(t, meta)} disabled={busy} placeholder="🎙️ ile söyle ya da yaz…" />)}
      {busy && <div className="empty-note" style={{ padding: 10 }}>⏳ Kontrol ediliyor…</div>}
      {err && <div className="error-box">{err}</div>}

      {res && (
        <div className="task-card">
          <div className="heard-line">Sen: “{res.attempt}”</div>
          {res.overridden ? <div className="feedback good">✅ Doğru sayıldı (mikrofon yanlış duymuş)</div>
            : ok ? <div className="feedback good">✅ Doğru!{res.ai?.ok && canon(res.attempt) !== canon(item.en[0]) ? ' (farklı ama doğru bir cevap)' : ''}</div>
              : close ? <div className="feedback" style={{ color: 'var(--gold)' }}>🟡 Çok yakın — doğru sayıldı</div>
                : <div className="feedback bad">❌ Tam değil</div>}
          {!ok && res.diff && <WordDiff diff={res.diff} />}
          {close && <p className="desc" style={{ textAlign: 'center' }}>Kırmızı kelimeye dikkat — küçük bir kayma ya da mikrofon hatası.</p>}
          {wrong && res.ai?.noteTr && <div className="sample-box">🔧 {res.ai.noteTr}<br /><b>Senin cümlenin doğrusu:</b> {res.ai.corrected}</div>}
          <div className="phrase" style={{ boxShadow: 'none', background: 'var(--accent-soft)' }}>
            <div className="txt"><div className="en">{item.en[0]}</div>{item.tip && <div className="tr">💡 {item.tip}</div>}</div>
            <button className="speaker" onClick={() => speak(item.en[0], rate)}>🔊</button>
          </div>
          {!ok && <p className="desc">Doğrusunu <b>bir kez sesli</b> tekrar et, sonra devam.</p>}
          {wrong && res.voice && (
            <button className="btn ghost" style={{ marginBottom: 8 }} onClick={micOverride}>
              🎙️ Doğru söyledim, mikrofon yanlış duydu
            </button>
          )}
          <div className="btn-row" style={{ marginTop: 8 }}>
            {wrong && !isTiles && <button className="btn ghost" onClick={() => setRes(null)}>Tekrar dene (½ puan)</button>}
            <button className="btn primary" onClick={next}>{i + 1 >= items.length ? 'Bitir' : 'Devam →'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
