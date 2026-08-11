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
  // Gün 1
  name: ['Name tag'],
  friend: ['Fist bump'],
  water: ['Drinking water'],
  toilet: ['Toilet'],
  // Gün 2
  airport: ['Ngurah Rai International Airport', 'Airport terminal'],
  plane: ['Airplane'],
  passport: ['Passport'],
  ticket: ['Boarding pass'],
  suitcase: ['Suitcase'],
  bag: ['Backpack'],
  gate: ['Jet bridge'],
  seat: ['Airline seat'],
  
  taxi: ['Taxicab', 'Taxi'],
  bus: ['Bus'],
  hotel: ['Hotel'],
  holiday: ['Vacation'],
  family: ['Nuclear family'],
  // Gün 3
  reception: ['Receptionist'],
  key: ['Lock and key', 'Key (lock)'],
  room: ['Bedroom', 'Hotel room'],
  shower: ['Shower'],
  soap: ['Soap'],
  breakfast: ['Breakfast'],
  pool: ['Swimming pool'],
  wifi: ['Wi-Fi'],
  'air-conditioning': ['Air conditioner', 'Air conditioning'],
  light: ['Electric light', 'Lamp'],
  // Gün 4
  menu: ['Menu'],
  coffee: ['Coffee'],
  tea: ['Green tea', 'Teacup'],
  juice: ['Orange juice', 'Juice'],
  beer: ['Beer'],
  rice: ['Cooked rice', 'Rice'],
  noodles: ['Noodle', 'Mie goreng'],
  chicken: ['Roast chicken', 'Chicken as food'],
  fish: ['Fish as food', 'Fish'],
  meat: ['Steak'],
  egg: ['Egg as food', 'Fried egg'],
  fruit: ['Fruit'],
  banana: ['Banana'],
  spicy: ['Chili pepper'],
  ice: ['Ice cube', 'Ice'],
  
  // Gün 5
  scooter: ['Honda Vario', 'Honda BeAT', 'Yamaha NMax'],
  helmet: ['Motorcycle helmet'],
  car: ['Toyota Corolla'],
  road: ['Road'],
  map: ['Road map'],
  stop: ['Stop sign'],
  petrol: ['Filling station'],
  traffic: ['Traffic light', 'Traffic congestion'],
  meter: ['Taximeter'],
  price: ['Price tag', 'Pricing'],
  // Gün 6
  shop: ['7-Eleven'],
  't-shirt': ['Ringer T-shirt', 'Crew neck'],
  dress: ['Little black dress', 'Dress'],
  shoes: ['Shoe'],
  hat: ['Sun hat', 'Hat'],
  money: ['Indonesian rupiah'],
  card: ['Credit card'],
  // Gün 7
  beach: ['Beach'],
  sea: ['Wind wave'],
  
  sunscreen: ['Sunscreen'],
  swim: ['Swimming'],
  surf: ['Surfing'],
  boat: ['Boat'],
  temple: ['Balinese temple'],
  waterfall: ['Waterfall'],
  monkey: ['Crab-eating macaque', 'Monkey'],
  rain: ['Monsoon'],
  cloud: ['Cumulus', 'Cloud'],
  time: ['Alarm clock'],
  // Gün 8
  doctor: ['Stethoscope', 'General practitioner'],
  hospital: ['Hospital'],
  pharmacy: ['Community pharmacy', 'Drugstore'],
  fever: ['Thermometer'],
  sunburn: ['Sunburn'],
  police: ['Police officer', 'Police'],
  phone: ['Smartphone'],
  wallet: ['Wallet'],
  mosquito: ['Mosquito'],
  emergency: ['Ambulance'],
  danger: ['Hazard symbol'],
  // Gün 9
  turkey: ['Flag of Turkey'],
  country: ['Earth', 'Globe'],
  photo: ['Digital camera'],
  dance: ['Balinese dance'],
  beautiful: ['Plumeria', 'Frangipani'],
  married: ['Wedding ring'],
  sunset: ['Sunset'],
  drink: ['Cocktail'],
  smile: ['Smiley'],
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
