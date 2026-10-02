import { useApp } from '../lib/store'
import { sessions, lessonByKey, nextSessionIdx, sessionDone, sessionMinutes, lessonLabel, courseProgress, PLAYLIST_URL, LAB } from '../lib/course'

export default function Courses({ go }) {
  const { state } = useApp()
  const cur = nextSessionIdx(state)
  const cp = courseProgress(state)
  const left = sessions.length - sessions.filter((_, i) => sessionDone(state, i)).length

  return (
    <div className="screen">
      <header className="hero">
        <h1>🎬 Dersler</h1>
        <div className="sub">Aksen Kahraman · {sessions.length} günlük seans. Kısa dersler aynı güne birleştirildi (video ≤ ~28 dk).</div>
        <div className="stats">
          <div className="stat"><div className="big">{cp.done}/{cp.total}</div><div className="lbl">ders</div></div>
          <div className="stat"><div className="big">%{cp.pct}</div><div className="lbl">ilerleme</div></div>
          <div className="stat"><div className="big">{left}</div><div className="lbl">seans kaldı</div></div>
        </div>
      </header>
      {sessions.map((keys, i) => {
        const done = sessionDone(state, i)
        const ls = keys.map((k) => lessonByKey[k])
        return (
          <button key={i} className={`day-card ${i === cur ? 'active' : ''} ${done ? '' : i > cur ? 'locked-look' : ''}`}
            onClick={() => go('session', { idx: i })}>
            <span className="emoji" style={{ fontSize: 20, fontWeight: 800 }}>{i + 1}</span>
            <span className="info">
              {ls.map((l) => (
                <span className="t" key={l.key} style={{ fontSize: 15 }}>
                  {state.course.done[l.key] ? '✅ ' : ''}{lessonLabel(l)} · {l.title}{LAB[l.key] ? ' 🧪' : ''}
                </span>
              ))}
              <span className="s">{ls[0].level} · ~{sessionMinutes(i)} dk video</span>
            </span>
            <span className="check">{done ? '✅' : '›'}</span>
          </button>
        )
      })}
      <p className="empty-note">🧪 = hazır Yapı Lab içeriği var. Diğerleri API anahtarıyla otomatik hazırlanır.<br />
        <a href={PLAYLIST_URL} target="_blank" rel="noreferrer">Oynatma listesini YouTube'da aç ↗</a></p>
    </div>
  )
}
