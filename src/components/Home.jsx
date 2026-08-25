import { days, TOTAL_DAYS } from '../content'
import { useApp, getDayState, daysUntilTrip, activeDayNum, readiness } from '../lib/store'

export default function Home({ onOpenDay, onCalib }) {
  const { state } = useApp()
  const left = daysUntilTrip(state)
  const doneCount = days.filter((d) => getDayState(state, d.day).done).length
  const active = activeDayNum(state, TOTAL_DAYS)
  const r = readiness(state, TOTAL_DAYS)
  const showCalib = !state.calib.done && !state.calib.skipped

  return (
    <div className="screen">
      <header className="hero">
        <h1>Bali English 🌴</h1>
        <div className="sub">7 günlük sosyal akıcılık sprinti — hedef: gerçek sohbet</div>
        <div className="stats">
          <div className="stat">
            <div className="big">🛫 {left >= 0 ? left : 0}</div>
            <div className="lbl">Bali'ye kalan gün</div>
          </div>
          <div className="stat">
            <div className="big">✅ {doneCount}/7</div>
            <div className="lbl">tamamlanan gün</div>
          </div>
          <div className="stat">
            <div className="big">🗣️ {state.stats.speak}</div>
            <div className="lbl">konuşma denemesi</div>
          </div>
        </div>
      </header>

      {showCalib && (
        <button className="day-card active" onClick={onCalib}>
          <span className="emoji">🎯</span>
          <span className="info">
            <span className="t">Hızlı Seviye Ayarı (3 dk)</span>
            <span className="s">Zaten bildiklerini işaretle — kolay kartlarla vakit kaybetme.</span>
          </span>
          <span className="check">›</span>
        </button>
      )}

      <div className="ready-panel">
        <div className="section-title" style={{ margin: '0 0 8px' }}>Bali'ye Hazırlık (pratik tahmin)</div>
        {[['Konuşma', r.speak], ['Dinleme', r.listening], ['Sosyal sohbet', r.social], ['Pratik İngilizce', r.practical]].map(
          ([lbl, v]) => (
            <div className="ready-row" key={lbl}>
              <span className="lbl">{lbl}</span>
              <span className="bar"><i style={{ width: `${v}%` }} /></span>
              <span className="val">%{v}</span>
            </div>
          ),
        )}
      </div>

      {days.map((d) => {
        const st = getDayState(state, d.day)
        const isActive = d.day === active && !st.done
        const fr = [
          st.chunksDone ? 1 : (st.seen.length / Math.max(1, d.chunks.length)) * 0.7 + (st.drillDone ? 0.3 : 0),
          st.talkDone ? 1 : Math.min(1, st.talkSec / 600),
          st.quizDone ? 1 : st.quizBest / 10,
        ]
        return (
          <button
            key={d.day}
            className={`day-card ${isActive ? 'active' : ''} ${!st.done && !isActive ? 'locked-look' : ''}`}
            onClick={() => onOpenDay(d.day)}
          >
            <span className="emoji">{d.emoji}</span>
            <span className="info">
              <span className="t">Gün {d.day} · {d.title}</span>
              <span className="s">{st.done ? 'Tamamlandı — bir adım daha yaklaştın!' : d.goalTr}</span>
              <span className="task-dots">
                {fr.map((f, i) => (
                  <span key={i} className="dot"><i style={{ width: `${Math.round(f * 100)}%` }} /></span>
                ))}
              </span>
            </span>
            <span className="check">{st.done ? '✅' : '›'}</span>
          </button>
        )
      })}
    </div>
  )
}
