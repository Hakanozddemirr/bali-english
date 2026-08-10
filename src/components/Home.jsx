import { days } from '../content'
import { useApp, getDayState, countStreak, daysUntilTrip } from '../lib/store'

function taskFractions(content, st) {
  const isReview = content.words.length === 0
  const total = content.words.length || 1
  const fCards = st.cardsDone
    ? 1
    : isReview
      ? st.matchDone ? 1 : 0
      : (st.seen.length / total) * 0.6 + (st.matchDone ? 0.4 : 0)
  const fTalk = st.talkDone ? 1 : Math.min(1, st.talkSec / 600)
  const fQuiz = st.quizDone ? 1 : st.quizBest / 10
  return [fCards, fTalk, fQuiz]
}

export default function Home({ onOpenDay }) {
  const { state } = useApp()
  const streak = countStreak(state)
  const left = daysUntilTrip(state)
  const doneCount = days.filter((d) => getDayState(state, d.day).done).length
  const activeDay = (days.find((d) => !getDayState(state, d.day).done) || days[days.length - 1]).day

  return (
    <div className="screen">
      <header className="hero">
        <h1>Bali English 🌴</h1>
        <div className="sub">10 günde derdini anlatacak kadar İngilizce</div>
        <div className="stats">
          <div className="stat">
            <div className="big">🔥 {streak}</div>
            <div className="lbl">gün zinciri</div>
          </div>
          <div className="stat">
            <div className="big">🛫 {left >= 0 ? left : 0}</div>
            <div className="lbl">Bali'ye kalan gün</div>
          </div>
          <div className="stat">
            <div className="big">✅ {doneCount}/10</div>
            <div className="lbl">tamamlanan gün</div>
          </div>
        </div>
      </header>

      {days.map((d) => {
        const st = getDayState(state, d.day)
        const fr = taskFractions(d, st)
        const isActive = d.day === activeDay && !st.done
        return (
          <button
            key={d.day}
            className={`day-card ${isActive ? 'active' : ''} ${!st.done && !isActive ? 'locked-look' : ''}`}
            onClick={() => onOpenDay(d.day)}
          >
            <span className="emoji">{d.emoji}</span>
            <span className="info">
              <span className="t">Gün {d.day} · {d.title}</span>
              <span className="s">
                {st.done
                  ? 'Tamamlandı — harikasın!'
                  : isActive
                    ? 'Bugünün görevi — hadi başla!'
                    : `${d.words.length || 'Tekrar'} ${d.words.length ? 'yeni kelime' : 'günü'} · konuşma · sınav`}
              </span>
              <span className="task-dots">
                {fr.map((f, i) => (
                  <span key={i} className="dot"><i style={{ width: `${f * 100}%` }} /></span>
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
