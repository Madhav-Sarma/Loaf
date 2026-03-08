// ============================================================
// server/validation/validateAction.ts — Input validation layer
// ============================================================
//
// 💡 WHY VALIDATE ON THE SERVER?
// Never trust the client! A malicious user could:
// - Submit a number outside the allowed range
// - Send an action during the wrong game phase
// - Pretend to be a different player
// - Send garbage data to crash the server
//
// This validation layer sits between the socket event and the
// game engine. It checks that every action is:
// 1. Well-formed (correct data types, required fields present)
// 2. Allowed (correct phase, correct player role)
// 3. Valid (number in range, non-empty strings, etc.)
//
// Server flow: Client event → VALIDATE → game engine → broadcast
//
// 💡 We return { valid, error } objects so the server can
// optionally send error messages back to the client.
// ============================================================

import type { GameState, GamePhase } from "../../shared/guess-me/gameTypes.js";

// --- Validation result type ---
// Every validation function returns this. If valid is false,
// error explains why — useful for debugging and user feedback.
interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================
// PHASE GUARDS
// ============================================================
//
// 💡 Phase guards prevent actions from running in the wrong phase.
// For example, you can't submit a number during the lobby phase.
// This is the first line of defense against invalid actions.
// ============================================================

/**
 * Checks if the current game phase matches one of the allowed phases.
 * Returns an error if the action is not allowed in the current phase.
 */
export function validatePhaseAction(
  currentPhase: GamePhase,
  allowedPhases: GamePhase[],
  actionName: string
): ValidationResult {
  if (!allowedPhases.includes(currentPhase)) {
    return {
      valid: false,
      error: `Action "${actionName}" not allowed during phase "${currentPhase}". Expected: ${allowedPhases.join(", ")}`,
    };
  }
  return { valid: true };
}

// ============================================================
// ACTION-SPECIFIC VALIDATORS
// ============================================================

/**
 * Validates a submitNumber action.
 *
 * Checks:
 * - Game is in the "number-selection" phase
 * - A current round exists
 * - The number is a finite integer within the allowed range
 * - The player is not the guesser (guessers don't pick numbers)
 */
export function validateSubmitNumber(
  state: GameState,
  playerId: string,
  payload: Record<string, unknown> | undefined
): ValidationResult {
  // Phase check
  const phaseCheck = validatePhaseAction(state.phase, ["number-selection"], "submitNumber");
  if (!phaseCheck.valid) return phaseCheck;

  // Round must exist
  if (!state.currentRound) {
    return { valid: false, error: "No active round." };
  }

  // Player must not be the guesser
  if (playerId === state.currentRound.guesserId) {
    return { valid: false, error: "The guesser cannot submit a number." };
  }

  // Payload must contain a number
  if (!payload || typeof payload.number !== "number") {
    return { valid: false, error: "Missing or invalid 'number' in payload." };
  }

  const number = payload.number;

  // Number must be a finite integer
  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    return { valid: false, error: "Number must be a finite integer." };
  }

  // Number must be within the configured range
  const { min, max } = state.settings.numberRange;
  if (number < min || number > max) {
    return { valid: false, error: `Number must be between ${min} and ${max}.` };
  }

  return { valid: true };
}

/**
 * Validates a submitGuess action.
 *
 * Checks:
 * - Game is in "guessing" or "guesser-review" phase
 * - A current round exists
 * - The guessed number is a valid number
 * - The player is not guessing for themselves
 * - During guesser-review, only the guesser can submit
 */
export function validateSubmitGuess(
  state: GameState,
  playerId: string,
  payload: Record<string, unknown> | undefined
): ValidationResult {
  // Phase check
  const phaseCheck = validatePhaseAction(state.phase, ["guessing", "guesser-review"], "submitGuess");
  if (!phaseCheck.valid) return phaseCheck;

  if (!state.currentRound) {
    return { valid: false, error: "No active round." };
  }

  // Payload must contain actorId and guessedNumber
  if (!payload || typeof payload.actorId !== "string" || typeof payload.guessedNumber !== "number") {
    return { valid: false, error: "Missing 'actorId' or 'guessedNumber' in payload." };
  }

  // Can't guess for yourself
  if (playerId === payload.actorId) {
    return { valid: false, error: "Cannot guess for yourself." };
  }

  // During guesser-review, only the guesser can submit
  if (state.phase === "guesser-review" && playerId !== state.currentRound.guesserId) {
    return { valid: false, error: "Only the guesser can submit during guesser-review." };
  }

  // Guessed number must be finite
  if (!Number.isFinite(payload.guessedNumber)) {
    return { valid: false, error: "Guessed number must be a finite number." };
  }

  return { valid: true };
}

