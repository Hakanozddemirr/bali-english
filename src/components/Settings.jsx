import { useState } from 'react'
import { useApp, KEY, loadState } from '../lib/store'
import { todayISO } from '../lib/dates'
import { MODELS } from '../lib/claude'
import { speak } from '../lib/tts'

export default function Settings() {
  const { state, update } = useApp()
  const s = state.settings
  const [showKey, setShowKey] = useState(false)

  const setSetting = (key, value) => update((st) => { st.settings[key] = value })

  const reset = () => {
    if (window.confirm('Tüm ilerleme (kalıplar, günler, hatalar, favoriler) silinecek. Emin misin?')) {
      localStorage.removeItem(KEY)
      localStorage.removeItem('baliEnglish.v2')
      localStorage.removeItem('baliEnglish.v1')
      window.location.reload()
    }
  }

  // Yedek: API anahtarı dosyaya yazılmaz
  const exportData = () => {
    const data = { ...state, settings: { ...state.settings, apiKey: '' }, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bali-english-yedek-${todayISO()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const importData = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((txt) => {
      try {
        const data = JSON.parse(txt)
        if (!data.version || !data.settings) throw new Error('format')
        if (!window.confirm('Bu yedek mevcut ilerlemenin yerine geçecek. Devam?')) return
        data.settings.apiKey = state.settings.apiKey
        localStorage.setItem(KEY, JSON.stringify(data))
        loadState()
        window.location.reload()
      } catch { window.alert('Bu dosya geçerli bir Bali English yedeği değil.') }
    })
  }

  return (
    <div className="screen">
      <header className="hero">
        <h1>⚙️ Ayarlar</h1>
        <div className="sub">Sohbet modu, ses ve Claude bağlantısı</div>
      </header>

      <div className="section-title">Konuşma</div>
      <div className="field">
        <label>Varsayılan sohbet zorluğu</label>
        <select value={s.talkMode} onChange={(e) => setSetting('talkMode', e.target.value)}>
          <option value="guided">🐢 Guided — yavaş, ipuçlu</option>
          <option value="normal">💬 Normal — doğal gezgin İngilizcesi</option>
          <option value="realistic">⚡ Realistic — gerçek hız, sürprizli</option>
        </select>
      </div>
      <div className="field">
        <label>Okuma hızı: {s.rate.toFixed(2)}×</label>
        <input type="range" min="0.75" max="1.2" step="0.05" value={s.rate}
          onChange={(e) => setSetting('rate', Number(e.target.value))} />
        <div className="note">
          <button style={{ color: 'var(--accent)', fontWeight: 700 }}
            onClick={() => speak("How's it going? What've you been up to today?", s.rate, { accent: 'rotate' })}>
            🔊 Bu hızda dinle
          </button>
        </div>
      </div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={s.accents} onChange={(e) => setSetting('accents', e.target.checked)}
            style={{ width: 'auto' }} />
          Aksan rotasyonu (ABD / İngiliz / Avustralya sesleri)
        </label>
        <div className="note">Cihazda hangi sesler varsa onlar kullanılır; yoksa mevcut İngilizce sese düşer.</div>
      </div>

      <div className="section-title">Claude Modu (isteğe bağlı)</div>
      <div className="warn-box">
        🎁 Uygulama anahtarsız da çalışır. API anahtarı girersen: serbest sohbet, Lab cevaplarının akıllı kontrolü,
        günlük/özet düzeltmesi, 41+ dersler için otomatik Lab ve haftalık puanlama açılır.
        Anahtar yalnızca bu cihazda saklanır — kimseyle paylaşma. Anthropic Console'da anahtara <b>aylık harcama limiti</b> koy.
      </div>
      <div className="field">
        <label>Anthropic API Anahtarı</label>
        <input type={showKey ? 'text' : 'password'} value={s.apiKey}
          onChange={(e) => setSetting('apiKey', e.target.value.trim())} placeholder="sk-ant-..." autoComplete="off" />
        <div className="note">
          <button style={{ color: 'var(--accent)', fontWeight: 700 }} onClick={() => setShowKey(!showKey)}>
            {showKey ? '🙈 Gizle' : '👁️ Göster'}
          </button>
        </div>
      </div>
      <div className="field">
        <label>Model</label>
        <select value={s.model} onChange={(e) => setSetting('model', e.target.value)}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      <div className="section-title">💾 Yedek & Koç Raporu</div>
      <div className="warn-box">
        İlerleme sadece bu tarayıcıda duruyor. Haftada bir <b>yedek indir</b> — tarayıcı verisi silinirse buradan geri yüklersin.
        Aynı dosyayı Claude Code'a verirsen hatalarını ve kelimelerini <code>context/english/</code> hafızana işler.
        (API anahtarı dosyaya yazılmaz.)
      </div>
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className="btn soft" onClick={exportData}>⬇️ Yedek indir</button>
        <label className="btn ghost" style={{ cursor: 'pointer' }}>
          ⬆️ Yedek yükle
          <input type="file" accept="application/json" onChange={importData} style={{ display: 'none' }} />
        </label>
      </div>

      <div className="section-title">Seyahat</div>
      <div className="field">
        <label>Bir sonraki Bali tarihi</label>
        <input type="date" value={state.tripDate}
          onChange={(e) => e.target.value && update((st) => { st.tripDate = e.target.value })} />
      </div>

      <div className="section-title">📒 Hata Bankam ({state.mistakes.length})</div>
      {state.mistakes.length === 0 ? (
        <p className="empty-note" style={{ textAlign: 'left', padding: '0 4px 12px' }}>
          Henüz kayıtlı hata yok. Gramer drillerinde ve Claude sohbet geri bildirimlerinde otomatik birikir.
        </p>
      ) : (
        <>
          {state.mistakes.slice(0, 10).map((m, i) => (
            <div className="phrase" key={i}>
              <div className="txt">
                <div className="tr" style={{ textDecoration: 'line-through' }}>{m.orig}</div>
                <div className="en" style={{ color: 'var(--ok)' }}>{m.fix}</div>
              </div>
              <button className="speaker" onClick={() => speak(m.fix, s.rate)}>🔊</button>
            </div>
          ))}
          <button className="btn ghost" style={{ marginTop: 6 }}
            onClick={() => update((st) => { st.mistakes = [] })}>Hataları Temizle</button>
        </>
      )}

      <div className="section-title">Tehlikeli Bölge</div>
      <button className="btn danger" onClick={reset}>🗑️ Tüm İlerlemeyi Sıfırla</button>
      <p className="empty-note">Bali English v3 — Sabah Sistemi 🌴 (ders: Aksen Kahraman YouTube)</p>
    </div>
  )
}
