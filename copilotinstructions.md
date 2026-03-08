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
