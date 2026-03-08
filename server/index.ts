// ============================================================
// server/index.ts — Loaf Multiplayer Server
// ============================================================
//
// 💡 This is the brain of the multiplayer system. It:
//   1. Runs an Express HTTP server
//   2. Adds Socket.IO for real-time WebSocket communication
//   3. Manages rooms where players gather
//   4. Processes game actions using the game engine
//   5. Broadcasts updated state to all players in a room
//
// 💡 KEY CONCEPT: "Server Authority"
// The server is the single source of truth for all game state.
// Clients send actions (like "submit my number"), the server
// validates them using the game engine, and broadcasts the
// result. This prevents cheating — clients can't lie about
// the game state because the server controls it.
//
// 💡 HOW SOCKET.IO WORKS (quick recap):
// - HTTP is request/response: client asks, server answers, done.
// - WebSockets keep a persistent connection open between client
//   and server, allowing both sides to send messages anytime.
// - Socket.IO wraps WebSockets with nice features:
//   • Automatic reconnection if the connection drops
//   • "Rooms" for grouping connections (perfect for game rooms!)
//   • "Events" with named channels (like "game:action")
//   • Acknowledgment callbacks (request/response over WebSocket)
// ============================================================

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  initGame,
  addPlayer,
  removePlayer,
  updateSettings,
  startRound,
  advancePhase,
  submitSecretNumber,
  submitActionPrompt,
  completePerformance,
  submitGuess,
  calculateScores,
  allPlayersReady,
} from "./games/guess-me/gameEngine.js";

// 💡 SHARED TYPES: Imported from the shared folder so both
// server and client use the exact same type definitions.
// No more keeping two copies in sync!
import type {
  GameSettings,
  GameState,
  Player,
  ScoreResult,
} from "../shared/guess-me/gameTypes.js";

// 💡 SOCKET EVENT CONSTANTS: Both server and client import
// these so event names are always in sync. No more string typos!
import { RoomEvents, GameEvents, GameActionTypes } from "../shared/socketEvents.js";
import type { GameActionType } from "../shared/socketEvents.js";

// 💡 LOGGER: Structured logging with timestamps and categories.
// Makes server output consistent and easy to search/filter.
import {
  logRoomEvent,
  logPlayerEvent,
  logGameAction,
  logError,
  logServer,
} from "./logger.js";

// 💡 VALIDATION: Checks every action before passing it to the
// game engine. Never trust the client!
import {
  validateSubmitNumber,
  validateSubmitGuess,
  validateSubmitPrompt,
  validateCompletePerformance,
  validateUpdateSettings,
  validateStartGame,
  validateFinishGuessing,
  validatePhaseAction,
} from "./validation/validateAction.js";

// ============================================================
// CONFIGURATION
// ============================================================

// 💡 process.env.PORT lets hosting platforms (Railway, Render)
// set the port. We fall back to 3001 for local development.
const PORT = process.env.PORT ?? 3001;

// ============================================================
// ROOM MANAGEMENT
// ============================================================

// 💡 Room interface — everything the server tracks per room.
// This is the server-side equivalent of the client's state.
interface Room {
  id: string;
  gameState: GameState;
  scoreResults: ScoreResult[];
  // 💡 Set<string> stores unique player IDs who finished guessing.
  // We use a Set because lookup is O(1) and it auto-prevents duplicates.
  finishedGuessers: Set<string>;
}

// 💡 In-memory storage using JavaScript Maps.
// Maps are like objects but with better performance for frequent
// additions/deletions, and keys can be any type (not just strings).
//
// ⚠️ Data is lost on server restart! For production, you'd use
// Redis or a database. For a party game that's fine — games are
// short-lived anyway.
const rooms = new Map<string, Room>();

// 💡 Maps socket IDs to room codes so we can find a player's
// room when they send an action or disconnect.
const socketToRoom = new Map<string, string>();

/**
 * Generates a random 6-character room code.
 *
 * 💡 We exclude confusing characters (I/1, O/0) so codes are
 * easy to read aloud: "Join room HXDR4K" — no ambiguity!
 */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Recursive check: if the code already exists, try again.
  // With 30^6 = 729M possible codes, collisions are very rare.
  return rooms.has(code) ? generateRoomCode() : code;
}

// ============================================================
// EXPRESS + SOCKET.IO SETUP
// ============================================================

const app = express();

// 💡 Express alone only handles HTTP requests. To add WebSocket
// support via Socket.IO, we need the raw Node.js HTTP server.
// createServer(app) wraps Express so both HTTP and WebSocket
// traffic go through the same port.
const httpServer = createServer(app);

