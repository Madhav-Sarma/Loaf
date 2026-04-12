import type { Server, Socket } from "socket.io";
import {
  DrawActionTypes,
  DrawGameEvents,
  DrawRoomEvents,
} from "../../../shared/socketEvents.js";
import {
  DRAW_GAME_VERSION,
  createDefaultDrawSettings,
  type DrawActionEnvelope,
  type DrawChatMessage,
  type DrawPhase,
  type DrawPlayer,
  type DrawRoomAck,
  type DrawRoomCreatePayload,
  type DrawRoomJoinPayload,
  type DrawRoomPublicState,
  type DrawSettings,
  type DrawStroke,
  type DrawStrokeActionPayload,
  type DrawTurnPublicState,
} from "../../../shared/draw/types.js";
import { pickRandomWords } from "./wordBank.js";
import { logError, logPlayerEvent, logRoomEvent, logServer } from "../../logger.js";

interface InternalPlayer extends DrawPlayer {
  socketId: string;
  joinedAt: number;
}

interface InternalTurnState {
  turnNumber: number;
  roundNumber: number;
  artistId: string;
  wordOptions: string[];
  secretWord: string | null;
  wordLength: number;
  revealedMask: string;
  revealedIndexes: Set<number>;
  phaseEndsAt: number | null;
  strokes: DrawStroke[];
  guessedPlayerIds: string[];
  clearCount: number;
}

interface DrawRoomInternal {
  code: string;
  phase: DrawPhase;
  hostId: string;
  players: InternalPlayer[];
  settings: DrawSettings;
  roundNumber: number;
  turnNumber: number;
  totalTurns: number;
  turn: InternalTurnState | null;
  messages: DrawChatMessage[];
  startedAt: number | null;
  winnerIds: string[];
  disconnectTimers: Map<string, NodeJS.Timeout>;
  pickTimer: NodeJS.Timeout | null;
  turnTimer: NodeJS.Timeout | null;
  hintTimers: NodeJS.Timeout[];
  revealTimer: NodeJS.Timeout | null;
}

interface DrawMembership {
  roomCode: string;
  playerId: string;
}

interface DrawModuleOptions {
  disconnectGraceMs?: number;
}

const rooms = new Map<string, DrawRoomInternal>();
const socketToMembership = new Map<string, DrawMembership>();

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_MESSAGES = 80;
const MAX_MESSAGE_LENGTH = 56;
const MAX_STROKES = 320;
const MAX_POINTS_PER_STROKE = 260;
const ROUND_REVEAL_MS = 6500;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePlayerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 20);
}

function normalizeSessionId(value: string): string {
  return value.trim().slice(0, 100);
}

function normalizeMessageText(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_MESSAGE_LENGTH);
}

