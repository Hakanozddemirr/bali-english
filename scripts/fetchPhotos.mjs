// Kelime kartları için Wikipedia'dan (Wikimedia Commons görselleri) fotoğraf indirir.
// Kullanım: node scripts/fetchPhotos.mjs   — mevcut dosyaları atlar (idempotent).
// Fotoğraflar src/assets/photos/{slug}.jpg|png olarak kaydedilir; uygulama
// dosya adına göre otomatik eşler (src/content/index.js). Soyut kelimeler
// (evet/hayır, renkler, oklar, sayılar...) bilerek emoji olarak bırakıldı.
import { mkdirSync, writeFileSync, existsSync, statSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'assets', 'photos')
mkdirSync(OUT, { recursive: true })

const UA = 'BaliEnglishApp/1.0 (kisisel dil ogrenme uygulamasi)'

// slug (content/index.js ile ayni: kucuk harf, alfasayisal disi -> "-") → aday Wikipedia makaleleri
const PHOTO_MAP = {
  // Gün 2 — havalimanı
  departure: ['Flight information display system'],
  arrival: ['Baggage carousel'],
  luggage: ['Baggage', 'Checked baggage'],
  'boarding-pass': ['Boarding pass'],
  gate: ['Jet bridge'],
  seat: ['Airline seat'],
  customs: ['Customs'],
  security: ['Airport security'],
  exchange: ['Currency', 'Bureau de change'],
  
  // Gün 3 — otel
  reception: ['Receptionist'],
  towel: ['Towel', 'Beach towel'],
  pillow: ['Pillow'],
  blanket: ['Duvet', 'Quilt'],
  elevator: ['Elevator'],
  stairs: ['Stairs'],
  balcony: ['Balcony'],
  safe: ['Safe'],
  laundry: ['Laundry'],
  breakfast: ['Breakfast'],
  'air-conditioning': ['Air conditioner', 'Air conditioning'],
  key: ['Lock and key', 'Key (lock)'],
  // Gün 4 — restoran
  fork: ['Cutlery', 'Fork'],
  spoon: ['Spoon'],
  knife: ['Kitchen knife', 'Knife'],
  plate: ['Plate (dishware)'],
  glass: ['Drinking glass', 'Highball glass'],
  
  sugar: ['White sugar', 'Powdered sugar'],
  
  seafood: ['Seafood'],
  squid: ['Squid'],
  grilled: ['Grilling'],
  
  spicy: ['Chili pepper'],
  // Gün 5 — ulaşım
  scooter: ['Honda Vario', 'Honda BeAT', 'Yamaha NMax'],
  helmet: ['Motorcycle helmet'],
  license: ["Driver's license"],
  petrol: ['Filling station'],
  meter: ['Taximeter'],
  traffic: ['Traffic light', 'Traffic congestion'],
  
  'flat-tire': ['Flat tire'],
  brakes: ['Disc brake'],
  parking: ['Parking lot', 'Parking'],
  bridge: ['Bridge'],
  roundabout: ['Roundabout'],
  price: ['Price tag', 'Pricing'],
  road: ['Road'],
  // Gün 6 — pazar
  market: ['Marketplace', 'Wet market'],
  souvenir: ['Gift shop'],
  sarong: ['Sarong'],
  change: ['Coin'],
  silver: ['Silver'],
  handmade: ['Batik'],
  hat: ['Sun hat', 'Hat'],
  money: ['Indonesian rupiah'],
  card: ['Credit card'],
  // Gün 7 — plaj & doğa
  wave: ['Wind wave'],
  snorkeling: ['Snorkeling'],
  diving: ['Scuba diving'],
  'life-jacket': ['Life jacket'],
  jellyfish: ['Jellyfish'],
  coral: ['Coral'],
  turtle: ['Sea turtle'],
  volcano: ['Mount Batur', 'Volcano'],
  'rice-terrace': ['Paddy field'],
  hike: ['Hiking'],
  crowded: ['Audience', 'Crowd'],
  surf: ['Surfing'],
  temple: ['Balinese temple'],
  waterfall: ['Waterfall'],
  sunscreen: ['Sunscreen'],
  monkey: ['Crab-eating macaque', 'Monkey'],
  rain: ['Monsoon'],
  // Gün 8 — sağlık
  pharmacy: ['Community pharmacy', 'Drugstore'],
  medicine: ['Tablet (pharmacy)', 'Pharmaceutical drug'],
  bandage: ['Adhesive bandage'],
  ambulance: ['Ambulance'],
  embassy: ['Diplomatic mission'],
  fever: ['Thermometer'],
  sunburn: ['Sunburn'],
  wallet: ['Wallet'],
  mosquito: ['Mosquito'],
  // Gün 9 — sosyal
  turkey: ['Flag of Turkey'],
  children: ['Child'],
  student: ['Student'],
  football: ['Association football'],
  
  dance: ['Balinese dance'],
  married: ['Wedding ring'],
  sunset: ['Sunset'],
  beautiful: ['Plumeria', 'Frangipani'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 429 (hız sınırı) durumunda bekleyip yeniden dener
async function fetchRetry(url, headers, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers })
      if (r.status === 429 || r.status >= 500) {
        await sleep(3000 * (i + 1))
        continue
      }
      return r
    } catch {
      await sleep(2000 * (i + 1))
    }
  }
  return null
}

async function summary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const r = await fetchRetry(url, { 'user-agent': UA, accept: 'application/json' })
  if (!r || !r.ok) return null
  return r.json()
}

let ok = 0, miss = 0
for (const [slug, titles] of Object.entries(PHOTO_MAP)) {
  const jpg = join(OUT, slug + '.jpg')
  const png = join(OUT, slug + '.png')
  if (existsSync(jpg) || existsSync(png)) { console.log('skip', slug); ok++; continue }
  let done = false
  for (const t of titles) {
    try {
      const s = await summary(t)
      // URL'yi olduğu gibi kullan — boyut değiştirmek/parametre silmek 400 döndürüyor
      const src = s?.thumbnail?.source
      if (!src) continue
      const img = await fetchRetry(src, { 'user-agent': UA })
      if (!img || !img.ok) continue
      const buf = Buffer.from(await img.arrayBuffer())
      const isPng = /\.png(\?|$)/i.test(src)
      const tmp = join(OUT, `_tmp_dl.${isPng ? 'png' : 'jpg'}`)
      writeFileSync(tmp, buf)
      const dest = isPng ? png : jpg
      const args = isPng
        ? ['-Z', '520', tmp, '--out', dest]
        : ['-Z', '520', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', tmp, '--out', dest]
      execFileSync('sips', args, { stdio: 'ignore' })
      unlinkSync(tmp)
      console.log('ok  ', slug.padEnd(18), '←', t.padEnd(24), Math.round(statSync(dest).size / 1024) + 'KB')
      done = true
      ok++
      break
    } catch { /* sıradaki adayı dene */ }
  }
  if (!done) { console.log('MISS', slug, '(emoji kalacak)'); miss++ }
  await sleep(600)
}
console.log(`\nBitti: ${ok} fotoğraf, ${miss} eksik.`)
