import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 💡 SERVICE WORKER REGISTRATION — HOW IT WORKS
//
// vite-plugin-pwa generates a service worker at build time
// (using Google's Workbox library) and exposes a tiny
// virtual module called 'virtual:pwa-register' that handles
// registration for us.
//
// registerSW() does two things:
//   1. Registers the generated `sw.js` in the browser.
//   2. Sets up an "immediate" flag so new versions of the SW
//      activate right away (no stale tabs).
//
// During `vite dev` the SW is NOT active — it only works in
// production builds (`npm run build` then `npm run preview`).
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })
