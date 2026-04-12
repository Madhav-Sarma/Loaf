export const DRAW_GAME_VERSION = "1.0.0";

export type DrawPhase =
  | "lobby"
  | "word-select"
  | "drawing"
  | "round-reveal"
  | "game-over";

export type DrawTool = "pen" | "eraser";

export interface DrawSettings {
  totalRounds: number;
  drawTimeSec: number;
  pickTimeSec: number;
  maxPlayers: number;
  hintCount: number;
  maxScorePerTurn: number;
}

export interface DrawPlayer {
  id: string;
  sessionId: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  hasGuessedCurrentTurn: boolean;
}

export interface DrawStrokePoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  tool: DrawTool;
  color: string;
  size: number;
  points: DrawStrokePoint[];
}

export type DrawMessageKind = "guess" | "correct" | "system";

export interface DrawChatMessage {
  id: string;
  playerId: string | null;
  playerName: string;
  text: string;
  kind: DrawMessageKind;
  createdAt: number;
}

export interface DrawTurnPublicState {
  turnNumber: number;
  roundNumber: number;
  artistId: string;
  wordLength: number;
  revealedMask: string;
  phaseEndsAt: number | null;
  strokes: DrawStroke[];
  guessedPlayerIds: string[];
  wordOptions: string[] | null;
  hasWordChoice: boolean;
  revealedWord: string | null;
  clearCount: number;
}

export interface DrawRoomPublicState {
  version: string;
  roomCode: string;
  phase: DrawPhase;
  hostId: string;
  players: DrawPlayer[];
  settings: DrawSettings;
  roundNumber: number;
  turnNumber: number;
  totalTurns: number;
  turn: DrawTurnPublicState | null;
  messages: DrawChatMessage[];
  startedAt: number | null;
  winnerIds: string[];
}

export interface DrawRoomCreatePayload {
  playerName: string;
  sessionId: string;
}

export interface DrawRoomJoinPayload {
  roomCode: string;
  playerName: string;
  sessionId: string;
}

export interface DrawRoomAckSuccess {
  success: true;
  roomCode: string;
  state: DrawRoomPublicState;
  resumed: boolean;
}

export interface DrawRoomAckFailure {
  success: false;
  error: string;
}

export type DrawRoomAck = DrawRoomAckSuccess | DrawRoomAckFailure;

export interface DrawStrokeActionPayload {
  strokeId: string;
  tool: DrawTool;
  color: string;
  size: number;
  point: DrawStrokePoint;
  isStart: boolean;
  isEnd: boolean;
}

export interface DrawActionMap {
  updateSettings: Partial<DrawSettings>;
  startGame: Record<string, never>;
  pickWord: { word: string };
  submitGuess: { text: string };
  sendMessage: { text: string };
  clearCanvas: Record<string, never>;
  stroke: DrawStrokeActionPayload;
  skipTurn: Record<string, never>;
}

export type DrawActionType = keyof DrawActionMap;

export interface DrawActionEnvelope<T extends DrawActionType = DrawActionType> {
  type: T;
  payload: DrawActionMap[T];
}

export interface DrawStrokeBroadcast {
  playerId: string;
  delta: DrawStrokeActionPayload;
}

export function createDefaultDrawSettings(): DrawSettings {
  return {
    totalRounds: 3,
    drawTimeSec: 80,
    pickTimeSec: 15,
    maxPlayers: 10,
    hintCount: 2,
    maxScorePerTurn: 120,
  };
}
