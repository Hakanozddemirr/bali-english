import { getDay } from '../content'
import { useApp, getDayState } from '../lib/store'

function fmtMin(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function DayScreen({ day, onBack, onOpen }) {
  const { state } = useApp()
  const content = getDay(day)
  const st = getDayState(state, day)
  const isFinal = !content.chunks.length
  const total = content.chunks.length || 1
  const chunksPct = st.chunksDone ? 100 : Math.round(((st.seen.length / total) * 0.7 + (st.drillDone ? 0.3 : 0)) * 100)
  const talkPct = Math.min(100, Math.round((st.talkSec / 600) * 100))
  const quizPct = st.quizDone ? 100 : st.quizBest * 10
  const practicePct = st.practice.total ? Math.round((st.practice.done / st.practice.total) * 100) : 0

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>{content.emoji} Gün {day} · {content.title}</h2>
      </div>
      <p className="empty-note" style={{ textAlign: 'left', padding: '0 4px 12px' }}>{content.goalTr}</p>

      {st.done && (
        <div className="task-card" style={{ background: 'var(--ok-soft)', textAlign: 'center' }}>
          <b>🎉 Bu gün tamamlandı!</b>
        </div>
      )}

      {!isFinal && (
        <div className="task-card">
          <div className="head"><span className="ico">💬</span><span className="name">1 · Günün Kalıpları</span><span className="st">{st.chunksDone ? '✅' : '○'}</span></div>
          <div className="desc">{content.chunks.length} kalıbı öğren, sonra üretim drilliyle pekiştir. Bildiklerini "Biliyorum" ile geç.</div>
          <div className="progress"><i style={{ width: `${chunksPct}%` }} /></div>
          <button className="btn primary" onClick={() => onOpen('chunks')}>{st.chunksDone ? 'Tekrar Çalış' : 'Başla'}</button>
        </div>
      )}

      <div className="task-card">
        <div className="head"><span className="ico">⚡</span><span className="name">{isFinal ? '1 · Hızlı Tur' : '2 · Pratik'}</span>
          <span className="st" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{st.practice.total ? `${st.practice.done}/${st.practice.total}` : 'opsiyonel'}</span></div>
        <div className="desc">Hızlı Cevap ⚡ + Tepki & Takip + REACT→ADD→ASK + mikro gramer + dinleme.</div>
        {st.practice.total > 0 && <div className="progress gold"><i style={{ width: `${practicePct}%` }} /></div>}
        <button className="btn soft" onClick={() => onOpen('practice')}>Pratiğe Gir</button>
      </div>

      <div className="task-card">
        <div className="head"><span className="ico">🗣️</span><span className="name">{isFinal ? '2 · Simülasyonlar' : '3 · Konuşma'}</span><span className="st">{st.talkDone ? '✅' : '○'}</span></div>
        <div className="desc">
          {isFinal
            ? `10 gerçekçi mini senaryo — toplam 10 dakika konuş. (${fmtMin(Math.min(st.talkSec, 600))} / 10:00)`
            : `${content.scenario.title} — en az 10 dakika. (${fmtMin(Math.min(st.talkSec, 600))} / 10:00)`}
        </div>
        <div className="progress"><i style={{ width: `${talkPct}%` }} /></div>
        {isFinal ? (
          <div className="sim-grid">
            {content.sims.map((s) => (
              <button key={s.id} className={`btn ghost sim-btn ${st.simsDone.includes(s.id) ? 'done' : ''}`}
                onClick={() => onOpen('talk', { simId: s.id })}>
                {st.simsDone.includes(s.id) ? '✅ ' : ''}{s.title}
              </button>
            ))}
            <button className="btn orange" onClick={() => onOpen('talk')}>🎬 {content.scenario.title}</button>
          </div>
        ) : (
          <button className="btn orange" onClick={() => onOpen('talk')}>{st.talkDone ? 'Yine Konuş' : 'Konuşmaya Başla'}</button>
        )}
      </div>

      <div className="task-card">
        <div className="head"><span className="ico">📝</span><span className="name">{isFinal ? '3 · Final Testi' : '4 · Mini Test'}</span><span className="st">{st.quizDone ? '✅' : '○'}</span></div>
        <div className="desc">10 soru — çoğu KONUŞARAK. Geçmek için 7+. {st.quizBest > 0 && `En iyi: ${st.quizBest}/10.`}</div>
        <div className="progress gold"><i style={{ width: `${quizPct}%` }} /></div>
        <button className="btn soft" onClick={() => onOpen('quiz')}>{st.quizDone ? 'Tekrar Çöz' : 'Teste Gir'}</button>
      </div>

      {!isFinal && (
        <>
          <div className="section-title">Ekstra (görev değil)</div>
          <div className="task-card">
            <div className="head"><span className="ico">🎙️</span><span className="name">Konuşma Netliği & Gölgeleme</span></div>
            <div className="desc">Cümleyi dinle, tekrar et — tanıma motoru seni anlıyor mu gör. Hız kademeli artar.</div>
            <button className="btn ghost" onClick={() => onOpen('clarity')}>Netlik Çalış</button>
          </div>
        </>
      )}
    </div>
  )
}
