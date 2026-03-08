// ============================================================
// useGameSocket.ts — Socket.IO connection hook for Guess Me
// ============================================================
//
// 💡 WHAT IS A CUSTOM HOOK?
// A custom hook is a function that starts with "use" and can
// call other React hooks (useState, useEffect, etc.). It lets
// you extract reusable stateful logic out of components.
//
// This hook manages:
// 1. Connecting to the Loaf server via Socket.IO
// 2. Creating and joining rooms
// 3. Sending game actions to the server
// 4. Receiving game state updates from the server
//
// 💡 WHY A HOOK AND NOT JUST RAW SOCKET CODE IN APP.TSX?
// Separation of concerns! The hook handles all the networking
// complexity, and components just call simple functions like
// submitNumber(5). Components don't need to know about sockets.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { GameState, GameSettings, ScoreResult } from "../engine/gameTypes";

// 💡 Import shared socket event constants so client and server
// always use the exact same event names — no string typos!
import { RoomEvents, GameEvents, GameActionTypes } from "../../../../../shared/socketEvents";

// 💡 Server URL for Socket.IO connection.
// In development: connect directly to localhost:3001
// In production: you'd set VITE_SERVER_URL to your deployed server URL
// (e.g., "https://loaf-server.railway.app")
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

// 💡 Connection states — the app shows different UI based on these.
// Using a union type makes it impossible to set an invalid state.
type ConnectionState =
  | "disconnected"   // no connection to server
  | "connected"      // connected but not in a room yet
  | "joining"        // in the process of creating/joining a room
  | "in-room";       // successfully in a room, ready to play

// 💡 This interface defines everything the hook returns.
// Components destructure the return value to get what they need:
//   const { gameState, submitNumber, ... } = useGameSocket();
interface UseGameSocketReturn {
  // Connection info
  connectionState: ConnectionState;
  playerId: string | null;
  roomCode: string | null;
  error: string | null;

  // Game state (received from server)
  gameState: GameState | null;
  scoreResults: ScoreResult[];

  // Room actions
  createRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;

  // Game actions — each maps to a server-side engine function
  startGame: () => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  roleContinue: () => void;
  submitNumber: (number: number) => void;
  submitPrompt: (prompt: string) => void;
  completePerformance: (actorId: string) => void;
  submitGuess: (actorId: string, guessedNumber: number) => void;
  finishGuessing: () => void;
  finalizeGuesserReview: () => void;
  revealContinue: () => void;
  playAgain: () => void;
}

