// Derlenmiş uygulamayı tek HTML parçasına çevirir (claude.ai Artifact yayını için).
// Önce `npm run build`, sonra `node scripts/makeArtifact.mjs` çalıştır.
// Çıktı: dist/bali-artifact.html — Artifact sarmalayıcısı doctype/head/body eklediği
// için tam belge DEĞİL, gövde içeriği üretilir.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = join(ROOT, 'dist', 'assets')

const files = readdirSync(ASSETS)
const jsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'))
const cssFile = files.find((f) => f.endsWith('.css'))
if (!jsFile || !cssFile) throw new Error('dist/assets içinde paket bulunamadı — önce npm run build')

let js = readFileSync(join(ASSETS, jsFile), 'utf8')
const css = readFileSync(join(ASSETS, cssFile), 'utf8')
js = js.replace(/<\/script/gi, '<\\/script') // inline script güvenliği

const html = `<title>Bali English 🌴</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`
const out = join(ROOT, 'dist', 'bali-artifact.html')
writeFileSync(out, html)
console.log('yazıldı:', out, '—', (html.length / 1024 / 1024).toFixed(2), 'MB')
