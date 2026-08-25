import { freetalk } from '../content'
import { useApp } from '../lib/store'

export default function FreeTalkHub({ onOpen }) {
  const { state } = useApp()
  const hasKey = !!state.settings.apiKey

  return (
    <div className="screen">
      <header className="hero">
        <h1>🗣️ Free Talk</h1>
        <div className="sub">
          Bir bağlam seç, en az 5 dakika konuş. {hasKey ? 'Claude gerçek bir gezgin gibi sohbet edecek.' : 'Yerleşik mod: ücretsiz ve çevrimdışı. API anahtarıyla tamamen serbest sohbete döner.'}
        </div>
      </header>
      <div className="ctx-grid">
        {freetalk.contexts.map((c) => (
          <button key={c.id} className="ctx-card" onClick={() => onOpen(c.id)}>
            <span className="e">{c.emoji}</span>
            <span className="t">{c.title}</span>
          </button>
        ))}
      </div>
      <p className="empty-note">Her açılışta farklı bir gezgin denk gelir — aynı sohbet iki kez olmaz.</p>
    </div>
  )
}
