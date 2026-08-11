import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fortawesome/fontawesome-free/css/all.min.css'
import { isTauri } from '@tauri-apps/api/core'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import tauriApi from './tauriApi.js'
import { initExternalLinkHandler } from './externalLinks.js'
import { initAutoUpdateCheck } from './tauriUpdater.js'
import './index.css'
import './styles/print.css'

// Under Electron setter preload.js window.api FØR noen renderer-JS kjører.
// Under Tauri finnes ingen tilsvarende preload-fase, så vi må selv sette
// window.api her, FØR React-treet rendres, slik at komponenter som leser
// window.api ved mount/render ser den.
//
// `isTauri()` (fra @tauri-apps/api/core) er den idiomatiske
// miljø-deteksjonen for Tauri 2 - den sjekker `globalThis.isTauri`, som
// alltid injiseres av Tauri-runtimen uavhengig av `app.withGlobalTauri`-
// innstillingen i tauri.conf.json. `window.__TAURI__` derimot krever
// eksplisitt `withGlobalTauri: true` (ikke satt i denne appens config), så
// den ville vært `undefined` her og aldri truffet - `isTauri()` er derfor
// det korrekte valget, ikke bare et alternativ.
if (isTauri()) {
  window.api = tauriApi
  // Se src/externalLinks.js for hvorfor dette trengs (Tauri-motstykke til
  // Electrons setWindowOpenHandler i window-manager.js).
  initExternalLinkHandler()
  // Tauri-motstykke til Electrons setupUpdater(winRef) i src/updater.js —
  // se src/tauriUpdater.js for detaljer om pull->push-broen som lar
  // UpdateBanner.jsx forbli uendret.
  initAutoUpdateCheck()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
