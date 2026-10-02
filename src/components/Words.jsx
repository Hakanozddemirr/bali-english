import { useState } from 'react'
import { useApp } from '../lib/store'
import { dueCards, CARD_TYPES, CARD_INTERVALS, MAX_BOX } from '../lib/cards'
import { speak } from '../lib/tts'

export default function Words({ go }) {
  const { state, update } = useApp()
  const [filter, setFilter] = useState('all')
  const all = Object.values(state.cards)
  const list = all
    .filter((c) => filter === 'all' || c.type === filter)
    .sort((a, b) => (a.due > b.due ? 1 : -1))
  const due = dueCards(state).length

  const remove = (id) => update((s) => { delete s.cards[id] })

  return (
    <div className="screen">
      <header className="hero">
        <h1>📗 Kelimelerim</h1>
        <div className="sub">Kitaptan seçtiklerin, hataların, Lab cümlelerin ve yakaladıkların — hepsi tek destede.</div>
        <div className="stats">
          <div className="stat"><div className="big">{all.length}</div><div className="lbl">kart</div></div>
          <div className="stat"><div className="big">{due}</div><div className="lbl">bugün vadeli</div></div>
          <div className="stat"><div className="big">{all.filter((c) => c.box >= 3).length}</div><div className="lbl">kalıcı (7+ gün)</div></div>
        </div>
      </header>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={() => go('review')}>🔁 Tekrar ({due})</button>
        <button className="btn ghost" onClick={() => go('capture')}>🎣 Yakala</button>
      </div>
      <button className="btn soft" style={{ marginBottom: 14 }} onClick={() => go('guide')}>📖 Bali Cep Rehberi (126 kalıp)</button>

      <div className="mode-chips" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Hepsi</button>
        {Object.entries(CARD_TYPES).map(([k, v]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{v.icon} {v.label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="empty-note">Henüz kart yok. Kitaptan günde en fazla 5 kelime ekle; Lab ve konuşmadaki hatalar kendiliğinden gelir.</p>
      ) : list.map((c) => (
        <div className="phrase" key={c.id}>
          <div className="txt">
            <div className="en">{CARD_TYPES[c.type]?.icon} {c.en}</div>
            <div className="tr">
              {c.type === 'mistake' ? `❌ ${c.ex}` : c.tr || '—'} · {c.box >= MAX_BOX ? 'ustalaştı' : c.box === 0 ? 'yeni' : `${CARD_INTERVALS[c.box]} günlük aralık`} · {c.due}
            </div>
          </div>
          <button className="speaker" onClick={() => speak(c.en, state.settings.rate)}>🔊</button>
          <button className="del-btn" onClick={() => remove(c.id)} title="Sil">✕</button>
        </div>
      ))}
    </div>
  )
}
