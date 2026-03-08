import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    // -------------------------------------------------------
    // 💡 vite-plugin-pwa — what it does:
    //
    // 1. **Generates a service worker** (via Workbox under the
    //    hood) that pre-caches every file Vite outputs during
    //    `npm run build`.  No hand-written SW needed!
    //
    // 2. **Injects a <link rel="manifest"> tag** into
    //    index.html automatically, so we don't need a manual
    //    manifest.json in public/.
    //
    // 3. `registerType: 'autoUpdate'` means the new SW
    //    activates immediately when a new build is deployed,
    //    so returning users always get the latest code.
    //
    // 4. The `manifest` object below replaces the old
    //    `public/manifest.json` — the plugin writes it for us.
    // -------------------------------------------------------
    VitePWA({
      registerType: 'autoUpdate',

      // Include common static asset types in the precache.
      // Workbox will hash each file and cache it at build time.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },

      // The web app manifest — same fields that were in
      // public/manifest.json but managed by the plugin now.
      manifest: {
        name: 'Loaf — Guess Me',
        short_name: 'Loaf',
        description: 'Multiplayer party games — Guess Me',
        start_url: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#D97706',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
