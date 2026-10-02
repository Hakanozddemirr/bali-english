import { useApp, getLog, dayStatus, streak, bestStreak, MIN_TALK, FULL_TALK } from '../lib/store'
import { todayISO, addDays } from '../lib/dates'
import { dueCards, learnedCount } from '../lib/cards'
import { sessions, nextSessionIdx, lessonByKey, sessionMinutes, courseProgress, lessonLabel } from '../lib/course'

const fmtMin = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

function Heatmap({ state }) {
  // Son 4 hafta, pazartesiden başlayarak
  const today = todayISO()
  const dow = (new Date(today + 'T12:00:00').getDay() + 6) % 7
  const start = addDays(today, -dow - 21)
  const cells = Array.from({ length: 28 }, (_, i) => {
    const iso = addDays(start, i)
    const st = state.log[iso] ? dayStatus(getLog(state, iso)) : null
    return { iso, st, future: iso > today, today: iso === today }
  })
  return (
    <div className="heatmap">
      {WEEKDAYS.map((w) => <span key={w} className="hm-lbl">{w}</span>)}
      {cells.map((c) => (
        <span key={c.iso} title={c.iso}
          className={`hm-cell ${c.st || ''} ${c.future ? 'future' : ''} ${c.today ? 'today' : ''}`} />
      ))}
    </div>
  )
}

export default function Today({ go }) {
  const { state } = useApp()
  const log = getLog(state)
  const status = dayStatus(log)
  const s = streak(state)
  const due = dueCards(state).length
  const sIdx = nextSessionIdx(state)
  const sess = sessions[sIdx].map((k) => lessonByKey[k])
  const cp = courseProgress(state)
  const lessonStepDone = log.lessons.length > 0

  const steps = [
    {
      id: 'review', ico: '🔁', name: 'Tekrar', min: 5, done: log.review,
      desc: due ? `${due} kart tekrar zamanında — kelimeler, hataların, Lab cümleleri.` : 'Bugün vadesi gelen kart yok. Yine de 2 dk hızlı tur at.',
      action: () => go('review'), btn: log.review ? 'Tekrar Et' : 'Başla',
    },
    {
      id: 'lesson', ico: '🎬', name: 'Ders + Yapı Lab', min: 25, done: lessonStepDone,
      desc: `${sess.map((l) => `${lessonLabel(l)}: ${l.title}`).join(' · ')} — video ~${sessionMinutes(sIdx)} dk, sonra cümle kurma.`,
      action: () => go('session', { idx: sIdx }), btn: lessonStepDone ? 'Derse Dön' : 'Derse Git',
    },
    {
      id: 'book', ico: '📚', name: 'Kitap', min: 15, done: log.book,
      desc: `Okuma #${Math.min(50, state.book.reading + 1)} + Bulmaca bloğu #${Math.min(50, state.book.puzzle + 1)} → sesli özet + en fazla 5 kelime.`,
      action: () => go('book'), btn: log.book ? 'Kitaba Dön' : 'Başla',
    },
    {
      id: 'talk', ico: '🗣️', name: 'Konuşma', min: 10, done: log.talkSec >= FULL_TALK,
      desc: `Bugünkü yapıyı ve kelimeleri kullanacağın sohbet. ${fmtMin(Math.min(log.talkSec, FULL_TALK))} / 10:00`,
      pct: Math.min(100, Math.round((log.talkSec / FULL_TALK) * 100)),
      action: () => go('dailytalk'), btn: log.talkSec ? 'Devam Et' : 'Konuş',
    },
    {
      id: 'journal', ico: '✍️', name: 'Kapanış: Today I…', min: 5, done: log.journal,
      desc: 'Bugünü 3 cümleyle İngilizce anlat. Hatalar tekrar destene düşer.',
      action: () => go('journal'), btn: log.journal ? 'Tekrar Yaz' : 'Yaz',
    },
  ]
  const doneCount = steps.filter((x) => x.done).length
  const nextStep = steps.find((x) => !x.done)

  return (
    <div className="screen">
      <header className="hero">
        <h1>Günaydın Hakan ☀️</h1>
        <div className="sub">
          {status === 'full' ? 'Bugün tam gün — harika iş. 🎉'
            : status === 'min' ? 'Minimum gün tamam, seri korundu. Vaktin varsa devam et.'
              : 'Sabah 1 saat: tekrar → ders → kitap → konuşma → kapanış.'}
        </div>
        <div className="stats">
          <div className="stat">
            <div className="big">🔥 {s}</div>
            <div className="lbl">gün seri (en iyi {Math.max(s, bestStreak(state))})</div>
          </div>
          <div className="stat">
            <div className="big">✅ {doneCount}/5</div>
            <div className="lbl">bugünkü adım</div>
          </div>
          <div className="stat">
            <div className="big">🎓 {cp.done}</div>
            <div className="lbl">/ {cp.total} ders</div>
          </div>
        </div>
      </header>

      {nextStep && (
        <button className="btn primary" style={{ marginBottom: 14 }} onClick={nextStep.action}>
          ▶ Sıradaki: {nextStep.name}
        </button>
      )}

      {steps.map((st, i) => (
        <div key={st.id} className={`task-card step ${st.done ? 'done' : ''}`}>
          <div className="head">
            <span className="ico">{st.ico}</span>
            <span className="name">{i + 1} · {st.name}</span>
            <span className="min-chip">~{st.min} dk</span>
            <span className="st">{st.done ? '✅' : '○'}</span>
          </div>
          <div className="desc">{st.desc}</div>
          {st.pct != null && <div className="progress"><i style={{ width: `${st.pct}%` }} /></div>}
          <button className={`btn ${st.done ? 'ghost' : 'soft'}`} onClick={st.action}>{st.btn}</button>
        </div>
      ))}

      {!['full', 'min'].includes(status) && (
        <div className="task-card min-card">
          <div className="head"><span className="ico">🪫</span><span className="name">Kötü gün mü? Minimum yap.</span></div>
          <div className="desc">
            Sadece <b>Tekrar</b> + <b>{MIN_TALK / 60} dk Konuşma</b> (~10 dk). Seri bozulmaz. Kural: iki gün üst üste kaçırma yok.
          </div>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => go('review')}>{log.review ? '✅ Tekrar' : '1 · Tekrar'}</button>
            <button className="btn ghost" onClick={() => go('dailytalk')}>
              {log.talkSec >= MIN_TALK ? '✅ Konuşma' : `2 · Konuş (${fmtMin(Math.min(log.talkSec, MIN_TALK))}/5:00)`}
            </button>
          </div>
        </div>
      )}

      <div className="section-title">Son 4 hafta</div>
      <div className="task-card">
        <Heatmap state={state} />
        <div className="hm-legend">
          <span><i className="hm-cell full" /> tam</span>
          <span><i className="hm-cell min" /> minimum</span>
          <span><i className="hm-cell partial" /> yarım</span>
          <span><i className="hm-cell" /> yok</span>
        </div>
      </div>

      <div className="section-title">Ekstra</div>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <button className="btn ghost" onClick={() => go('capture')}>🎣 Yakala</button>
        <button className="btn ghost" onClick={() => go('weekly')}>📈 Haftalık Kontrol</button>
      </div>
      <p className="empty-note" style={{ padding: '8px 10px' }}>
        {learnedCount(state)} kart kalıcı hafızada (7+ gün aralık). Podcast/Instagram/şarkıda duyduğun cümleyi 🎣 Yakala ile ekle.
      </p>
    </div>
  )
}
