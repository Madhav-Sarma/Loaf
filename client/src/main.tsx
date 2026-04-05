import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { registerSW } from 'virtual:pwa-register'

const hasActiveController =
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  Boolean(navigator.serviceWorker.controller)

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  let isReloadingForUpdate = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasActiveController || isReloadingForUpdate) {
      return
    }

    isReloadingForUpdate = true
    window.location.reload()
  })
}

let triggerServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined

triggerServiceWorkerUpdate = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return
    }

    // Keep checking while the app is open so installed PWAs pick up new builds.
    void registration.update()
    window.setInterval(() => {
      void registration.update()
    }, 60 * 1000)
  },
  onNeedRefresh() {
    if (!triggerServiceWorkerUpdate) {
      return
    }

    void triggerServiceWorkerUpdate(true)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