function normalizeGuess(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function countLetters(value: string): number {
  return Array.from(value).filter((char) => /[a-z]/i.test(char)).length;
}

function generateRoomCode(): string {
  let candidate = "";

  while (candidate.length === 0 || rooms.has(candidate)) {
    let nextCode = "";

    for (let index = 0; index < 6; index += 1) {
      const randomIndex = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
      nextCode += ROOM_CODE_ALPHABET[randomIndex];
    }

    candidate = nextCode;
  }

  return candidate;
}

function sanitizeSettings(input: Partial<DrawSettings> | undefined, base: DrawSettings): DrawSettings {
  return {
    totalRounds: clamp(Math.round(toFiniteNumber(input?.totalRounds, base.totalRounds)), 1, 8),
    drawTimeSec: clamp(Math.round(toFiniteNumber(input?.drawTimeSec, base.drawTimeSec)), 30, 180),
    pickTimeSec: clamp(Math.round(toFiniteNumber(input?.pickTimeSec, base.pickTimeSec)), 8, 30),
    maxPlayers: clamp(Math.round(toFiniteNumber(input?.maxPlayers, base.maxPlayers)), 2, 12),
    hintCount: clamp(Math.round(toFiniteNumber(input?.hintCount, base.hintCount)), 0, 4),
    maxScorePerTurn: clamp(
      Math.round(toFiniteNumber(input?.maxScorePerTurn, base.maxScorePerTurn)),
      60,
      240
    ),
  };
}

function messageId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function buildMask(word: string, revealedIndexes: Set<number>): string {
  const mask = Array.from(word).map((char, index) => {
    if (!/[a-z]/i.test(char)) {
      return char;
    }

    if (revealedIndexes.has(index)) {
      return char.toUpperCase();
    }

    return "_";
  });

  return mask.join(" ");
}

function pushMessage(
  room: DrawRoomInternal,
  kind: DrawChatMessage["kind"],
  text: string,
  playerId: string | null,
  playerName: string
): void {
  const message: DrawChatMessage = {
    id: messageId(),
    playerId,
    playerName,
    kind,
    text,
    createdAt: Date.now(),
  };

  room.messages.push(message);

  if (room.messages.length > MAX_MESSAGES) {
    room.messages.splice(0, room.messages.length - MAX_MESSAGES);
  }
}

function ensureHost(room: DrawRoomInternal, requireConnected = false): void {
  if (room.players.length === 0) {
    return;
  }

  const existingHost = room.players.find((player) => player.id === room.hostId);

  if (existingHost && (!requireConnected || existingHost.connected)) {
    room.players = room.players.map((player) => ({
      ...player,
      isHost: player.id === existingHost.id,
    }));
    return;
  }

  const fallbackHost = room.players.find((player) => player.connected) ?? room.players[0];
  room.hostId = fallbackHost.id;
  room.players = room.players.map((player) => ({
    ...player,
    isHost: player.id === fallbackHost.id,
  }));
}

function clearPickTimer(room: DrawRoomInternal): void {
  if (room.pickTimer) {
    clearTimeout(room.pickTimer);
    room.pickTimer = null;
  }
}

function clearTurnTimer(room: DrawRoomInternal): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function clearRevealTimer(room: DrawRoomInternal): void {
  if (room.revealTimer) {
    clearTimeout(room.revealTimer);
    room.revealTimer = null;
  }
}

function clearHintTimers(room: DrawRoomInternal): void {
  for (const timer of room.hintTimers) {
    clearTimeout(timer);
  }
  room.hintTimers = [];
}

function clearAllTimers(room: DrawRoomInternal): void {
  clearPickTimer(room);
  clearTurnTimer(room);
  clearRevealTimer(room);
  clearHintTimers(room);

  for (const [, timer] of room.disconnectTimers.entries()) {
    clearTimeout(timer);
  }

  room.disconnectTimers.clear();
}

function getConnectedPlayers(room: DrawRoomInternal): InternalPlayer[] {
  return room.players.filter((player) => player.connected);
}

function getConnectedGuessers(room: DrawRoomInternal): InternalPlayer[] {
  if (!room.turn) {
    return [];
  }

  return room.players.filter(
    (player) => player.connected && player.id !== room.turn?.artistId
  );
}

function isCorrectGuess(turn: InternalTurnState, guessText: string): boolean {
  if (!turn.secretWord) {
    return false;
  }

  return normalizeGuess(guessText) === normalizeGuess(turn.secretWord);
}

function getAvailableHintIndexes(turn: InternalTurnState): number[] {
  if (!turn.secretWord) {
    return [];
  }

  const hidden: number[] = [];

  Array.from(turn.secretWord).forEach((char, index) => {
    if (!/[a-z]/i.test(char)) {
      return;
    }

    if (!turn.revealedIndexes.has(index)) {
      hidden.push(index);
    }
  });

  return hidden;
}

function buildPublicTurn(turn: InternalTurnState, phase: DrawPhase, viewerId: string): DrawTurnPublicState {
  const canSeeOptions = phase === "word-select" && viewerId === turn.artistId;
  const canSeeWord =
    phase === "round-reveal" || phase === "game-over" || viewerId === turn.artistId;

  return {
    turnNumber: turn.turnNumber,
    roundNumber: turn.roundNumber,
    artistId: turn.artistId,
    wordLength: turn.wordLength,
    revealedMask: turn.revealedMask,
    phaseEndsAt: turn.phaseEndsAt,
    strokes: turn.strokes,
    guessedPlayerIds: turn.guessedPlayerIds,
    wordOptions: canSeeOptions ? turn.wordOptions : null,
    hasWordChoice: Boolean(turn.secretWord),
    revealedWord: canSeeWord ? turn.secretWord : null,
    clearCount: turn.clearCount,
  };
}

function buildPublicState(room: DrawRoomInternal, viewerId: string): DrawRoomPublicState {
  return {
    version: DRAW_GAME_VERSION,
    roomCode: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((player) => ({
      id: player.id,
      sessionId: player.sessionId,
      name: player.name,
      score: player.score,
      isHost: player.id === room.hostId,
      connected: player.connected,
      hasGuessedCurrentTurn: player.hasGuessedCurrentTurn,
    })),
    settings: room.settings,
    roundNumber: room.roundNumber,
    turnNumber: room.turnNumber,
    totalTurns: room.totalTurns,
    turn: room.turn ? buildPublicTurn(room.turn, room.phase, viewerId) : null,
    messages: room.messages,
    startedAt: room.startedAt,
    winnerIds: room.winnerIds,
  };
}

function emitState(room: DrawRoomInternal, drawNamespace: ReturnType<Server["of"]>): void {
  for (const player of room.players) {
    if (!player.connected || !player.socketId) {
      continue;
    }

    drawNamespace
      .to(player.socketId)
      .emit(DrawGameEvents.STATE, buildPublicState(room, player.id));
  }
}

function emitSocketError(socket: Socket, message: string): void {
  socket.emit(DrawGameEvents.ERROR, { message });
}

function resetGuessFlags(room: DrawRoomInternal): void {
  room.players = room.players.map((player) => ({
    ...player,
    hasGuessedCurrentTurn: false,
  }));
}

function calculateWinners(players: InternalPlayer[]): string[] {
  if (players.length === 0) {
    return [];
  }

  const topScore = Math.max(...players.map((player) => player.score));
  return players.filter((player) => player.score === topScore).map((player) => player.id);
}

function finishGame(room: DrawRoomInternal, drawNamespace: ReturnType<Server["of"]>, reason?: string): void {
  clearPickTimer(room);
  clearTurnTimer(room);
  clearHintTimers(room);
  clearRevealTimer(room);

  room.phase = "game-over";
  room.winnerIds = calculateWinners(room.players);

  if (reason) {
    pushMessage(room, "system", reason, null, "System");
  }

  emitState(room, drawNamespace);
}

function startDrawingPhase(
  room: DrawRoomInternal,
  drawNamespace: ReturnType<Server["of"]>,
  word: string,
  autoPicked: boolean
): void {
  if (!room.turn) {
    return;
  }

  clearPickTimer(room);
  clearTurnTimer(room);
  clearHintTimers(room);
  clearRevealTimer(room);

  const cleanedWord = normalizeGuess(word);
  room.turn.secretWord = cleanedWord;
  room.turn.wordLength = countLetters(cleanedWord);
  room.turn.revealedIndexes = new Set<number>();
  room.turn.revealedMask = buildMask(cleanedWord, room.turn.revealedIndexes);
  room.turn.phaseEndsAt = Date.now() + room.settings.drawTimeSec * 1000;
  room.phase = "drawing";

  if (autoPicked) {
    pushMessage(room, "system", "Word auto-selected for this turn.", null, "System");
  }

  const hintCount = Math.min(room.settings.hintCount, Math.max(0, room.turn.wordLength - 1));
  const phaseDurationMs = room.settings.drawTimeSec * 1000;

  for (let hintIndex = 1; hintIndex <= hintCount; hintIndex += 1) {
    const delayMs = Math.floor((phaseDurationMs / (hintCount + 1)) * hintIndex);

    const timer = setTimeout(() => {
      if (room.phase !== "drawing" || !room.turn || !room.turn.secretWord) {
        return;
      }

      const availableIndexes = getAvailableHintIndexes(room.turn);
      if (availableIndexes.length === 0) {
        return;
      }

      const randomIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
      room.turn.revealedIndexes.add(randomIndex);
      room.turn.revealedMask = buildMask(room.turn.secretWord, room.turn.revealedIndexes);

      pushMessage(room, "system", "A letter hint was revealed.", null, "System");
      emitState(room, drawNamespace);
    }, delayMs);

    room.hintTimers.push(timer);
  }

  room.turnTimer = setTimeout(() => {
    finishTurn(room, drawNamespace, "Time is up.");
  }, phaseDurationMs);

  emitState(room, drawNamespace);
}

function allGuessersFinished(room: DrawRoomInternal): boolean {
  const activeGuessers = getConnectedGuessers(room);

  if (activeGuessers.length === 0) {
    return true;
  }

  return activeGuessers.every((player) => player.hasGuessedCurrentTurn);
}

function finishTurn(room: DrawRoomInternal, drawNamespace: ReturnType<Server["of"]>, reason: string): void {
  if (!room.turn) {
    return;
  }

  clearPickTimer(room);
  clearTurnTimer(room);
  clearHintTimers(room);
  clearRevealTimer(room);

  if (!room.turn.secretWord && room.turn.wordOptions.length > 0) {
    room.turn.secretWord = room.turn.wordOptions[Math.floor(Math.random() * room.turn.wordOptions.length)];
    room.turn.wordLength = countLetters(room.turn.secretWord);
  }

  if (room.turn.secretWord) {
    room.turn.revealedMask = buildMask(
      room.turn.secretWord,
      new Set<number>(Array.from(room.turn.secretWord).map((_, index) => index))
    );
  }

  room.phase = "round-reveal";
  room.turn.phaseEndsAt = Date.now() + ROUND_REVEAL_MS;

  pushMessage(room, "system", `${reason} Word: ${room.turn.secretWord ?? "(unknown)"}`, null, "System");

  room.revealTimer = setTimeout(() => {
    if (!rooms.has(room.code)) {
      return;
    }

    if (room.phase !== "round-reveal") {
      return;
    }

    startNextTurn(room, drawNamespace);
  }, ROUND_REVEAL_MS);

  emitState(room, drawNamespace);
}

function startNextTurn(room: DrawRoomInternal, drawNamespace: ReturnType<Server["of"]>): void {
  clearPickTimer(room);
  clearTurnTimer(room);
  clearHintTimers(room);
  clearRevealTimer(room);

  const drawablePlayers = getConnectedPlayers(room);
  if (drawablePlayers.length < 2) {
    finishGame(room, drawNamespace, "Need at least 2 connected players to continue.");
    return;
  }

  const nextTurnNumber = room.turnNumber + 1;
  const nextRoundNumber = Math.floor((nextTurnNumber - 1) / drawablePlayers.length) + 1;

  if (nextRoundNumber > room.settings.totalRounds) {
    finishGame(room, drawNamespace, "All rounds completed.");
    return;
  }

  const artistIndex = (nextTurnNumber - 1) % drawablePlayers.length;
  const artist = drawablePlayers[artistIndex];

  room.turnNumber = nextTurnNumber;
  room.roundNumber = nextRoundNumber;
  room.totalTurns = room.settings.totalRounds * drawablePlayers.length;
  room.phase = "word-select";

  resetGuessFlags(room);

  const wordOptions = pickRandomWords(3).map((entry) => normalizeGuess(entry));

  room.turn = {
    turnNumber: room.turnNumber,
    roundNumber: room.roundNumber,
    artistId: artist.id,
    wordOptions,
    secretWord: null,
    wordLength: 0,
    revealedMask: "",
    revealedIndexes: new Set<number>(),
    phaseEndsAt: Date.now() + room.settings.pickTimeSec * 1000,
    strokes: [],
    guessedPlayerIds: [],
    clearCount: 0,
  };

  pushMessage(room, "system", `${artist.name} is choosing a word.`, null, "System");

  room.pickTimer = setTimeout(() => {
    if (!room.turn || room.phase !== "word-select" || room.turn.secretWord) {
      return;
    }

    const fallbackWord =
      room.turn.wordOptions[Math.floor(Math.random() * room.turn.wordOptions.length)] ?? "apple";
    startDrawingPhase(room, drawNamespace, fallbackWord, true);
  }, room.settings.pickTimeSec * 1000);

  emitState(room, drawNamespace);
}

function applyCorrectGuessScoring(room: DrawRoomInternal, guesser: InternalPlayer): void {
  if (!room.turn) {
    return;
  }

  const artist = room.players.find((player) => player.id === room.turn?.artistId);
  if (!artist) {
    return;
  }

  const order = room.turn.guessedPlayerIds.length + 1;
  const remainingMs = Math.max(0, (room.turn.phaseEndsAt ?? Date.now()) - Date.now());
  const durationMs = room.settings.drawTimeSec * 1000;
  const ratio = durationMs > 0 ? remainingMs / durationMs : 0;

  const basePoints = Math.round(room.settings.maxScorePerTurn * (0.35 + 0.5 * ratio));
  const rankBonus = Math.max(0, 18 - (order - 1) * 4);
  const guesserPoints = clamp(basePoints + rankBonus, 8, room.settings.maxScorePerTurn);
  const artistPoints = Math.max(4, Math.round(guesserPoints * 0.35));

  guesser.score += guesserPoints;
  artist.score += artistPoints;

  room.turn.guessedPlayerIds.push(guesser.id);

  room.players = room.players.map((player) => {
    if (player.id === guesser.id) {
      return {
        ...player,
        score: guesser.score,
        hasGuessedCurrentTurn: true,
      };
    }

    if (player.id === artist.id) {
      return {
        ...player,
        score: artist.score,
      };
    }

    return player;
  });
}

function handleStroke(
  room: DrawRoomInternal,
  player: InternalPlayer,
  payload: DrawStrokeActionPayload,
  drawNamespace: ReturnType<Server["of"]>
): void {
  if (room.phase !== "drawing" || !room.turn || room.turn.artistId !== player.id) {
    return;
  }

  const x = clamp(payload.point.x, 0, 1);
  const y = clamp(payload.point.y, 0, 1);
  const size = clamp(payload.size, 1, 32);
  const color = payload.color.slice(0, 32);

  const normalizedDelta: DrawStrokeActionPayload = {
    strokeId: payload.strokeId.slice(0, 80),
    tool: payload.tool,
    color,
    size,
    point: { x, y },
    isStart: Boolean(payload.isStart),
    isEnd: Boolean(payload.isEnd),
  };

  let stroke = room.turn.strokes.find((entry) => entry.id === normalizedDelta.strokeId);

  if (normalizedDelta.isStart || !stroke) {
    stroke = {
      id: normalizedDelta.strokeId,
      tool: normalizedDelta.tool,
      color: normalizedDelta.color,
      size: normalizedDelta.size,
      points: [normalizedDelta.point],
    };

    room.turn.strokes.push(stroke);

    if (room.turn.strokes.length > MAX_STROKES) {
      room.turn.strokes.splice(0, room.turn.strokes.length - MAX_STROKES);
    }
  } else {
    stroke.points.push(normalizedDelta.point);

    if (stroke.points.length > MAX_POINTS_PER_STROKE) {
      stroke.points.splice(0, stroke.points.length - MAX_POINTS_PER_STROKE);
    }
  }

  drawNamespace.to(room.code).emit(DrawGameEvents.STROKE, {
    playerId: player.id,
    delta: normalizedDelta,
  });
}

function removePlayerFromRoom(
  roomCode: string,
  playerId: string,
  drawNamespace: ReturnType<Server["of"]>,
  reason: string
): void {
  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  const timer = room.disconnectTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    room.disconnectTimers.delete(playerId);
  }

  const playerIndex = room.players.findIndex((player) => player.id === playerId);
  if (playerIndex === -1) {
    return;
  }

  const [removed] = room.players.splice(playerIndex, 1);

  for (const [socketId, membership] of socketToMembership.entries()) {
    if (membership.roomCode === roomCode && membership.playerId === playerId) {
      socketToMembership.delete(socketId);
    }
  }

  if (room.players.length === 0) {
    clearAllTimers(room);
    rooms.delete(roomCode);
    logRoomEvent(roomCode, "Deleted (no players remaining)");
    return;
  }

  if (room.hostId === removed.id) {
    ensureHost(room);
    const host = room.players.find((player) => player.id === room.hostId);
    if (host) {
      pushMessage(room, "system", `${host.name} is now host.`, null, "System");
    }
  }

  pushMessage(room, "system", `${removed.name} left (${reason}).`, null, "System");

  if (room.phase !== "lobby") {
    const connectedPlayers = getConnectedPlayers(room);

    if (connectedPlayers.length < 2) {
      finishGame(room, drawNamespace, "Not enough players to continue.");
      return;
    }

    if (room.turn?.artistId === removed.id) {
      finishTurn(room, drawNamespace, "Artist left the room.");
      return;
    }

    if (room.phase === "drawing" && allGuessersFinished(room)) {
      finishTurn(room, drawNamespace, "All guessers are done.");
      return;
    }
  }

  emitState(room, drawNamespace);
}

