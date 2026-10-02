import { useApp, ensureLog, getLog } from '../lib/store'
import { todayISO } from '../lib/dates'
import { todayFocus } from '../lib/course'
import CoachText from './CoachText'

export default function Journal({ onBack }) {
  const { state, update } = useApp()
  const log = getLog(state)
  const focus = todayFocus(state, log.lessons)

  const save = (text) => update((s) => {
    ensureLog(s).journal = true
    s.journal.unshift({ date: todayISO(), text })
    s.journal = s.journal.slice(0, 120)
  })

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>✍️ Today I…</h2>
        <span className="timer-chip">~5 dk</span>
      </div>
      <div className="task-card">
        <div className="desc">
          Bugünü (ya da dünü) en az <b>3 cümleyle</b> anlat. Önce <b>sesli söyle</b>, sonra gönder.
          Mümkünse bugünkü yapıyı kullan: <b>{focus.pattern}</b>
        </div>
        <div className="sample-box">
          Kalıplar: <i>Today I… · This morning I… · Yesterday I went to… · I want to… because… · Tomorrow I'm going to…</i>
        </div>
        <CoachText
          task={`Daily journal (3+ sentences about his day). Today's grammar focus: ${focus.pattern}.`}
          placeholder="Today I woke up at… I had… because…"
          minWords={15}
          doneLabel={log.journal ? '✅ Bugünün kaydı alındı' : null}
          onDone={save}
        />
      </div>
      {state.journal.length > 0 && (
        <>
          <div className="section-title">Önceki günler</div>
          {state.journal.slice(0, 7).map((j, i) => (
            <div className="task-card" key={i}>
              <div className="desc" style={{ marginBottom: 4 }}><b>{j.date}</b></div>
              <div style={{ fontSize: 15 }}>{j.text}</div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
