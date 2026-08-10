import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BALI_SINGLE=1 → tek dosyalık derleme (claude.ai Artifact yayını için):
// tüm fotoğraflar ve kod tek pakete gömülür, service worker devre dışı.
// Normal derleme → PWA: fotoğraflar ayrı dosya, hepsi çevrimdışı önbelleğe alınır.
const SINGLE = !!process.env.BALI_SINGLE

export default defineConfig({
  base: './',
  build: SINGLE
    ? {
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 20000,
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : { chunkSizeWarningLimit: 2000 },
  plugins: [
    react(),
    VitePWA({
      disable: SINGLE,
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Bali English',
        short_name: 'Bali English',
        description: '10 günde Bali için hayatta kalma İngilizcesi',
        lang: 'tr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        background_color: '#FFF8F0',
        theme_color: '#0E9F8F',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
