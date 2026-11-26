import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './styles/tokens.css'
// v9: Plus Jakarta Sans auto-ospitato, niente richieste a Google Fonts.
import './styles/global.css'

document.documentElement.setAttribute('data-fonts', 'local');

createRoot(document.getElementById('root'), {
  // Errori già gestiti dall'ErrorBoundary: avviso, non errore, per non sporcare la console.
  onCaughtError: (error) => console.warn('Cassetto: errore gestito', error),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
window.__cassettoMounted = true
try {
  sessionStorage.removeItem('cassetto-legacy-heal')
} catch {
  /* sessionStorage non disponibile */
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {})
  })
}