function createRoom(
  socket: Socket,
  payload: DrawRoomCreatePayload,
  drawNamespace: ReturnType<Server["of"]>
): DrawRoomAck {
  const playerName = normalizePlayerName(payload.playerName ?? "");
  const sessionId = normalizeSessionId(payload.sessionId ?? "");

  if (!playerName) {
    return { success: false, error: "Please enter a name." };
  }

  if (!sessionId) {
    return { success: false, error: "Session id missing. Refresh and try again." };
  }

  const roomCode = generateRoomCode();
  const settings = createDefaultDrawSettings();

  const host: InternalPlayer = {
    id: sessionId,
    sessionId,
    name: playerName,
    score: 0,
    isHost: true,
    connected: true,
    hasGuessedCurrentTurn: false,
    socketId: socket.id,
    joinedAt: Date.now(),
  };

  const room: DrawRoomInternal = {
    code: roomCode,
    phase: "lobby",
    hostId: host.id,
    players: [host],
    settings,
    roundNumber: 0,
    turnNumber: 0,
    totalTurns: settings.totalRounds,
    turn: null,
    messages: [],
    startedAt: null,
    winnerIds: [],
    disconnectTimers: new Map<string, NodeJS.Timeout>(),
    pickTimer: null,
    turnTimer: null,
    hintTimers: [],
    revealTimer: null,
  };

  rooms.set(roomCode, room);

  socketToMembership.set(socket.id, {
    roomCode,
    playerId: host.id,
  });

  socket.join(roomCode);
  pushMessage(room, "system", `${host.name} created the room.`, null, "System");

  logRoomEvent(roomCode, `Created by ${host.name}`);

  const state = buildPublicState(room, host.id);
  emitState(room, drawNamespace);

  return {
    success: true,
    roomCode,
    state,
    resumed: false,
  };
}