/**
 * Validates a submitPrompt action.
 *
 * Checks:
 * - Game is in "prompt-writing" phase
 * - A current round exists
 * - The player is the guesser (only guesser writes prompts)
 * - The prompt is a non-empty string
 */
export function validateSubmitPrompt(
  state: GameState,
  playerId: string,
  payload: Record<string, unknown> | undefined
): ValidationResult {
  const phaseCheck = validatePhaseAction(state.phase, ["prompt-writing"], "submitPrompt");
  if (!phaseCheck.valid) return phaseCheck;

  if (!state.currentRound) {
    return { valid: false, error: "No active round." };
  }

  if (playerId !== state.currentRound.guesserId) {
    return { valid: false, error: "Only the guesser can submit the prompt." };
  }

  if (!payload || typeof payload.prompt !== "string") {
    return { valid: false, error: "Missing or invalid 'prompt' in payload." };
  }

  if (payload.prompt.trim().length === 0) {
    return { valid: false, error: "Prompt cannot be empty." };
  }

  return { valid: true };
}

/**
 * Validates a completePerformance action.
 *
 * Checks:
 * - Game is in "performance" phase
 * - A current round exists
 * - The actorId belongs to a valid actor
 */
export function validateCompletePerformance(
  state: GameState,
  payload: Record<string, unknown> | undefined
): ValidationResult {
  const phaseCheck = validatePhaseAction(state.phase, ["performance"], "completePerformance");
  if (!phaseCheck.valid) return phaseCheck;

  if (!state.currentRound) {
    return { valid: false, error: "No active round." };
  }

  if (!payload || typeof payload.actorId !== "string") {
    return { valid: false, error: "Missing or invalid 'actorId' in payload." };
  }

  // Verify the actorId is actually an actor in this round
  if (!state.currentRound.actorIds.includes(payload.actorId)) {
    return { valid: false, error: "Invalid actorId — not an actor this round." };
  }

  return { valid: true };
}

/**
 * Validates updateSettings action.
 *
 * Checks:
 * - Game is in "lobby" phase
 * - The player is the host
 */
export function validateUpdateSettings(
  state: GameState,
  playerId: string
): ValidationResult {
  const phaseCheck = validatePhaseAction(state.phase, ["lobby"], "updateSettings");
  if (!phaseCheck.valid) return phaseCheck;

  const player = state.players.find((p) => p.id === playerId);
  if (!player?.isHost) {
    return { valid: false, error: "Only the host can update settings." };
  }

  return { valid: true };
}

/**
 * Validates startGame action.
 *
 * Checks:
 * - Game is in "lobby" phase
 * - There are enough players (minimum 3)
 */
export function validateStartGame(
  state: GameState
): ValidationResult {
  const phaseCheck = validatePhaseAction(state.phase, ["lobby"], "startGame");
  if (!phaseCheck.valid) return phaseCheck;

  if (state.players.length < 3) {
    return { valid: false, error: "Need at least 3 players to start." };
  }

  return { valid: true };
}

/**
 * Validates finishGuessing action.
 *
 * Checks:
 * - Game is in "guessing" phase
 * - A current round exists
 * - The player is not the guesser and not an actor (only audience guesses)
 */
export function validateFinishGuessing(
  state: GameState,
  playerId: string
): ValidationResult {
  const phaseCheck = validatePhaseAction(state.phase, ["guessing"], "finishGuessing");
  if (!phaseCheck.valid) return phaseCheck;

  if (!state.currentRound) {
    return { valid: false, error: "No active round." };
  }

  return { valid: true };
}
