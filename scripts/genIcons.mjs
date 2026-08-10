// PWA ikonlarını (gün batımı + palmiye) bağımlılıksız üretir: node scripts/genIcons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

// ---- küçük PNG kodlayıcı (8-bit RGBA) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePNG(pixels, w, h) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0 // filtre yok
    pixels.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- çizim yardımcıları ----
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]

function draw(size, contentScale = 1) {
  const px = Buffer.alloc(size * size * 4)
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255
  }
  const get = (x, y) => {
    const i = (y * size + x) * 4
    return [px[i], px[i + 1], px[i + 2]]
  }

  const skyTop = hex('#FFD98E'), skyMid = hex('#FFB273'), skyLow = hex('#FF7E67')
  const seaTop = hex('#12A594'), seaBot = hex('#0B7C74')
  const sunC = hex('#FFF6DC')
  const palm = hex('#14343B')

  // içerik ölçekleme: maskable için merkeze doğru küçült
  const cx0 = size / 2
  const S = (v) => cx0 + (v - cx0) * contentScale
  const R = (v) => v * contentScale

  const seaY = S(size * 0.63)
  // gökyüzü + deniz
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave = Math.sin((x / size) * 14) * size * 0.008
      if (y < seaY + wave) {
        const t = y / seaY
        set(x, y, t < 0.55 ? mix(skyTop, skyMid, t / 0.55) : mix(skyMid, skyLow, (t - 0.55) / 0.45))
      } else {
        const t = (y - seaY) / (size - seaY)
        set(x, y, mix(seaTop, seaBot, t))
      }
    }
  }
  // güneş (yumuşak kenarlı)
  const sunX = S(size * 0.5), sunY = S(size * 0.43), sunR = R(size * 0.17)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - sunX, y - sunY)
      if (d < sunR + 2) {
        const a = Math.min(1, Math.max(0, (sunR - d) / 2 + 1))
        set(x, y, mix(get(x, y), sunC, a * 0.95))
      }
    }
  }
  // güneş yansıması
  for (let i = 0; i < 5; i++) {
    const yy = Math.round(seaY + R(size * (0.05 + i * 0.055)))
    const ww = R(size * (0.14 - i * 0.02))
    for (let x = Math.round(sunX - ww); x < sunX + ww; x++) {
      const c = get(Math.max(0, Math.min(size - 1, x)), yy)
      set(x, yy, mix(c, sunC, 0.5))
      set(x, yy + 1, mix(c, sunC, 0.35))
    }
  }

  // dolu daire damgala
  const dot = (x, y, r, c) => {
    for (let yy = Math.floor(y - r); yy <= y + r; yy++)
      for (let xx = Math.floor(x - r); xx <= x + r; xx++)
        if (Math.hypot(xx - x, yy - y) <= r) set(Math.round(xx), Math.round(yy), c)
  }
  // eğri boyunca damgala (quadratic bezier)
  const stroke = (p0, p1, p2, r0, r1, c) => {
    for (let t = 0; t <= 1; t += 0.01) {
      const mt = 1 - t
      const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0]
      const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1]
      dot(x, y, lerp(r0, r1, t), c)
    }
  }

  // palmiye gövdesi
  const base = [S(size * 0.27), S(size * 0.9)]
  const tip = [S(size * 0.4), S(size * 0.3)]
  stroke(base, [S(size * 0.26), S(size * 0.58)], tip, R(size * 0.024), R(size * 0.011), palm)
  // yapraklar
  const fronds = [
    { a: -2.6, len: 0.2, droop: 0.03 },
    { a: -2.1, len: 0.24, droop: 0.09 },
    { a: -0.9, len: 0.24, droop: 0.1 },
    { a: -0.35, len: 0.22, droop: 0.05 },
    { a: 3.0, len: 0.18, droop: 0.02 },
    { a: 0.25, len: 0.19, droop: 0.1 },
  ]
  for (const f of fronds) {
    const L = R(size * f.len)
    const end = [tip[0] + Math.cos(f.a) * L, tip[1] + Math.sin(f.a) * L * 0.55 + R(size * f.droop)]
    const ctrl = [tip[0] + Math.cos(f.a) * L * 0.5, tip[1] + Math.sin(f.a) * L * 0.28 - R(size * 0.045)]
    stroke(tip, ctrl, end, R(size * 0.012), R(size * 0.002), palm)
  }
  dot(tip[0] - R(size * 0.015), tip[1] + R(size * 0.02), R(size * 0.016), palm)
  dot(tip[0] + R(size * 0.015), tip[1] + R(size * 0.024), R(size * 0.014), palm)

  return px
}

function resize(src, srcSize, dstSize) {
  const dst = Buffer.alloc(dstSize * dstSize * 4)
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.min(srcSize - 1, (x + 0.5) * (srcSize / dstSize))
      const sy = Math.min(srcSize - 1, (y + 0.5) * (srcSize / dstSize))
      const x0 = Math.floor(sx), y0 = Math.floor(sy)
      const x1 = Math.min(srcSize - 1, x0 + 1), y1 = Math.min(srcSize - 1, y0 + 1)
      const fx = sx - x0, fy = sy - y0
      for (let ch = 0; ch < 4; ch++) {
        const v =
          src[(y0 * srcSize + x0) * 4 + ch] * (1 - fx) * (1 - fy) +
          src[(y0 * srcSize + x1) * 4 + ch] * fx * (1 - fy) +
          src[(y1 * srcSize + x0) * 4 + ch] * (1 - fx) * fy +
          src[(y1 * srcSize + x1) * 4 + ch] * fx * fy
        dst[(y * dstSize + x) * 4 + ch] = Math.round(v)
      }
    }
  }
  return dst
}

const big = draw(512, 1)
const maskable = draw(512, 0.8)
writeFileSync(join(OUT, 'icon-512.png'), encodePNG(big, 512, 512))
writeFileSync(join(OUT, 'icon-512-maskable.png'), encodePNG(maskable, 512, 512))
writeFileSync(join(OUT, 'icon-192.png'), encodePNG(resize(big, 512, 192), 192, 192))
writeFileSync(join(OUT, 'apple-touch-icon.png'), encodePNG(resize(big, 512, 180), 180, 180))
console.log('İkonlar üretildi →', OUT)