function joinRoom(
  socket: Socket,
  payload: DrawRoomJoinPayload,
  drawNamespace: ReturnType<Server["of"]>
): DrawRoomAck {
  const roomCode = payload.roomCode?.trim().toUpperCase();
  const playerName = normalizePlayerName(payload.playerName ?? "");
  const sessionId = normalizeSessionId(payload.sessionId ?? "");

  if (!roomCode) {
    return { success: false, error: "Room code is required." };
  }

  if (!playerName) {
    return { success: false, error: "Please enter a name." };
  }

  if (!sessionId) {
    return { success: false, error: "Session id missing. Refresh and try again." };
  }

  const room = rooms.get(roomCode);
  if (!room) {
    return { success: false, error: "Room not found." };
  }

  const existingBySession = room.players.find((player) => player.sessionId === sessionId);

  if (existingBySession) {
    if (existingBySession.connected && existingBySession.socketId && existingBySession.socketId !== socket.id) {
      return { success: false, error: "Session already active on another device." };
    }

    const timer = room.disconnectTimers.get(existingBySession.id);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(existingBySession.id);
    }

    if (existingBySession.socketId) {
      socketToMembership.delete(existingBySession.socketId);
    }

    existingBySession.connected = true;
    existingBySession.socketId = socket.id;

    socketToMembership.set(socket.id, {
      roomCode,
      playerId: existingBySession.id,
    });

    socket.join(roomCode);
    emitState(room, drawNamespace);

    logPlayerEvent(existingBySession.name, `Resumed room ${roomCode}`);

    return {
      success: true,
      roomCode,
      state: buildPublicState(room, existingBySession.id),
      resumed: true,
    };
  }

  if (room.phase !== "lobby") {
    return { success: false, error: "Game already started. Try again next round." };
  }

  if (room.players.length >= room.settings.maxPlayers) {
    return { success: false, error: "Room is full." };
  }

  const nameTaken = room.players.some(
    (player) => player.name.toLowerCase() === playerName.toLowerCase()
  );

  if (nameTaken) {
    return { success: false, error: "Name is already taken in this room." };
  }

  const newPlayer: InternalPlayer = {
    id: sessionId,
    sessionId,
    name: playerName,
    score: 0,
    isHost: false,
    connected: true,
    hasGuessedCurrentTurn: false,
    socketId: socket.id,
    joinedAt: Date.now(),
  };

  room.players.push(newPlayer);
  ensureHost(room);

  socket.join(roomCode);
  socketToMembership.set(socket.id, {
    roomCode,
    playerId: newPlayer.id,
  });

  pushMessage(room, "system", `${newPlayer.name} joined.`, null, "System");
  emitState(room, drawNamespace);

  logPlayerEvent(newPlayer.name, `Joined room ${roomCode}`);

  return {
    success: true,
    roomCode,
    state: buildPublicState(room, newPlayer.id),
    resumed: false,
  };
}

