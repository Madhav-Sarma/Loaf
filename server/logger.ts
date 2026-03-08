// ============================================================
// server/logger.ts — Simple structured logger for Loaf
// ============================================================
//
// 💡 WHY A CUSTOM LOGGER?
// Raw console.log() calls are hard to search and filter.
// By wrapping them with helper functions, we get:
//
// 1. Consistent format: [ROOM ABC123] Player Aman joined.
// 2. Easy to upgrade later: swap console.log for Winston, Pino, etc.
// 3. Timestamps for debugging timing issues
// 4. Categorized output: room events vs player events vs errors
//
// For now this uses simple console output. In production, you'd
// replace the internals with a proper logging library — but
// the API stays the same, so no code changes elsewhere!
// ============================================================

/**
 * Formats a timestamp for log output.
 * 💡 Using ISO timestamps makes logs sortable and timezone-clear.
 */
function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Logs a room-level event (create, delete, state changes).
 *
 * Example output:
 *   [2026-03-08T12:00:00.000Z] [ROOM ABC123] Created by Aman
 */
export function logRoomEvent(roomCode: string, message: string): void {
  console.log(`[${timestamp()}] [ROOM ${roomCode}] ${message}`);
}

/**
 * Logs a player-level event (join, leave, actions).
 *
 * Example output:
 *   [2026-03-08T12:00:00.000Z] [PLAYER Aman] Joined room ABC123
 */
export function logPlayerEvent(playerName: string, message: string): void {
  console.log(`[${timestamp()}] [PLAYER ${playerName}] ${message}`);
}

/**
 * Logs a game action (submitNumber, submitGuess, etc.).
 *
 * Example output:
 *   [2026-03-08T12:00:00.000Z] [ROOM ABC123] [ACTION submitNumber] by socket abc123
 */
export function logGameAction(roomCode: string, actionType: string, socketId: string): void {
  console.log(`[${timestamp()}] [ROOM ${roomCode}] [ACTION ${actionType}] by socket ${socketId}`);
}

/**
 * Logs a server error with context.
 *
 * Example output:
 *   [2026-03-08T12:00:00.000Z] [ERROR] Failed to process action: ...
 */
export function logError(message: string, error?: unknown): void {
  console.error(`[${timestamp()}] [ERROR] ${message}`, error ?? "");
}

/**
 * Logs a general server-level event (startup, shutdown, etc.).
 *
 * Example output:
 *   [2026-03-08T12:00:00.000Z] [SERVER] Listening on port 3001
 */
export function logServer(message: string): void {
  console.log(`[${timestamp()}] [SERVER] ${message}`);
}
