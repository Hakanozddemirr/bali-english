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

## Yayınlanan sürümler

**Ana link (tam sürüm — asistan + çevrimdışı):**
https://hakanozddemirr.github.io/bali-english/

GitHub Pages, `main` dalındaki `docs/` klasöründen sunulur. Güncelleme:

```bash
npm run build && rm -rf docs && cp -R dist docs && touch docs/.nojekyll
git add -A && git commit -m "güncelleme" && git push
```

(1-2 dakika içinde yayına girer.)

**Yedek link (claude.ai Artifact — asistan çalışmaz):**
https://claude.ai/code/artifact/316fc6a2-2a36-4bae-96f9-b5b0de04a0e9
Güncellemek için: `npm run build:artifact` → `dist/bali-artifact.html` yeniden yayınlanır.

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
