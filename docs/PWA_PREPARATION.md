# PWA Preparation Guide for Loaf

## Overview

A Progressive Web App (PWA) lets players "install" Loaf on their phone's home screen
like a native app — no app store needed! It works offline (to a degree) and loads faster
after the first visit.

## Files to Create

### 1. `client/games/guess-me/public/manifest.json`

```json
{
  "name": "Loaf — Party Games",
  "short_name": "Loaf",
  "description": "Multiplayer party games with friends",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF7ED",
  "theme_color": "#D97706",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 2. Icons

Create two PNG icons:
- `client/games/guess-me/public/icons/icon-192.png` (192×192)
- `client/games/guess-me/public/icons/icon-512.png` (512×512)

Use a bread/loaf emoji or custom logo.

### 3. Link manifest in `index.html`

Add this inside `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#D97706" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

### 4. Service Worker (later)

For offline support, you'll add a service worker. Vite has a plugin for this:

```bash
npm install -D vite-plugin-pwa
```

Then in `vite.config.ts`:

```ts
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // we use the manual manifest.json
    }),
  ],
});
```

## What to Do Now vs Later

**Now:** Create the manifest.json and icons, link in index.html.  
**Later:** Add vite-plugin-pwa for service worker + offline caching.

The manifest alone lets users "Add to Home Screen" on mobile browsers,
which is the most visible PWA benefit for a party game!
