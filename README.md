# Bali English 🌴 — Sabah Sistemi (v3)

Her sabah 1 saat, konuşma odaklı: **Tekrar (5) → Ders + Yapı Lab (25) → Kitap (15) → Konuşma (10) → Today I… (5)**.
Gramer: Aksen Kahraman YouTube oynatma listesi (138 ünite → 72 günlük seans). Kitaplar: 50 Basic Reading Passages,
1000 English Words With Puzzles. Kötü gün = minimum (tekrar + 5 dk konuşma), seri bozulmaz.

## Yayın

- **Ana link (tam sürüm):** https://hakanozddemirr.github.io/bali-english/
- Yedek (claude.ai Artifact): https://claude.ai/code/artifact/316fc6a2-2a36-4bae-96f9-b5b0de04a0e9

Güncelleme akışı:

```bash
npm run build && rm -rf docs && cp -R dist docs && touch docs/.nojekyll
git add -A && git commit -m "güncelleme" && git push
```

## Mimari (v3)

- `src/content/course.json` — `scripts/buildCourse.py` ile oynatma listesinden üretilir
  (`yt-dlp --flat-playlist` çıktısı → `scripts/playlist.txt`). Tanıtım videoları atlanır, alıştırma videoları
  konusuna bağlanır, kısa dersler ≤28 dk video olacak şekilde aynı güne birleştirilir.
- `src/content/lab/*.json` — Yapı Laboratuvarı (TR → EN sesli cümle kurma), ders anahtarı bazında
  (`focusTr`, `pattern`, 12 `items` {tr, en[], tip}, 3 `talk` sorusu). Ders 1–40 hazır; sonrası API anahtarıyla
  Claude tarafından üretilip `labCache`'e yazılır. İçerik kuralları: `scripts/LAB_BRIEF.md`.
- Kontrol: `match.js → checkSentence` (kısaltma/kesmesiz yazım normalize) → tutmazsa Claude Haiku ile anlam kontrolü.
- Tekrar destesi (`cards.js`): kitap kelimesi / hata / Lab cümlesi / Yakala; aralıklar 0-1-3-7-16-35 gün.
- Günlük kayıt `state.log[YYYY-MM-DD]` → seri, 4 haftalık ısı haritası, minimum gün.
- Konuşma: günlük modda sabahki yapı + günün kelimeleri sistem promptuna girer; süre bugünün kaydına yazılır.
- Haftalık Kontrol: 2 dk konuşma → akıcılık/doğruluk/çeşitlilik puanı (API).
- Yedek: Ayarlar → JSON indir/yükle (API anahtarı hariç). Claude Code'a verilirse `context/english/` güncellenir.
- Durum: `localStorage["baliEnglish.v3"]` (v2 verisi silinmeden taşınır). 7 günlük v2 sprinti "Konuş → Arşiv"de.
- Modeller: Opus 5.5 (varsayılan), Sonnet 5.5, Haiku 4.5. Opus/Sonnet 5.5'te sunucu taraflı yedek model açık.