function leaveRoom(
  socket: Socket,
  drawNamespace: ReturnType<Server["of"]>,
  reason: string,
  immediate: boolean,
  disconnectGraceMs: number
): void {
  const membership = socketToMembership.get(socket.id);
  if (!membership) {
    return;
  }

  socketToMembership.delete(socket.id);

  const room = rooms.get(membership.roomCode);
  if (!room) {
    return;
  }

  const player = room.players.find((entry) => entry.id === membership.playerId);
  if (!player) {
    return;
  }

  player.connected = false;
  player.socketId = "";

  if (room.hostId === player.id) {
    ensureHost(room, true);
    const nextHost = room.players.find((entry) => entry.id === room.hostId);
    if (nextHost) {
      pushMessage(room, "system", `${nextHost.name} is now host.`, null, "System");
    }
  }

  if (immediate) {
    removePlayerFromRoom(membership.roomCode, player.id, drawNamespace, reason);
    return;
  }

  const existingTimer = room.disconnectTimers.get(player.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timeout = setTimeout(() => {
    removePlayerFromRoom(membership.roomCode, player.id, drawNamespace, "disconnect timeout");
  }, disconnectGraceMs);

  room.disconnectTimers.set(player.id, timeout);

  if (room.turn?.artistId === player.id && (room.phase === "word-select" || room.phase === "drawing")) {
    finishTurn(room, drawNamespace, "Artist disconnected.");
    return;
  }

  if (room.phase === "drawing" && allGuessersFinished(room)) {
    finishTurn(room, drawNamespace, "All guessers are done.");
    return;
  }

  emitState(room, drawNamespace);
}

function handleAction(
  socket: Socket,
  envelope: DrawActionEnvelope,
  drawNamespace: ReturnType<Server["of"]>
): void {
  const membership = socketToMembership.get(socket.id);
  if (!membership) {
    emitSocketError(socket, "Join a room first.");
    return;
  }

  const room = rooms.get(membership.roomCode);
  if (!room) {
    emitSocketError(socket, "Room not found.");
    return;
  }

  const player = room.players.find((entry) => entry.id === membership.playerId);
  if (!player) {
    emitSocketError(socket, "Player session not found.");
    return;
  }

  switch (envelope.type) {
    case DrawActionTypes.UPDATE_SETTINGS: {
      if (room.phase !== "lobby") {
        emitSocketError(socket, "Settings can only change in lobby.");
        return;
      }

      if (player.id !== room.hostId) {
        emitSocketError(socket, "Only host can update settings.");
        return;
      }

      const payload = envelope.payload as Partial<DrawSettings>;
      room.settings = sanitizeSettings(payload, room.settings);
      room.totalTurns = room.settings.totalRounds * Math.max(2, room.players.length);

      emitState(room, drawNamespace);
      return;
    }

    case DrawActionTypes.START_GAME: {
      if (room.phase !== "lobby" && room.phase !== "game-over") {
        emitSocketError(socket, "Game already started.");
        return;
      }

      if (player.id !== room.hostId) {
        emitSocketError(socket, "Only host can start the game.");
        return;
      }

      const connectedPlayers = getConnectedPlayers(room);
      if (connectedPlayers.length < 2) {
        emitSocketError(socket, "Need at least 2 connected players.");
        return;
      }

      room.players = room.players.map((entry) => ({
        ...entry,
        score: 0,
        hasGuessedCurrentTurn: false,
      }));
      room.messages = [];
      room.winnerIds = [];
      room.turn = null;
      room.turnNumber = 0;
      room.roundNumber = 0;
      room.startedAt = Date.now();

      pushMessage(room, "system", "Game started.", null, "System");
      startNextTurn(room, drawNamespace);
      return;
    }

    case DrawActionTypes.PICK_WORD: {
      if (room.phase !== "word-select" || !room.turn) {
        emitSocketError(socket, "Not in word selection phase.");
        return;
      }

      if (room.turn.artistId !== player.id) {
        emitSocketError(socket, "Only current artist can pick a word.");
        return;
      }

      const requestedWord = normalizeGuess((envelope.payload as { word: string }).word ?? "");
      if (!requestedWord || !room.turn.wordOptions.includes(requestedWord)) {
        emitSocketError(socket, "Invalid word choice.");
        return;
      }

      startDrawingPhase(room, drawNamespace, requestedWord, false);
      return;
    }

    case DrawActionTypes.SUBMIT_GUESS: {
      if (room.phase !== "drawing" || !room.turn || !room.turn.secretWord) {
        return;
      }

      if (room.turn.artistId === player.id) {
        return;
      }

      if (player.hasGuessedCurrentTurn) {
        return;
      }

      const rawText = normalizeMessageText((envelope.payload as { text: string }).text ?? "");
      if (!rawText) {
        return;
      }

      if (isCorrectGuess(room.turn, rawText)) {
        applyCorrectGuessScoring(room, player);
        pushMessage(room, "correct", `${player.name} guessed the word.`, player.id, player.name);

        emitState(room, drawNamespace);

        if (allGuessersFinished(room)) {
          finishTurn(room, drawNamespace, "Everyone guessed the word.");
        }

        return;
      }

      pushMessage(room, "guess", rawText, player.id, player.name);
      emitState(room, drawNamespace);
      return;
    }

    case DrawActionTypes.SEND_MESSAGE: {
      const text = normalizeMessageText((envelope.payload as { text: string }).text ?? "");
      if (!text) {
        return;
      }

      pushMessage(room, "guess", text, player.id, player.name);
      emitState(room, drawNamespace);
      return;
    }

    case DrawActionTypes.CLEAR_CANVAS: {
      if (room.phase !== "drawing" || !room.turn || room.turn.artistId !== player.id) {
        emitSocketError(socket, "Only active artist can clear canvas.");
        return;
      }

      room.turn.strokes = [];
      room.turn.clearCount += 1;
      emitState(room, drawNamespace);
      return;
    }

    case DrawActionTypes.STROKE: {
      const payload = envelope.payload as DrawStrokeActionPayload;
      if (!payload || !payload.strokeId) {
        return;
      }

      handleStroke(room, player, payload, drawNamespace);
      return;
    }

    case DrawActionTypes.SKIP_TURN: {
      if (player.id !== room.hostId) {
        emitSocketError(socket, "Only host can skip.");
        return;
      }

      if (room.phase === "round-reveal") {
        startNextTurn(room, drawNamespace);
        return;
      }

      if (room.phase === "word-select" || room.phase === "drawing") {
        finishTurn(room, drawNamespace, "Host skipped the turn.");
      }

      return;
    }

    default:
      emitSocketError(socket, "Unknown draw action.");
  }
}

export function registerDrawHandlers(io: Server, options: DrawModuleOptions = {}): void {
  const disconnectGraceMs = options.disconnectGraceMs ?? 90_000;
  const drawNamespace = io.of("/draw");

  drawNamespace.on("connection", (socket) => {
    logServer(`Draw namespace connected: ${socket.id}`);

    socket.on(
      DrawRoomEvents.CREATE,
      (
        payload: DrawRoomCreatePayload,
        callback?: (response: DrawRoomAck) => void
      ) => {
        const response = createRoom(socket, payload, drawNamespace);
        callback?.(response);
      }
    );

    socket.on(
      DrawRoomEvents.JOIN,
      (
        payload: DrawRoomJoinPayload,
        callback?: (response: DrawRoomAck) => void
      ) => {
        const response = joinRoom(socket, payload, drawNamespace);
        callback?.(response);
      }
    );

    socket.on(DrawRoomEvents.LEAVE, () => {
      leaveRoom(socket, drawNamespace, "left room", true, disconnectGraceMs);
    });

    socket.on(DrawGameEvents.ACTION, (action: DrawActionEnvelope) => {
      handleAction(socket, action, drawNamespace);
    });

    socket.on("disconnect", (reason) => {
      const immediate = reason === "client namespace disconnect";
      leaveRoom(socket, drawNamespace, reason, immediate, disconnectGraceMs);
    });
  });
}

export function getDrawStats(): { roomCount: number; playerCount: number } {
  let playerCount = 0;

  for (const room of rooms.values()) {
    playerCount += room.players.length;
  }

  return {
    roomCount: rooms.size,
    playerCount,
  };
}

export function stopDrawHandlers(): void {
  for (const room of rooms.values()) {
    clearAllTimers(room);
  }

  rooms.clear();
  socketToMembership.clear();
  logServer("Draw handlers stopped and in-memory rooms cleared.");
}
