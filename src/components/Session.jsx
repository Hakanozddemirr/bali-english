import { useState } from 'react'
import { useApp, ensureLog } from '../lib/store'
import { todayISO } from '../lib/dates'
import {
  sessions, lessonByKey, labFor, isReview, lessonLabel, ytEmbed, ytLink, fmtDur, sessionMinutes, PLAYLIST_URL,
} from '../lib/course'

const KIND = { konu: 'Konu anlatımı', alistirma: 'Alıştırmalar', tekrar: 'Tekrar videosu' }

function Video({ v, watched, onToggle }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="video-box">
      {open ? (
        <div className="yt-frame">
          <iframe src={ytEmbed(v.id)} title={v.id} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        </div>
      ) : (
        <button className="yt-thumb" onClick={() => setOpen(true)}
          style={{ backgroundImage: `url(https://i.ytimg.com/vi/${v.id}/hqdefault.jpg)` }}>
          <span className="play">▶</span>
          <span className="dur">{fmtDur(v.dur)}</span>
        </button>
      )}
      <div className="video-meta">
        <span className="kind">{KIND[v.kind] || 'Video'}</span>
        <a href={ytLink(v.id)} target="_blank" rel="noreferrer">YouTube'da aç ↗</a>
        <button className={`watch-chip ${watched ? 'on' : ''}`} onClick={onToggle}>{watched ? '✅ İzledim' : '○ İzledim'}</button>
      </div>
    </div>
  )
}

export default function Session({ idx, onBack, onLab, onSession }) {
  const { state, update } = useApp()
  const keys = sessions[idx]

  const toggleWatch = (vid) => update((s) => {
    if (s.course.watched[vid]) delete s.course.watched[vid]
    else s.course.watched[vid] = todayISO()
  })

  const finishReview = (key) => update((s) => {
    s.course.done[key] = todayISO()
    const l = ensureLog(s)
    if (!l.lessons.includes(key)) l.lessons.push(key)
  })

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>🎬 Seans {idx + 1}/{sessions.length}</h2>
        <span className="timer-chip">~{sessionMinutes(idx)} dk</span>
      </div>

      <div className="warn-box">
        💡 Videoyu <b>pasif izleme</b>: alıştırma kısmında durdur, cevabı <b>sesli</b> söyle, sonra devam et.
        Konu bitince kendi hayatından 3 cümle kur. Ardından Yapı Lab.
      </div>

      {keys.map((key) => {
        const l = lessonByKey[key]
        const lab = labFor(state, key)
        const done = !!state.course.done[key]
        const allWatched = l.videos.every((v) => state.course.watched[v.id])
        const review = isReview(l)
        return (
          <div key={key} className="task-card">
            <div className="head">
              <span className="ico">{done ? '✅' : review ? '🔄' : '📘'}</span>
              <span className="name">{lessonLabel(l)} · {l.title}</span>
            </div>
            <div className="desc">
              {l.level} · {l.videos.length} video · {l.min} dk
              {state.course.labBest[key] != null && ` · Lab en iyi: %${state.course.labBest[key]}`}
            </div>
            {lab?.focusTr && (
              <div className="sample-box">
                <b>🎯 Konuşmak için tek kural:</b> {lab.focusTr}
                {lab.pattern && <div className="pattern">{lab.pattern}</div>}
              </div>
            )}
            {l.videos.map((v) => (
              <Video key={v.id} v={v} watched={!!state.course.watched[v.id]} onToggle={() => toggleWatch(v.id)} />
            ))}
            {review ? (
              <button className={`btn ${done ? 'ghost' : 'primary'}`} onClick={() => finishReview(key)} disabled={done}>
                {done ? '✅ Tamamlandı' : 'Tekrarı bitirdim'}
              </button>
            ) : (
              <>
                <button className={`btn ${allWatched && !done ? 'primary' : 'soft'}`} onClick={() => onLab(key)}>
                  🧪 {done ? 'Yapı Lab — tekrar çöz' : 'Yapı Lab — cümle kur'}
                </button>
                {!allWatched && !done && (
                  <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => onLab(key, { skip: true })}>
                    Bu konuyu biliyorum → Lab ile kanıtla
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}

      <div className="btn-row">
        <button className="btn ghost" disabled={idx === 0} onClick={() => onSession(idx - 1)}>← Önceki</button>
        <button className="btn ghost" disabled={idx >= sessions.length - 1} onClick={() => onSession(idx + 1)}>Sonraki →</button>
      </div>
      <p className="empty-note">
        Kaynak: <a href={PLAYLIST_URL} target="_blank" rel="noreferrer">Aksen Kahraman — YouTube oynatma listesi</a>
      </p>
    </div>
  )
}