// 💡 Socket.IO Server Configuration
// cors: allows the Vite dev server (different port) to connect.
// Without CORS, the browser blocks cross-origin WebSocket requests.
//
// 💡 CORS (Cross-Origin Resource Sharing) is a browser security
// feature. Since the client (localhost:5173) and server (localhost:3001)
// run on different ports, they're considered different "origins."
// We must explicitly allow the client's origin.
// 💡 CORS origins: In production, set CLIENT_URL env var to your
// Vercel deployment URL (e.g., "https://loaf-guess-me.vercel.app").
// Multiple origins can be comma-separated.
const configuredClientUrl = process.env.CLIENT_URL?.trim();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !configuredClientUrl) {
  throw new Error("Missing required env var in production: CLIENT_URL");
}

const corsOrigins = configuredClientUrl
  ? configuredClientUrl
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
  : [
      "http://localhost:5173",      // Vite default dev port
      "http://localhost:5174",      // Vite alternate port
      "http://localhost:4173",      // Vite preview port
    ];

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
  },
});

// 💡 Simple health check endpoint — useful for monitoring and
// deployment checks. Hit GET /health to see if the server is alive.
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
    uptime: process.uptime(),
  });
});

// ============================================================
// HELPER: Broadcast state to all players in a room
// ============================================================

/**
 * Sends the current game state to every socket in a room.
 *
 * 💡 io.to(roomId) targets all sockets that have "joined" that
 * Socket.IO room (via socket.join()). This is the key multiplayer
 * pattern: process an action → broadcast the result to everyone.
 *
 * We send the full game state every time. This is the simplest
 * approach and makes the client easy to build — it just renders
 * whatever state it receives. For larger games, you'd send
 * incremental updates (diffs) to save bandwidth.
 */
function broadcastState(room: Room): void {
  // 💡 Uses the shared GameEvents.STATE constant instead of a raw string.
  io.to(room.id).emit(GameEvents.STATE, {
    gameState: room.gameState,
    scoreResults: room.scoreResults,
  });
}

// ============================================================
// SOCKET.IO EVENT HANDLERS
// ============================================================
//
// 💡 Socket.IO event flow:
//
// 1. Client connects → io.on("connection") fires
// 2. We set up event listeners on that specific socket
// 3. Client emits events → our listeners process them
// 4. We broadcast updates to the room
// 5. Client disconnects → "disconnect" event fires
//
// Think of each socket as a "phone line" to one player.
// When they call (emit), we answer (handle), then announce
// the result to everyone on the conference call (broadcast).
// ============================================================

