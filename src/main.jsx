import { createRoot } from 'react-dom/client'
import App from './components/App'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

try {
  registerSW({ immediate: true })
} catch {
  /* service worker desteklenmeyen ortam (ör. yayınlanmış tek dosya) — sorun değil */
}

createRoot(document.getElementById('root')).render(<App />)
