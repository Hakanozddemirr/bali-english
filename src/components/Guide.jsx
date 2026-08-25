import { useMemo, useState } from 'react'
import { guide } from '../content'
import { useApp } from '../lib/store'
import { speak } from '../lib/tts'
import { normalize } from '../lib/similarity'

export default function Guide() {
  const { state, update } = useApp()
  const rate = state.settings.rate
  const [query, setQuery] = useState('')

  const favs = state.favs
  const toggleFav = (id) =>
    update((s) => {
      if (s.favs[id]) delete s.favs[id]
      else s.favs[id] = true
    })

  const q = normalize(query)
  const filtered = useMemo(() => {
    if (!q) return guide.categories
    return guide.categories
      .map((cat) => ({
        ...cat,
        phrases: cat.phrases.filter(
          (p) => normalize(p.en).includes(q) || p.tr.toLowerCase().includes(query.toLowerCase()),
        ),
      }))
      .filter((cat) => cat.phrases.length)
  }, [q, query])

  const favList = guide.categories.flatMap((c) => c.phrases).filter((p) => favs[p.id])

  const Phrase = ({ p }) => (
    <div className="phrase">
      <button className={`fav-btn ${favs[p.id] ? 'on' : ''}`} onClick={() => toggleFav(p.id)}>
        {favs[p.id] ? '⭐' : '☆'}
      </button>
      <div className="txt">
        <div className="en">{p.en}</div>
        <div className="tr">{p.tr}</div>
      </div>
      <button className="speaker no-print" onClick={() => speak(p.en, rate, { accent: 'rotate' })}>🔊</button>
    </div>
  )

  return (
    <div className="screen">
      <header className="hero no-print">
        <h1>📖 Cep Rehberi</h1>
        <div className="sub">Sosyal + pratik {guide.categories.reduce((a, c) => a + c.phrases.length, 0)} kalıp — tamamen çevrimdışı. Sık kullanacaklarını ⭐'la.</div>
      </header>

      <input
        className="search-box no-print"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 Ara: örn. bill, katıl, yavaş…"
      />
      <button className="btn ghost no-print" style={{ margin: '10px 0 16px' }} onClick={() => window.print()}>
        🖨️ Yazdır / PDF olarak kaydet
      </button>

      {!q && favList.length > 0 && (
        <section className="guide-cat">
          <h3>⭐ Favorilerim</h3>
          {favList.map((p) => <Phrase key={p.id} p={p} />)}
        </section>
      )}

      {filtered.map((cat) => (
        <section className="guide-cat" key={cat.title}>
          <h3>{cat.emoji} {cat.title}</h3>
          {cat.phrases.map((p) => <Phrase key={p.id} p={p} />)}
        </section>
      ))}
      {q && !filtered.length && <p className="empty-note">“{query}” için sonuç yok.</p>}
    </div>
  )
}
