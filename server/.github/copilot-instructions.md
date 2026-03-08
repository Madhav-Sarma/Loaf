# 🍞 Loaf – GitHub Copilot Instructions

## Project Overview

Loaf is a Progressive Web App (PWA) platform for multiplayer social party games.

Players can:

* create a room
* join a room with a room code
* choose a game
* play together in real time using their phones.

The first game being developed is **Guess Me**, an acting and guessing party game.

This project is also a **learning project**, so generated code should prioritize **clarity, simplicity, and educational comments**.

---

# Developer Learning Goals

The developer already knows:

* React.js
* Node.js
* Express.js

While building Loaf, they want to learn:

* TypeScript best practices
* TailwindCSS
* shadcn/ui component system
* Wigggle UI animations
* WebSockets with Socket.IO
* multiplayer architecture
* room-based real-time game systems
* Progressive Web Apps (PWA)
* deployment of fullstack apps
* scalable multiplayer server design

When generating code:

* explain important concepts
* add beginner-friendly comments
* avoid overly complex patterns

---

# Tech Stack

Frontend:

* React 18+
* Vite
* TypeScript
* TailwindCSS
* shadcn/ui
* Wigggle UI

Backend:

* Node.js
* Express
* Socket.IO

State Management:

* Server memory (no database initially)

PWA:

* manifest.json
* service worker for installability

Deployment (later):

* Vercel (frontend)
* Railway or Render (backend)

Docker is **not required initially**.

---

# Project Architecture

Loaf is a **multi-game platform**.

One shared server manages:

* rooms
* players
* game state
* multiplayer events

Each game contains its own **game engine** and **UI components**.

Example structure:

client/
games/
guess-me/
src/
engine/
components/
pages/
types.ts
App.tsx
main.tsx

server/
index.ts
rooms/
sockets/
games/

shared/
types/

---

# Game Engine Design

Game engines should contain **pure logic only**.

They should NOT include:

* UI code
* networking logic

Every game engine must expose a standard API:

initGame()

startRound()

handlePlayerAction()

calculateScores()

This allows the server to run engines safely and validate player actions.

---

# Multiplayer Architecture

The server stores rooms in memory.

Example structure:

rooms = {
ROOM123: {
id: "ROOM123",
game: "guess-me",
hostId: "socketId",
players: [],
gameState: {}
}
}

Socket.IO events follow this pattern:

room:create
room:join
room:leave

game:start
game:action
game:update

The server processes actions using the game engine and broadcasts updated state.

Never trust the client for game logic.

---

# UI Design Guidelines

Use:

* TailwindCSS utilities
* shadcn/ui components
* Wigggle UI animations

Design principles:

* mobile-first layout
* large touch-friendly buttons
* minimal clutter
* clear instructions
* playful visual feedback

---

# Code Style Rules

Use TypeScript everywhere.

.ts → logic files
.tsx → React components

General guidelines:

* prefer functional React components
* use hooks instead of class components
* use named exports instead of default exports
* keep files small and focused
* avoid abbreviations in variable names
* use descriptive names

Example:

good:
playerScore

bad:
ps

---

# File Naming

Components:
PascalCase

Example:
PlayerCard.tsx

Hooks / utilities:
camelCase

Example:
useGameSocket.ts

Types:
camelCase file, PascalCase types

Example:
gameTypes.ts → GameState

---

# Testing Philosophy

Game engines should be easy to test because they are pure logic.

Prefer testing:

* game rules
* scoring logic
* round transitions

UI testing is optional initially.

---

# Development Philosophy

This is a learning project.

When generating code:

* prioritize readability
* avoid clever tricks
* prefer simple solutions
* explain new patterns
* include helpful comments

If multiple approaches exist, choose the one that is easiest to understand.

---

# Long-Term Goal

Loaf should become a **platform for many party games**.

Examples of future games:

* Guess Me
* Bluff Number
* Meme Caption
* Draw & Guess

The architecture should make it easy to add new games.

Each game should plug into the existing:

* lobby system
* room system
* multiplayer server
