import { getDay } from '../content'
import { useApp, getDayState } from '../lib/store'

function fmtMin(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function DayScreen({ day, onBack, onOpen }) {
  const { state } = useApp()
  const content = getDay(day)
  const st = getDayState(state, day)
  const isReview = content.words.length === 0
  const total = content.words.length || 1
  const cardsPct = st.cardsDone
    ? 100
    : isReview
      ? (st.matchDone ? 100 : 0)
      : Math.round(((st.seen.length / total) * 0.6 + (st.matchDone ? 0.4 : 0)) * 100)
  const talkPct = Math.min(100, Math.round((st.talkSec / 600) * 100))
  const quizPct = st.quizDone ? 100 : st.quizBest * 10

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>{content.emoji} Gün {day} · {content.title}</h2>
      </div>

      {st.done && (
        <div className="task-card" style={{ background: 'var(--ok-soft)', textAlign: 'center' }}>
          <b>🎉 Bu gün tamamlandı!</b>
          <div className="desc" style={{ marginBottom: 0, marginTop: 4 }}>
            İstediğin bölümü tekrar çalışabilirsin.
          </div>
        </div>
      )}

      <div className="task-card">
        <div className="head">
          <span className="ico">🃏</span>
          <span className="name">Kelime Kartları</span>
          <span className="st">{st.cardsDone ? '✅' : '○'}</span>
        </div>
        <div className="desc">
          {isReview
            ? 'Tekrar günü: en zorlandığın kartlarla eşleştirme yap.'
            : `${content.words.length} yeni kelimeyi öğren, sonra eşleştirme turunu bitir.`}
        </div>
        <div className="progress"><i style={{ width: `${cardsPct}%` }} /></div>
        <button className="btn primary" onClick={() => onOpen('cards')}>
          {st.cardsDone ? 'Tekrar Çalış' : 'Kartlara Başla'}
        </button>
      </div>

      <div className="task-card">
        <div className="head">
          <span className="ico">🗣️</span>
          <span className="name">Sesli Pratik: {content.scenario.title}</span>
          <span className="st">{st.talkDone ? '✅' : '○'}</span>
        </div>
        <div className="desc">
          Claude ile senaryoyu canlandır — en az 10 dakika. ({fmtMin(Math.min(st.talkSec, 600))} / 10:00)
        </div>
        <div className="progress"><i style={{ width: `${talkPct}%` }} /></div>
        <button className="btn orange" onClick={() => onOpen('talk')}>
          {st.talkDone ? 'Yine Konuş' : 'Konuşmaya Başla'}
        </button>
      </div>

      <div className="task-card">
        <div className="head">
          <span className="ico">📝</span>
          <span className="name">Mini Sınav</span>
          <span className="st">{st.quizDone ? '✅' : '○'}</span>
        </div>
        <div className="desc">
          10 soru; geçmek için en az 8 doğru gerekir.
          {st.quizBest > 0 && ` En iyi skorun: ${st.quizBest}/10.`}
        </div>
        <div className="progress gold"><i style={{ width: `${quizPct}%` }} /></div>
        <button className="btn soft" onClick={() => onOpen('quiz')}>
          {st.quizDone ? 'Tekrar Çöz' : 'Sınava Gir'}
        </button>
      </div>

      <div className="section-title">Ekstra çalışma (görev değil)</div>
      <div className="task-card">
        <div className="head">
          <span className="ico">🎙️</span>
          <span className="name">Telaffuz Kontrolü</span>
        </div>
        <div className="desc">Günün hedef cümlelerini dinle ve mikrofona söyleyerek kendini test et.</div>
        <button className="btn ghost" onClick={() => onOpen('pron')}>Telaffuz Çalış</button>
      </div>
    </div>
  )
}
