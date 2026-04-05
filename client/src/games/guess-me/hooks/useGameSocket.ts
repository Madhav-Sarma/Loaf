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
// Security posture:
// - In production: VITE_SERVER_URL MUST be explicitly set.
// - In development: fallback to localhost is allowed for convenience.
const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.trim();
const isDev = import.meta.env.DEV;

if (!configuredServerUrl && !isDev) {
  throw new Error("Missing required env var: VITE_SERVER_URL");
}

const SERVER_URL = configuredServerUrl || "http://localhost:3001";

const ROOM_SESSION_STORAGE_KEY = "guess-me:room-session";
const ROOM_SESSION_MAX_AGE_MS = 10 * 60 * 1000;

if (!configuredServerUrl && isDev) {
  console.warn(
    "VITE_SERVER_URL is not set. Falling back to http://localhost:3001 for local development."
  );
}

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
  const roomCodeRef = useRef<string | null>(null);
  const playerNameRef = useRef<string | null>(null);
  const isResumingRef = useRef(false);

  // Game state (updated whenever the server broadcasts)
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [scoreResults, setScoreResults] = useState<ScoreResult[]>([]);

  const saveRoomSession = useCallback((nextRoomCode: string, nextPlayerName: string) => {
    const normalizedRoomCode = nextRoomCode.toUpperCase();
    const trimmedPlayerName = nextPlayerName.trim();

    roomCodeRef.current = normalizedRoomCode;
    playerNameRef.current = trimmedPlayerName;
    setRoomCode(normalizedRoomCode);

    try {
      window.localStorage.setItem(
        ROOM_SESSION_STORAGE_KEY,
        JSON.stringify({
          roomCode: normalizedRoomCode,
          playerName: trimmedPlayerName,
          savedAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }, []);

  const clearRoomSession = useCallback(() => {
    roomCodeRef.current = null;
    playerNameRef.current = null;
    setRoomCode(null);

    try {
      window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // ============================================================
  // SOCKET CONNECTION (runs once on mount)
  // ============================================================
  useEffect(() => {
    try {
      const rawSession = window.localStorage.getItem(ROOM_SESSION_STORAGE_KEY);
      if (rawSession) {
        const parsedSession = JSON.parse(rawSession) as {
          roomCode?: string;
          playerName?: string;
          savedAt?: number;
        };

        const cachedRoomCode =
          typeof parsedSession.roomCode === "string"
            ? parsedSession.roomCode.trim().toUpperCase()
            : "";
        const cachedPlayerName =
          typeof parsedSession.playerName === "string"
            ? parsedSession.playerName.trim()
            : "";
        const cachedSavedAt =
          typeof parsedSession.savedAt === "number"
            ? parsedSession.savedAt
            : 0;

        const isValidSession =
          cachedRoomCode.length > 0 &&
          cachedPlayerName.length > 0 &&
          Date.now() - cachedSavedAt <= ROOM_SESSION_MAX_AGE_MS;

        if (isValidSession) {
          roomCodeRef.current = cachedRoomCode;
          playerNameRef.current = cachedPlayerName;
          setRoomCode(cachedRoomCode);
        } else {
          window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
        }
      }
    } catch {
      // Ignore invalid session payloads.
    }

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

      if (roomCodeRef.current) {
        if (socket.recovered) {
          setConnectionState("in-room");
          setError(null);
        } else {
          const savedPlayerName = playerNameRef.current;
          const savedRoomCode = roomCodeRef.current;

          if (!savedPlayerName || isResumingRef.current) {
            clearRoomSession();
            setGameState(null);
            setScoreResults([]);
            setConnectionState("connected");
            setError("Room session expired. Join your room again.");
            return;
          }

          isResumingRef.current = true;
          setConnectionState("joining");
          setError("Reconnecting to your room...");

          socket.emit(
            RoomEvents.JOIN,
            { roomCode: savedRoomCode, playerName: savedPlayerName },
            (response: { success: boolean; gameState?: GameState; error?: string }) => {
              isResumingRef.current = false;

              if (response.success && response.gameState) {
                saveRoomSession(savedRoomCode, savedPlayerName);
                setGameState(response.gameState);
                setConnectionState("in-room");
                setError(null);
              } else {
                clearRoomSession();
                setGameState(null);
                setScoreResults([]);
                setConnectionState("connected");
                setError(response.error ?? "Could not restore your previous room.");
              }
            }
          );
        }
        return;
      }

      setConnectionState("connected");
      setError(null);
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected from server:", reason);

      // If we were already in a room, keep game UI mounted while
      // Socket.IO tries to recover automatically.
      if (roomCodeRef.current) {
        setError("Connection lost. Reconnecting...");
        return;
      }

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
      if (playerNameRef.current) {
        saveRoomSession(data.gameState.roomId, playerNameRef.current);
      } else {
        roomCodeRef.current = data.gameState.roomId;
        setRoomCode(data.gameState.roomId);
      }
      setGameState(data.gameState);
      setScoreResults(data.scoreResults ?? []);
      setConnectionState("in-room");
      setError(null);
    });

    // 💡 Cleanup function — runs when the component unmounts.
    // We disconnect the socket to prevent memory leaks and
    // ghost connections on the server.
    return () => {
      isResumingRef.current = false;
      socket.disconnect();
    };
  }, [clearRoomSession, saveRoomSession]);

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

    const trimmedPlayerName = playerName.trim();
    if (!trimmedPlayerName) return;

    setConnectionState("joining");
    setError(null);

    // 💡 The third argument is an "acknowledgment callback."
    // Socket.IO will call this function with the server's response.
    // It's like fetch().then(response => ...) but over WebSocket!
    socket.emit(
      RoomEvents.CREATE,
      { playerName: trimmedPlayerName },
      (response: { success: boolean; roomCode?: string; gameState?: GameState; error?: string }) => {
        if (response.success && response.roomCode && response.gameState) {
          saveRoomSession(response.roomCode, trimmedPlayerName);
          setGameState(response.gameState);
          setConnectionState("in-room");
        } else {
          setError(response.error ?? "Failed to create room.");
          setConnectionState("connected");
        }
      }
    );
  }, [saveRoomSession]);

  const joinRoom = useCallback((code: string, playerName: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    const trimmedPlayerName = playerName.trim();
    const normalizedCode = code.trim().toUpperCase();
    if (!trimmedPlayerName || !normalizedCode) return;

    setConnectionState("joining");
    setError(null);

    socket.emit(
      RoomEvents.JOIN,
      { roomCode: normalizedCode, playerName: trimmedPlayerName },
      (response: { success: boolean; gameState?: GameState; error?: string }) => {
        if (response.success && response.gameState) {
          saveRoomSession(normalizedCode, trimmedPlayerName);
          setGameState(response.gameState);
          setConnectionState("in-room");
        } else {
          setError(response.error ?? "Failed to join room.");
          setConnectionState("connected");
        }
      }
    );
  }, [saveRoomSession]);

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
