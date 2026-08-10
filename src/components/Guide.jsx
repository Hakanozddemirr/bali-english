import { guide } from '../content'
import { useApp } from '../lib/store'
import { speak } from '../lib/tts'

export default function Guide() {
  const { state } = useApp()
  const rate = state.settings.rate

  return (
    <div className="screen">
      <header className="hero no-print">
        <h1>📖 Cep Rehberi</h1>
        <div className="sub">
          En kritik 50 cümle — tamamen çevrimdışı çalışır. Bali'de zor anda burayı aç!
        </div>
      </header>

      <button className="btn ghost no-print" style={{ marginBottom: 16 }} onClick={() => window.print()}>
        🖨️ Yazdır / PDF olarak kaydet
      </button>

      {guide.categories.map((cat) => (
        <section className="guide-cat" key={cat.title}>
          <h3>{cat.emoji} {cat.title}</h3>
          {cat.phrases.map((p) => (
            <div className="phrase" key={p.en}>
              <div className="txt">
                <div className="en">{p.en}</div>
                <div className="tr">{p.tr}</div>
              </div>
              <button className="speaker no-print" onClick={() => speak(p.en, rate)}>🔊</button>
            </div>
          ))}
        </section>
      ))}

      <p className="empty-note no-print">
        Bu sayfa uygulamayla birlikte cihazına kaydedilir — internet olmadan da açılır. 🌴
      </p>
    </div>
  )
}