io.on("connection", (socket) => {
  logServer(`Player connected: ${socket.id}`);

  // ----------------------------------------------------------
  // ROOM: CREATE
  // ----------------------------------------------------------
  // 💡 The callback parameter is a Socket.IO "acknowledgment."
  // It's like a Promise — the client awaits the response.
  // This is perfect for request/response patterns over WebSocket.
  //
  // Client sends: socket.emit("room:create", data, (response) => {})
  // Server calls: callback({ success: true, ... })
  // Client receives the response in (response) => {}
  // ----------------------------------------------------------
  socket.on(RoomEvents.CREATE, (
    { playerName }: { playerName: string },
    callback: (response: { success: boolean; roomCode?: string; gameState?: GameState; error?: string }) => void
  ) => {
    // Validate input
    const trimmedName = playerName?.trim();
    if (!trimmedName || trimmedName.length === 0) {
      callback({ success: false, error: "Please enter a name." });
      return;
    }

    const roomCode = generateRoomCode();

    // Create the host player using the socket ID as the player ID.
    // 💡 Using socket.id as player ID is convenient — it's unique,
    // automatically assigned, and available on both client and server.
    const host: Player = {
      id: socket.id,
      name: trimmedName,
      score: 0,
      role: "player",
      isHost: true,
    };

    // Initialize game state using the engine
    const gameState = initGame(roomCode, host);

    const room: Room = {
      id: roomCode,
      gameState,
      scoreResults: [],
      finishedGuessers: new Set(),
    };

    // Store the room and track which room this socket is in
    rooms.set(roomCode, room);
    socketToRoom.set(socket.id, roomCode);

    // 💡 socket.join(roomCode) adds this socket to a Socket.IO room.
    // Now io.to(roomCode).emit(...) will include this socket.
    // Socket.IO rooms are separate from our game rooms — but we
    // use the same ID for both, which keeps things simple!
    socket.join(roomCode);

    logRoomEvent(roomCode, `Created by ${trimmedName}`);
    logPlayerEvent(trimmedName, `Created room ${roomCode}`);

    // Respond to the client with the room code and initial state
    callback({ success: true, roomCode, gameState });
  });

  // ----------------------------------------------------------
  // ROOM: JOIN
  // ----------------------------------------------------------
  socket.on(RoomEvents.JOIN, (
    { roomCode, playerName }: { roomCode: string; playerName: string },
    callback: (response: { success: boolean; gameState?: GameState; error?: string }) => void
  ) => {
    const trimmedName = playerName?.trim();
    if (!trimmedName || trimmedName.length === 0) {
      callback({ success: false, error: "Please enter a name." });
      return;
    }

    // 💡 .toUpperCase() makes room codes case-insensitive.
    // Players can type "hxdr4k" instead of "HXDR4K" — less friction!
    const normalizedCode = roomCode?.trim().toUpperCase();
    const room = rooms.get(normalizedCode);

    if (!room) {
      callback({ success: false, error: "Room not found. Check the code and try again." });
      return;
    }

    // Only allow joining during lobby
    if (room.gameState.phase !== "lobby") {
      callback({ success: false, error: "Game already in progress. Wait for the next game!" });
      return;
    }

    // Prevent duplicate names (case-insensitive comparison)
    if (room.gameState.players.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      callback({ success: false, error: "That name is already taken. Try a different one!" });
      return;
    }

    const newPlayer: Player = {
      id: socket.id,
      name: trimmedName,
      score: 0,
      role: "player",
      isHost: false,
    };

    // Use the engine to add the player (it also validates internally)
    room.gameState = addPlayer(room.gameState, newPlayer);

    // Join Socket.IO room + track mapping
    socket.join(normalizedCode);
    socketToRoom.set(socket.id, normalizedCode);

    logRoomEvent(normalizedCode, `${trimmedName} joined`);
    logPlayerEvent(trimmedName, `Joined room ${normalizedCode}`);

    // Broadcast to ALL players so everyone sees the new player
    broadcastState(room);

    // Also respond to the joining player
    callback({ success: true, gameState: room.gameState });
  });

  // ----------------------------------------------------------
  // GAME: ACTION (with validation + phase guards + logging)
  // ----------------------------------------------------------
  // 💡 Server flow: Client event → VALIDATE → game engine → broadcast.
  // The validation layer (validateAction.ts) checks every action
  // before it reaches the game engine, preventing invalid or
  // malicious inputs from corrupting game state.
  // ----------------------------------------------------------
  socket.on(GameEvents.ACTION, ({ type, payload }: { type: string; payload?: Record<string, unknown> }) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    // Log every action for debugging
    logGameAction(roomCode, type, socket.id);

    switch (type) {
      // --- Settings (host only, lobby phase) ---
      case GameActionTypes.UPDATE_SETTINGS: {
        const validation = validateUpdateSettings(room.gameState, socket.id);
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        room.gameState = updateSettings(
          room.gameState,
          payload as Partial<GameSettings>
        );
        break;
      }

      // --- Start the game (transitions from lobby → role-assignment) ---
      case GameActionTypes.START_GAME: {
        const validation = validateStartGame(room.gameState);
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        room.gameState = startRound(room.gameState);
        room.scoreResults = [];
        room.finishedGuessers = new Set();
        break;
      }

      // --- After seeing roles, advance to number selection ---
      case GameActionTypes.ROLE_CONTINUE: {
        const validation = validatePhaseAction(room.gameState.phase, ["role-assignment"], "roleContinue");
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        room.gameState = advancePhase(room.gameState);
        break;
      }

      // --- Player submits their secret number ---
      case GameActionTypes.SUBMIT_NUMBER: {
        const validation = validateSubmitNumber(room.gameState, socket.id, payload);
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        const number = (payload as { number: number }).number;
        const updated = submitSecretNumber(room.gameState, socket.id, number);
        // Auto-advance when ALL players have submitted
        room.gameState = allPlayersReady(updated)
          ? advancePhase(updated)
          : updated;
        break;
      }

      // --- Guesser submits the action prompt ---
      case GameActionTypes.SUBMIT_PROMPT: {
        const validation = validateSubmitPrompt(room.gameState, socket.id, payload);
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        const prompt = (payload as { prompt: string }).prompt;
        room.gameState = advancePhase(
          submitActionPrompt(room.gameState, socket.id, prompt)
        );
        break;
      }

      // --- Actor finishes performing ---
      case GameActionTypes.COMPLETE_PERFORMANCE: {
        const validation = validateCompletePerformance(room.gameState, payload);
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        const actorId = (payload as { actorId: string }).actorId;
        room.gameState = completePerformance(room.gameState, actorId);
        break;
      }

      // --- Player/guesser submits a guess ---
      case GameActionTypes.SUBMIT_GUESS: {
        const validation = validateSubmitGuess(room.gameState, socket.id, payload);
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        const { actorId, guessedNumber } = payload as {
          actorId: string;
          guessedNumber: number;
        };
        room.gameState = submitGuess(
          room.gameState,
          socket.id,
          actorId,
          guessedNumber
        );
        break;
      }

      // --- Player finishes guessing (ready to proceed) ---
      case GameActionTypes.FINISH_GUESSING: {
        const validation = validateFinishGuessing(room.gameState, socket.id);
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        room.finishedGuessers.add(socket.id);

        // Check if ALL eligible players have finished
        const round = room.gameState.currentRound;
        if (round) {
          const eligible = room.gameState.players.filter(
            (p) => p.id !== round.guesserId && !round.actorIds.includes(p.id)
          );
          if (eligible.every((p) => room.finishedGuessers.has(p.id))) {
            room.gameState = advancePhase(room.gameState);
          }
        }
        break;
      }

      // --- Guesser finalizes their review → reveal + scoring ---
      case GameActionTypes.FINALIZE_GUESSER_REVIEW: {
        const validation = validatePhaseAction(room.gameState.phase, ["guesser-review"], "finalizeGuesserReview");
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        const withReveal = advancePhase(room.gameState);
        const scored = calculateScores(withReveal);
        room.scoreResults = scored.results;
        room.gameState = scored.state;
        break;
      }

      // --- After reveal, continue to next round (or game over) ---
      case GameActionTypes.REVEAL_CONTINUE: {
        const validation = validatePhaseAction(room.gameState.phase, ["reveal"], "revealContinue");
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        room.finishedGuessers = new Set();
        const toScoring = advancePhase(room.gameState);
        const afterScoring = advancePhase(toScoring);
        if (afterScoring.phase === "game-over") {
          room.gameState = afterScoring;
        } else {
          room.gameState = startRound(afterScoring);
        }
        break;
      }

      // --- Play again: reset everything but keep players ---
      case GameActionTypes.PLAY_AGAIN: {
        const validation = validatePhaseAction(room.gameState.phase, ["game-over"], "playAgain");
        if (!validation.valid) {
          logError(`Validation failed: ${validation.error}`);
          return;
        }
        const players = room.gameState.players.map((p) => ({
          ...p,
          score: 0,
          role: "player" as const,
        }));
        const settings = room.gameState.settings;

        // Re-initialize using the engine
        let freshState = initGame(room.id, players[0]);
        for (let i = 1; i < players.length; i++) {
          freshState = addPlayer(freshState, players[i]);
        }
        freshState.settings = settings;

        room.gameState = freshState;
        room.scoreResults = [];
        room.finishedGuessers = new Set();
        break;
      }

      default:
        logError(`Unknown action type: ${type}`);
        return; // Don't broadcast for unknown actions
    }

    // 💡 After EVERY valid action, broadcast the updated state
    // to all players. This is the core multiplayer loop:
    // receive action → validate → process → broadcast result
    broadcastState(room);
  });

  // ----------------------------------------------------------
  // DISCONNECT (with proper room cleanup)
  // ----------------------------------------------------------
  // 💡 This fires when a player's connection drops (close tab,
  // lose internet, etc.). We clean up their data so the game
  // can continue without them.
  //
  // Cleanup steps:
  // 1. Remove player from socketToRoom mapping
  // 2. Remove player from the game state using the engine
  // 3. Remove from finishedGuessers set (if applicable)
  // 4. If room is empty → delete the room entirely
  // 5. Otherwise → broadcast updated state to remaining players
  // ----------------------------------------------------------
  socket.on("disconnect", () => {
    const roomCode = socketToRoom.get(socket.id);
    socketToRoom.delete(socket.id);

    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room) {
        const player = room.gameState.players.find((p) => p.id === socket.id);
        const playerName = player?.name ?? "Unknown";

        logPlayerEvent(playerName, `Disconnected from room ${roomCode}`);

        // Remove the player using the engine
        room.gameState = removePlayer(room.gameState, socket.id);

        // Also clean up the finishedGuessers tracking
        room.finishedGuessers.delete(socket.id);

        // Clean up empty rooms to prevent memory leaks
        if (room.gameState.players.length === 0) {
          rooms.delete(roomCode);
          logRoomEvent(roomCode, "Deleted (no players remaining)");
        } else {
          // Let remaining players know someone left
          logRoomEvent(roomCode, `${room.gameState.players.length} players remaining`);
          broadcastState(room);
        }
      }
    }

    logServer(`Player disconnected: ${socket.id}`);
  });
});

// ============================================================
// START THE SERVER
// ============================================================

httpServer.listen(PORT, () => {
  logServer(`Loaf Server is running on port ${PORT}`);
  logServer(`HTTP:      http://localhost:${PORT}`);
  logServer(`WebSocket: ws://localhost:${PORT}`);
  logServer(`Health:    http://localhost:${PORT}/health`);
});
