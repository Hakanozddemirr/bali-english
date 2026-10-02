import { useState } from 'react'
import { useApp } from '../lib/store'
import { addCard } from '../lib/cards'
import { speak } from '../lib/tts'

const SOURCES = ['🎧 Podcast', '📱 Instagram', '🎵 Şarkı', '🎬 Video', '💬 Sohbet']

// "Yakala": gün içinde duyulan cümle/ifadeyi 5 saniyede tekrar destesine at
export default function Capture({ onBack }) {
  const { state, update } = useApp()
  const [en, setEn] = useState('')
  const [tr, setTr] = useState('')
  const [src, setSrc] = useState(SOURCES[0])
  const [msg, setMsg] = useState('')
  const recent = Object.values(state.cards).filter((c) => c.type === 'capture').sort((a, b) => (b.created > a.created ? 1 : -1)).slice(0, 15)

  const add = () => {
    if (!en.trim()) return
    update((s) => addCard(s, { type: 'capture', en, tr, src }))
    setMsg(`✅ Yakalandı: “${en.trim()}”`)
    setEn(''); setTr('')
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>🎣 Yakala</h2>
      </div>
      <div className="task-card">
        <div className="desc">Duyduğun ve <b>kendin de söylemek istediğin</b> bir cümle ya da ifade. Yarın sabah tekrarda karşına çıkar.</div>
        <div className="mode-chips" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          {SOURCES.map((s) => <button key={s} className={src === s ? 'on' : ''} onClick={() => setSrc(s)}>{s}</button>)}
        </div>
        <div className="field"><input value={en} onChange={(e) => setEn(e.target.value)} placeholder="İngilizce (ör. It's not a big deal.)" autoCapitalize="off" /></div>
        <div className="field"><input value={tr} onChange={(e) => setTr(e.target.value)} placeholder="Türkçesi (biliyorsan — önerilir)" /></div>
        <button className="btn primary" disabled={!en.trim()} onClick={add}>+ Yakala</button>
        {msg && <p className="desc" style={{ marginTop: 8 }}>{msg}</p>}
      </div>
      {recent.length > 0 && (
        <>
          <div className="section-title">Son yakaladıkların</div>
          {recent.map((c) => (
            <div className="phrase" key={c.id}>
              <div className="txt"><div className="en">{c.en}</div><div className="tr">{c.tr || '—'} · {c.src}</div></div>
              <button className="speaker" onClick={() => speak(c.en, state.settings.rate)}>🔊</button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
