# Bali English 🌴 — 7 Günlük Sosyal Akıcılık Sprinti

Hedef: 7 gün sonunda Bali'de başka bir gezginle 5-15 dakikalık spontane İngilizce
sohbeti rahatça yürütebilmek. Kelime ezberi değil — **chunk** (hazır kalıp), tepki,
takip sorusu, plan yapma, hikâye anlatma ve sohbet kurtarma antrenmanı.

## Yayın

- **Ana link (tam sürüm):** https://hakanozddemirr.github.io/bali-english/
- Yedek (claude.ai Artifact): https://claude.ai/code/artifact/316fc6a2-2a36-4bae-96f9-b5b0de04a0e9

Güncelleme akışı:

```bash
npm run build && rm -rf docs && cp -R dist docs && touch docs/.nojekyll
git add -A && git commit -m "güncelleme" && git push
```

## Mimari (v2)

- 7 gün × `src/content/dayN.json`: `chunks` (kalıp+TR+kullanım notu+örnek),
  `quick` (⚡ hızlı cevap), `social` (react/follow/build/story), `grammar`
  (mikro gramer + TR→EN üretim drilleri), `listening`, `scenario` (kişilikli,
  değişken beat'ler). Gün 7: `sims` (9 mini simülasyon) + final serbest konuşma.
- `guide.json`: 126 kalıplık aranabilir, ⭐ favorili Cep Rehberi (14 kategori).
- `freetalk.json`: 11 bağlam + 8 kişilik + genel beat havuzu.
- Durum: `localStorage["baliEnglish.v2"]` (v1'den yalnız ayarlar göç eder).
  SRS chunk bazlı Leitner; `known` seti ("Bunu biliyorum") + 3 dk kalibrasyon.
- Konuşma iki modlu: API anahtarıyla **Claude** (doğal gezgin kişilikleri,
  Guided/Normal/Realistic, oturum sonu yapılandırılmış geri bildirim + hata
  bankası) — anahtarsız **çevrimdışı beat motoru** (kabul-öncelikli, `beats.js`).
- Hata bankası: gramer drillerinden ve Claude geri bildiriminden otomatik dolar
  (Ayarlar ekranında).
- TTS: ABD/İngiliz/Avustralya aksan rotasyonu + 0.85–1.2x hız (`tts.js`).
- "Konuşma Netliği": STT karşılaştırması — telaffuz puanı DEĞİL, anlaşılabilirlik
  tahmini (gölgeleme modu dahil).

## İçerik düzenleme

Tüm müfredat düz JSON. Sınav soruları `quizGen.js` ile içerikten üretilir —
doğru cevaplar `listening.options[0]` ve `grammar.drills.keys` üzerinden.
Beat şablonlarında `{name} {from} {days}` gibi alanlar kişilikten doldurulur.
