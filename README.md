# Bali English 🌴

10 günde Bali için hayatta kalma İngilizcesi — kişisel, yerel çalışan PWA.

## Çalıştırma

```bash
npm install        # ilk kurulumda
npm run dev        # geliştirme: http://localhost:5173
npm run build      # üretim derlemesi (dist/)
npm run preview    # derlenmiş hali çalıştır: http://localhost:4173
```

Telefona kurmak için: uygulamayı telefonun tarayıcısında aç (aynı Wi-Fi'da
`npm run preview -- --host` ile bilgisayarın IP'sinden erişebilirsin) →
tarayıcı menüsünden **"Ana Ekrana Ekle"**. Sesli asistan hariç her şey
çevrimdışı çalışır.

## Yayınlanan sürüm (telefon linki)

Uygulama claude.ai Artifact olarak yayında:
https://claude.ai/code/artifact/316fc6a2-2a36-4bae-96f9-b5b0de04a0e9

- Varsayılan olarak özeldir; yalnızca Claude hesabınla açılır.
- Sesli asistan bu linkte çalışmaz (sayfa dış API'ye bağlanamaz); diğer her şey çalışır.
- Güncellemek için: `npm run build:artifact` → bu sohbetten `dist/bali-artifact.html`
  aynı yoldan yeniden yayınlanır (URL değişmez).

## İçeriği düzenleme

Tüm müfredat `src/content/` içinde düz JSON:

- `day1.json` … `day10.json` — günün kelimeleri (`en` + `v` görsel/emoji),
  hedef cümleleri, senaryosu ve sınav soruları.
  **Sınav sorularında doğru cevap her zaman `options[0]`'dır** (ekranda karıştırılır).
- `guide.json` — cep rehberindeki 50 cümle (tek Türkçe çeviri içeren yer).

JSON'u değiştir → sayfayı yenile, yeterli.

## Kelime fotoğrafları

- `src/assets/photos/{slug}.jpg|png` varsa kart o fotoğrafı gösterir; yoksa emoji.
  (slug = kelimenin küçük harfli hali, boşluklar `-`: "air conditioning" →
  `air-conditioning.jpg`)
- 94 fotoğraf `node scripts/fetchPhotos.mjs` ile Wikipedia/Wikimedia Commons'tan
  indirildi (çoğu CC lisanslı; kişisel kullanım). Betik idempotenttir — dosyayı
  silip alternatif makale adı ekleyerek fotoğrafı değiştirebilirsin.
- Soyut kelimeler (evet/hayır, renkler, oklar, sayılar, duygular) bilerek emoji.

## Sesli asistan

Ayarlar ekranından Anthropic API anahtarı girilir (console.anthropic.com →
API Keys). Anahtar yalnızca tarayıcının localStorage'ında durur.
Varsayılan model: `claude-opus-5` (ayarlardan Sonnet 5 / Haiku 4.5 seçilebilir).

## Mimari kısa notlar

- İlerleme: `localStorage["baliEnglish.v1"]` (`src/lib/store.jsx`)
- Aralıklı tekrar: 5 kutulu Leitner (`src/lib/srs.js`, aralıklar 0/1/2/4/7 gün)
- Ses: Web Speech API — `speechSynthesis` (TTS) + `SpeechRecognition` (STT)
- Gün tiki elle atılamaz; üç görev (kartlar + 10 dk konuşma + sınav ≥8/10)
  bitince `recomputeDay` otomatik atar.
- İkonlar: `npm run icons` (bağımlılıksız PNG üretici, `scripts/genIcons.mjs`)
