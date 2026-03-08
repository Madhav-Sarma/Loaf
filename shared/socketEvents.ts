// ============================================================
// shared/socketEvents.ts — Socket event constants
// ============================================================
//
// 💡 WHY CONSTANTS FOR EVENT NAMES?
// Using string literals like "room:create" everywhere is fragile.
// If you typo one event name, nothing breaks at compile time —
// the event just silently never fires. By using constants:
//
// 1. TypeScript catches typos at compile time
// 2. Your IDE can autocomplete event names
// 3. Renaming an event is a single change here, not a grep hunt
// 4. You can see ALL events in one place — great for documentation
//
// Both server and client import from this file, so they always
// agree on event names.
// ============================================================

// --- Room lifecycle events ---
// These handle the lobby experience: creating, joining, and leaving rooms.
export const RoomEvents = {
  /** Host creates a new room. Server responds with room code + initial state. */
  CREATE: "room:create",
  /** Player joins an existing room by code. Server responds with current state. */
  JOIN: "room:join",
  /** Player explicitly leaves a room (vs. disconnecting). */
  LEAVE: "room:leave",
} as const;

// --- Game events ---
// These handle in-game communication between client and server.
export const GameEvents = {
  /** Client sends a game action (e.g., submitNumber, submitGuess). */
  ACTION: "game:action",
  /** Server broadcasts updated game state to all players in the room. */
  STATE: "game:state",
} as const;

// --- Game action types ---
// 💡 These are the "type" field values sent inside game:action events.
// Using constants here ensures server and client use the same action names.
export const GameActionTypes = {
  UPDATE_SETTINGS: "updateSettings",
  START_GAME: "startGame",
  ROLE_CONTINUE: "roleContinue",
  SUBMIT_NUMBER: "submitNumber",
  SUBMIT_PROMPT: "submitPrompt",
  COMPLETE_PERFORMANCE: "completePerformance",
  SUBMIT_GUESS: "submitGuess",
  FINISH_GUESSING: "finishGuessing",
  FINALIZE_GUESSER_REVIEW: "finalizeGuesserReview",
  REVEAL_CONTINUE: "revealContinue",
  PLAY_AGAIN: "playAgain",
} as const;

// 💡 TypeScript utility type — extracts the union of all action type values.
// Useful for type-checking the "type" field in action handlers.
export type GameActionType = (typeof GameActionTypes)[keyof typeof GameActionTypes];