export function useGameSocket(): UseGameSocketReturn {
  // 💡 useRef is used for the socket because:
  // 1. We don't want React to re-render when the socket changes
  // 2. We need the SAME socket instance across all renders
  // 3. Refs persist across renders without triggering re-renders
  const socketRef = useRef<Socket | null>(null);

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Game state (updated whenever the server broadcasts)
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [scoreResults, setScoreResults] = useState<ScoreResult[]>([]);

  // ============================================================
  // SOCKET CONNECTION (runs once on mount)
  // ============================================================
  useEffect(() => {
    // 💡 io() creates a Socket.IO client connection.
    // By default, it:
    // - Connects immediately (autoConnect: true)
    // - Reconnects automatically if disconnected
    // - Uses WebSocket with HTTP long-polling as fallback
    const socket = io(SERVER_URL);

    socketRef.current = socket;

    // --- Connection Events ---

    socket.on("connect", () => {
      console.log("🔌 Connected to server:", socket.id);
      setPlayerId(socket.id ?? null);
      setConnectionState("connected");
      setError(null);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Disconnected from server");
      setConnectionState("disconnected");
    });

    // 💡 "connect_error" fires when the initial connection fails
    // or when a reconnection attempt fails. Common causes:
    // - Server isn't running
    // - Wrong URL
    // - CORS misconfigured
    socket.on("connect_error", (err) => {
      console.error("🔌 Connection error:", err.message);
      setError("Can't connect to server. Is it running?");
    });

    // --- Game State Updates ---
    // 💡 The server emits GameEvents.STATE after every action.
    // This is the ONLY way the client gets game state —
    // it never computes state locally. The server is the
    // single source of truth.
    socket.on(GameEvents.STATE, (data: { gameState: GameState; scoreResults: ScoreResult[] }) => {
      setGameState(data.gameState);
      setScoreResults(data.scoreResults ?? []);
    });

    // 💡 Cleanup function — runs when the component unmounts.
    // We disconnect the socket to prevent memory leaks and
    // ghost connections on the server.
    return () => {
      socket.disconnect();
    };
  }, []); // Empty dependency array = runs once on mount

  // ============================================================
  // HELPER: Emit a game action to the server
  // ============================================================
  // 💡 useCallback prevents creating a new function on every render.
  // Since emitAction is passed to child components (indirectly),
  // this avoids unnecessary re-renders of those children.
  const emitAction = useCallback((type: string, payload?: Record<string, unknown>) => {
    socketRef.current?.emit(GameEvents.ACTION, { type, payload });
  }, []);

  // ============================================================
  // ROOM ACTIONS
  // ============================================================

  const createRoom = useCallback((playerName: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    setConnectionState("joining");
    setError(null);

    // 💡 The third argument is an "acknowledgment callback."
    // Socket.IO will call this function with the server's response.
    // It's like fetch().then(response => ...) but over WebSocket!
    socket.emit(
      RoomEvents.CREATE,
      { playerName },
      (response: { success: boolean; roomCode?: string; gameState?: GameState; error?: string }) => {
        if (response.success && response.roomCode && response.gameState) {
          setRoomCode(response.roomCode);
          setGameState(response.gameState);
          setConnectionState("in-room");
        } else {
          setError(response.error ?? "Failed to create room.");
          setConnectionState("connected");
        }
      }
    );
  }, []);

  const joinRoom = useCallback((code: string, playerName: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    setConnectionState("joining");
    setError(null);

    socket.emit(
      RoomEvents.JOIN,
      { roomCode: code, playerName },
      (response: { success: boolean; gameState?: GameState; error?: string }) => {
        if (response.success && response.gameState) {
          setRoomCode(code.toUpperCase());
          setGameState(response.gameState);
          setConnectionState("in-room");
        } else {
          setError(response.error ?? "Failed to join room.");
          setConnectionState("connected");
        }
      }
    );
  }, []);

  // ============================================================
  // RETURN — All state and actions the component needs
  // ============================================================
  // 💡 Each game action is a thin wrapper around emitAction.
  // The component calls submitNumber(5), which sends:
  //   { type: "submitNumber", payload: { number: 5 } }
  // to the server. The server processes it and broadcasts the result.
  return {
    connectionState,
    playerId,
    roomCode,
    error,
    gameState,
    scoreResults,
    createRoom,
    joinRoom,
    startGame: () => emitAction(GameActionTypes.START_GAME),
    updateSettings: (settings) => emitAction(GameActionTypes.UPDATE_SETTINGS, settings as Record<string, unknown>),
    roleContinue: () => emitAction(GameActionTypes.ROLE_CONTINUE),
    submitNumber: (number) => emitAction(GameActionTypes.SUBMIT_NUMBER, { number }),
    submitPrompt: (prompt) => emitAction(GameActionTypes.SUBMIT_PROMPT, { prompt }),
    completePerformance: (actorId) => emitAction(GameActionTypes.COMPLETE_PERFORMANCE, { actorId }),
    submitGuess: (actorId, guessedNumber) => emitAction(GameActionTypes.SUBMIT_GUESS, { actorId, guessedNumber }),
    finishGuessing: () => emitAction(GameActionTypes.FINISH_GUESSING),
    finalizeGuesserReview: () => emitAction(GameActionTypes.FINALIZE_GUESSER_REVIEW),
    revealContinue: () => emitAction(GameActionTypes.REVEAL_CONTINUE),
    playAgain: () => emitAction(GameActionTypes.PLAY_AGAIN),
  };
}
