# 🍞 Loaf – Social Party Game Platform

Loaf is a Progressive Web App (PWA) platform that hosts multiple multiplayer party games.

Players can create a room, invite friends, and play different social games together in real time using their phones or browsers.

The first game being developed is **Guess Me**, a social acting and number guessing game.

---

## Developer Context

I am building this project as a learning experience.

I already know:

* React.js
* Node.js
* Express.js

While building Loaf, I want to learn and practice:

* TailwindCSS
* shadcn/ui
* Wigggle UI animations
* WebSockets using Socket.IO
* multiplayer game architecture
* Progressive Web Apps (PWA)
* room-based multiplayer systems
* real-time synchronization
* deployment on free platforms

Please generate code that is:

* beginner friendly
* well structured
* modular
* documented with helpful comments

---

## Tech Stack

Frontend

* React + Vite
* TailwindCSS
* shadcn/ui
* Wigggle UI
* PWA (manifest + service worker)

Backend

* Node.js
* Express
* Socket.IO

Database

* None initially (store game rooms in memory)

---

## Core Features

Players should be able to:

* create a room
* join a room with a room code
* see players in the lobby
* select a game
* start the game
* play in real time

---

## Architecture Goal

The platform must support **multiple games** using a modular game engine system.

Example structure:

client/
games/
guess-me/
future-games/

server/
rooms/
sockets/
games/

Each game should expose a simple API like:

initGame()
startRound()
handlePlayerAction()
calculateScores()

---

## Multiplayer Design

Rooms are stored in server memory:

rooms = {
"ROOM123": {
players: [],
gameState: {},
scores: {}
}
}

Use Socket.IO to synchronize actions between players in real time.

---

## UI Requirements

This is a party game platform, so the UI should:

* be mobile friendly
* use large buttons
* be easy to understand quickly
* include fun animations
* use Tailwind + shadcn components
* use Wigggle UI animations where appropriate

---

**PWA & Deployment**

- **Run locally (server):**

	- Copy example env: `server/.env.example` -> `server/.env` and adjust `PORT` or `CLIENT_URL` if needed.
	- From the `server` folder run:

		npm install
		npm run build
		npm start

- **Run locally (client - Guess Me):**

	- Copy example env: `client/games/guess-me/.env.example` -> `client/games/guess-me/.env` and set `VITE_API_URL`.
	- From `client/games/guess-me` run:

		npm install
		npm run dev

- **Build (production):**

	- Client: from `client/games/guess-me` run `npm run build` (this runs TypeScript build then Vite build).
	- Server: from `server` run `npm run build` (TypeScript) then `npm start` to run `dist/index.js`.

**Progressive Web App (PWA)**

- `manifest.json` (added at `client/games/guess-me/public/manifest.json`) provides metadata the browser uses to show an "install" prompt. It contains `name`, `short_name`, `icons`, `start_url`, and `display: standalone` so the app opens like a native app.

- A service worker was added at `client/games/guess-me/public/service-worker.js`. A service worker is a small script that runs in the background (separate from the web page) and can intercept network requests and cache responses. Our worker caches a small app shell (index, icon, manifest) on install and serves cached assets when offline.

Why this matters (short, beginner friendly):

- Service workers allow offline-first behavior by intercepting fetches and returning cached responses when the network is unavailable.
- With `manifest.json` + service worker the app can be installed to the home screen and behave like a mobile app (standalone window, icon, splash screen).

**Mobile installation notes**

- Android Chrome: when the manifest and service worker are present and the site is served over HTTPS (or localhost during development), Chrome will show an install banner or menu entry.
- iOS Safari: iOS looks for a manifest and `apple-touch-icon` meta tags; users add the site to Home Screen manually via the share menu. Full service worker support on iOS has historically lagged; however adding the manifest and icons improves the home-screen experience.

**Environment variables**

- Server: use `server/.env` (example `server/.env.example`) and read with `process.env.PORT` / `process.env.CLIENT_URL` in Node.js. Node's `process.env` holds environment variables provided by the OS or a `.env` loader. For production platforms you set these in the project settings.
- Client (Vite): any env keys exposed to the browser must be prefixed with `VITE_`, e.g. `VITE_API_URL`. Vite in build time injects these into `import.meta.env` and makes them available to client code.

**Socket.IO & production WebSockets**

- Socket.IO provides a WebSocket-like API with fallbacks and features (reconnects, rooms, binary support). WebSocket is a persistent bidirectional connection (unlike HTTP request/response). We use Socket.IO on top of WebSocket for reliability and easier room management.
- The server already uses Socket.IO. In production ensure your hosting supports WebSocket connections (many PaaS like Railway, Render, Vercel + serverless have specific considerations). Deploy the server on a platform that supports long-lived sockets or use a socket-dedicated provider.

**Deployment (quick guides)**

1. Frontend (Vercel)

	- Create a new project on Vercel and point it to your Git repo.
	- Set the project root to `client/games/guess-me` (or create a monorepo configuration that builds that directory).
	- Set env var `VITE_API_URL` in Vercel to your backend URL.
	- Vercel will run `npm run build` and serve the static assets.

2. Backend (Railway or Render)

	- Create a new Node.js service and connect your repo.
	- Set build command `npm run build` and start command `npm start` (server package.json already defines these).
	- Set env vars (PORT, CLIENT_URL) in the service settings.
	- Ensure the service exposes the port Railway/Render expects (our `server` reads `PORT`).

3. Connect frontend to server

	- After backend is deployed, set the frontend env var `VITE_API_URL` to the backend public URL.
	- Make sure Socket.IO client connects to that URL (e.g., `const socket = io(import.meta.env.VITE_API_URL)` in client code).

**Notes on rooms & scaling**

- Rooms are kept in memory on the server (fast and simple). This means rooms live only while the process runs and are not shared across multiple server instances. For scale you can:
	- Use sticky sessions so all sockets for a room hit the same instance, or
	- Persist room state in an external store (Redis) and use a Socket.IO adapter (socket.io-redis) to coordinate events across instances.

**Learning concepts (short primers)**

- Progressive Web Apps: web apps that can be installed on the home screen, work offline, and feel app-like using a manifest + service worker.
- Service workers: background scripts that intercept network requests and can cache resources or proxy responses for offline use.
- WebSockets: a protocol for a persistent, bidirectional connection between client and server; unlike HTTP, both sides can send messages anytime.
- Socket.IO: a library that builds on WebSocket and provides auto-reconnects, event namespacing, and rooms which are convenient for multiplayer games.
- Room systems: a room groups sockets for a single game instance. The server broadcasts game state events only to sockets in the room.
- In-memory server state: simple and fast for development but ephemeral; move to a durable store for reliability and horizontal scaling.

---

If you want, I can:

- Add `vite-plugin-pwa` for richer caching and better manifest handling.
- Add PNG icons to `client/games/guess-me/public/icons/` and update `manifest.json` to reference them.
- Wire `VITE_API_URL` into the client's socket initialization (currently socket connection uses a relative URL). 


---

## Deployment Goal

The application should be deployable for free using platforms like:

* Vercel (frontend)
* Railway or Render (backend)

Docker should only be introduced if necessary later.

---

## Development Style

Generate code step-by-step and explain important concepts such as:

* WebSockets
* room management
* game synchronization
* multiplayer architecture
* PWA installation
