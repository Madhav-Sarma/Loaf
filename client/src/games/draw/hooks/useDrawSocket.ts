import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import {
  DrawActionTypes,
  DrawGameEvents,
  DrawRoomEvents,
} from "../../../../../shared/socketEvents";
import type {
  DrawActionEnvelope,
  DrawRoomAck,
  DrawRoomPublicState,
  DrawSettings,
  DrawStroke,
  DrawStrokeActionPayload,
} from "../../../../../shared/draw/types";

const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.trim();
const isDev = import.meta.env.DEV;

if (!configuredServerUrl && !isDev) {
  throw new Error("Missing required env var: VITE_SERVER_URL");
}

const SERVER_URL = configuredServerUrl || "http://localhost:3001";
const DRAW_NAMESPACE_URL = `${SERVER_URL}/draw`;
const DRAW_SESSION_KEY = "draw:session-id";
const DRAW_ROOM_KEY = "draw:room-session";
const DRAW_ROOM_MAX_AGE_MS = 30 * 60 * 1000;

type ConnectionState = "disconnected" | "connected" | "joining" | "in-room";

interface StoredRoomSession {
  roomCode: string;
  playerName: string;
  savedAt: number;
}

interface UseDrawSocketReturn {
  sessionId: string;
  connectionState: ConnectionState;
  roomCode: string | null;
  error: string | null;
  state: DrawRoomPublicState | null;
  createRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  leaveRoom: () => void;
  updateSettings: (settings: Partial<DrawSettings>) => void;
  startGame: () => void;
  pickWord: (word: string) => void;
  submitGuess: (text: string) => void;
  sendMessage: (text: string) => void;
  clearCanvas: () => void;
  skipTurn: () => void;
  sendStroke: (delta: DrawStrokeActionPayload) => void;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`;
}

function loadSessionId(): string {
  try {
    const existing = window.localStorage.getItem(DRAW_SESSION_KEY);
    if (existing) {
      return existing;
    }

    const nextId = createSessionId();
    window.localStorage.setItem(DRAW_SESSION_KEY, nextId);
    return nextId;
  } catch {
    return createSessionId();
  }
}

function normalizeRoomCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 20);
}

function normalizeMessage(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 56);
}

function mergeStroke(strokes: DrawStroke[], delta: DrawStrokeActionPayload): DrawStroke[] {
  const next = [...strokes];
  const existingIndex = next.findIndex((stroke) => stroke.id === delta.strokeId);

  if (delta.isStart || existingIndex === -1) {
    next.push({
      id: delta.strokeId,
      tool: delta.tool,
      color: delta.color,
      size: delta.size,
      points: [delta.point],
    });

    return next;
  }

  const stroke = next[existingIndex];
  next[existingIndex] = {
    ...stroke,
    points: [...stroke.points, delta.point],
  };

  return next;
}

export function useDrawSocket(): UseDrawSocketReturn {
  const sessionId = useMemo(loadSessionId, []);
  const socketRef = useRef<Socket | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  const playerNameRef = useRef<string | null>(null);
  const resumingRef = useRef(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DrawRoomPublicState | null>(null);

  const saveRoomSession = useCallback((nextRoomCode: string, nextPlayerName: string) => {
    const normalizedRoomCode = normalizeRoomCode(nextRoomCode);
    const normalizedPlayerName = normalizeName(nextPlayerName);

    roomCodeRef.current = normalizedRoomCode;
    playerNameRef.current = normalizedPlayerName;
    setRoomCode(normalizedRoomCode);

    try {
      const payload: StoredRoomSession = {
        roomCode: normalizedRoomCode,
        playerName: normalizedPlayerName,
        savedAt: Date.now(),
      };

      window.localStorage.setItem(DRAW_ROOM_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const clearRoomSession = useCallback(() => {
    roomCodeRef.current = null;
    playerNameRef.current = null;
    setRoomCode(null);

    try {
      window.localStorage.removeItem(DRAW_ROOM_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    try {
      const rawSession = window.localStorage.getItem(DRAW_ROOM_KEY);
      if (rawSession) {
        const parsedSession = JSON.parse(rawSession) as StoredRoomSession;
        const normalizedCode = normalizeRoomCode(parsedSession.roomCode ?? "");
        const normalizedName = normalizeName(parsedSession.playerName ?? "");
        const savedAt = Number(parsedSession.savedAt ?? 0);

        const isValid =
          normalizedCode.length > 0 &&
          normalizedName.length > 0 &&
          Date.now() - savedAt <= DRAW_ROOM_MAX_AGE_MS;

        if (isValid) {
          roomCodeRef.current = normalizedCode;
          playerNameRef.current = normalizedName;
          setRoomCode(normalizedCode);
        } else {
          window.localStorage.removeItem(DRAW_ROOM_KEY);
        }
      }
    } catch {
      // Ignore invalid session payloads.
    }

    const socket = io(DRAW_NAMESPACE_URL, {
      transports: ["websocket"],
      upgrade: false,
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 350,
      reconnectionDelayMax: 2_000,
      timeout: 10_000,
    });
    socketRef.current = socket;

    const connectTimer = window.setTimeout(() => {
      socket.connect();
    }, 0);

    socket.on("connect", () => {
      if (roomCodeRef.current && playerNameRef.current && !resumingRef.current) {
        resumingRef.current = true;
        setConnectionState("joining");
        setError("Reconnecting to room...");

        socket.emit(
          DrawRoomEvents.JOIN,
          {
            roomCode: roomCodeRef.current,
            playerName: playerNameRef.current,
            sessionId,
          },
          (response: DrawRoomAck) => {
            resumingRef.current = false;

            if (!response.success) {
              clearRoomSession();
              setState(null);
              setConnectionState("connected");
              setError(response.error);
              return;
            }

            saveRoomSession(response.roomCode, playerNameRef.current ?? "");
            setState(response.state);
            setConnectionState("in-room");
            setError(null);
          }
        );

        return;
      }

      setConnectionState("connected");
      setError(null);
    });

    socket.on("disconnect", () => {
      if (roomCodeRef.current) {
        setError("Connection lost. Reconnecting...");
        return;
      }

      setConnectionState("disconnected");
    });

    socket.on("connect_error", () => {
      setError("Could not connect to draw server.");
    });

    socket.on(DrawGameEvents.ERROR, ({ message }: { message: string }) => {
      setError(message);
    });

    socket.on(DrawGameEvents.STATE, (nextState: DrawRoomPublicState) => {
      setState(nextState);
      setConnectionState("in-room");
      setError(null);

      const me = nextState.players.find((player) => player.sessionId === sessionId);
      if (me) {
        saveRoomSession(nextState.roomCode, me.name);
      } else {
        setRoomCode(nextState.roomCode);
      }
    });

    socket.on(
      DrawGameEvents.STROKE,
      ({ delta }: { playerId: string; delta: DrawStrokeActionPayload }) => {
        setState((previous) => {
          if (!previous?.turn) {
            return previous;
          }

          return {
            ...previous,
            turn: {
              ...previous.turn,
              strokes: mergeStroke(previous.turn.strokes, delta),
            },
          };
        });
      }
    );

    return () => {
      window.clearTimeout(connectTimer);
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [clearRoomSession, saveRoomSession, sessionId]);

  const emitAction = useCallback(
    <T extends DrawActionEnvelope["type"]>(type: T, payload: DrawActionEnvelope["payload"]) => {
      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      const envelope: DrawActionEnvelope = {
        type,
        payload,
      };

      socket.emit(DrawGameEvents.ACTION, envelope);
    },
    []
  );

  const createRoom = useCallback(
    (name: string) => {
      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      const normalizedName = normalizeName(name);
      if (!normalizedName) {
        setError("Please enter a name.");
        return;
      }

      setConnectionState("joining");
      setError(null);

      socket.emit(
        DrawRoomEvents.CREATE,
        {
          playerName: normalizedName,
          sessionId,
        },
        (response: DrawRoomAck) => {
          if (!response.success) {
            setConnectionState("connected");
            setError(response.error);
            return;
          }

          saveRoomSession(response.roomCode, normalizedName);
          setState(response.state);
          setConnectionState("in-room");
          setError(null);
        }
      );
    },
    [saveRoomSession, sessionId]
  );

  const joinRoom = useCallback(
    (code: string, name: string) => {
      const socket = socketRef.current;
      if (!socket) {
        return;
      }

      const normalizedCode = normalizeRoomCode(code);
      const normalizedName = normalizeName(name);
      if (!normalizedCode || !normalizedName) {
        setError("Room code and name are required.");
        return;
      }

      setConnectionState("joining");
      setError(null);

      socket.emit(
        DrawRoomEvents.JOIN,
        {
          roomCode: normalizedCode,
          playerName: normalizedName,
          sessionId,
        },
        (response: DrawRoomAck) => {
          if (!response.success) {
            setConnectionState("connected");
            setError(response.error);
            return;
          }

          saveRoomSession(response.roomCode, normalizedName);
          setState(response.state);
          setConnectionState("in-room");
          setError(null);
        }
      );
    },
    [saveRoomSession, sessionId]
  );

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit(DrawRoomEvents.LEAVE);
    clearRoomSession();
    setState(null);
    setConnectionState("connected");
    setError(null);
  }, [clearRoomSession]);

  return {
    sessionId,
    connectionState,
    roomCode,
    error,
    state,
    createRoom,
    joinRoom,
    leaveRoom,
    updateSettings: (settings) => emitAction(DrawActionTypes.UPDATE_SETTINGS, settings),
    startGame: () => emitAction(DrawActionTypes.START_GAME, {}),
    pickWord: (word) => emitAction(DrawActionTypes.PICK_WORD, { word }),
    submitGuess: (text) => {
      const normalized = normalizeMessage(text);
      if (!normalized) {
        return;
      }

      emitAction(DrawActionTypes.SUBMIT_GUESS, { text: normalized });
    },
    sendMessage: (text) => {
      const normalized = normalizeMessage(text);
      if (!normalized) {
        return;
      }

      emitAction(DrawActionTypes.SEND_MESSAGE, { text: normalized });
    },
    clearCanvas: () => emitAction(DrawActionTypes.CLEAR_CANVAS, {}),
    skipTurn: () => emitAction(DrawActionTypes.SKIP_TURN, {}),
    sendStroke: (delta) => emitAction(DrawActionTypes.STROKE, delta),
  };
}
