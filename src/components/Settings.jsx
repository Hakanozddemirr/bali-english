import { useState } from 'react'
import { useApp } from '../lib/store'
import { MODELS } from '../lib/claude'
import { speak } from '../lib/tts'

export default function Settings() {
  const { state, update } = useApp()
  const s = state.settings
  const [showKey, setShowKey] = useState(false)

  const setSetting = (key, value) => update((st) => { st.settings[key] = value })

  const reset = () => {
    if (
      window.confirm(
        'Tüm ilerlemen (kartlar, günler, skorlar) silinecek. API anahtarın da silinir. Emin misin?',
      )
    ) {
      localStorage.removeItem('baliEnglish.v1')
      window.location.reload()
    }
  }

  return (
    <div className="screen">
      <header className="hero">
        <h1>⚙️ Ayarlar</h1>
        <div className="sub">Sesli asistan ve uygulama tercihleri</div>
      </header>

      <div className="section-title">Sesli Asistan (Claude)</div>
      <div className="warn-box">
        🔑 API anahtarın <b>yalnızca bu cihazda</b> (tarayıcı hafızasında) saklanır, hiçbir yere
        gönderilmez. Yine de anahtarını <b>kimseyle paylaşma</b>. Anahtar almak için:
        console.anthropic.com → API Keys
      </div>
      <div className="field">
        <label>Anthropic API Anahtarı</label>
        <input
          type={showKey ? 'text' : 'password'}
          value={s.apiKey}
          onChange={(e) => setSetting('apiKey', e.target.value.trim())}
          placeholder="sk-ant-..."
          autoComplete="off"
        />
        <div className="note">
          <button
            style={{ color: 'var(--accent)', fontWeight: 700 }}
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? '🙈 Gizle' : '👁️ Göster'}
          </button>
          {'  '}· Sesli asistan dışındaki tüm bölümler anahtarsız ve çevrimdışı çalışır.
        </div>
      </div>
      <div className="field">
        <label>Model</label>
        <select value={s.model} onChange={(e) => setSetting('model', e.target.value)}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="section-title">Seyahat</div>
      <div className="field">
        <label>Bali'ye uçuş tarihi (geri sayım için)</label>
        <input
          type="date"
          value={state.tripDate}
          onChange={(e) => e.target.value && update((st) => { st.tripDate = e.target.value })}
        />
      </div>

      <div className="section-title">Ses</div>
      <div className="field">
        <label>Okuma hızı: {s.rate.toFixed(2)}×</label>
        <input
          type="range"
          min="0.6"
          max="1.1"
          step="0.05"
          value={s.rate}
          onChange={(e) => setSetting('rate', Number(e.target.value))}
        />
        <div className="note">
          <button
            style={{ color: 'var(--accent)', fontWeight: 700 }}
            onClick={() => speak('Hello! Welcome to Bali!', s.rate)}
          >
            🔊 Bu hızda dinle
          </button>
          {'  '}· Başlangıç için 0.85–0.90 idealdir.
        </div>
      </div>

      <div className="section-title">Tehlikeli Bölge</div>
      <button className="btn danger" onClick={reset}>🗑️ Tüm İlerlemeyi Sıfırla</button>

      <p className="empty-note">
        Bali English v1 · Tüm veriler cihazında saklanır · İyi tatiller! 🌴
      </p>
    </div>
  )
}
