// ============================================================
// gameTypes.ts — Re-exports from shared types
// ============================================================
// 💡 This file now re-exports everything from the shared folder.
// The canonical types live in shared/guess-me/gameTypes.ts.
// This re-export exists so that gameEngine.ts imports still
// resolve for any code that hasn't migrated yet.
// ============================================================

export {
  createDefaultSettings,
} from "../../../shared/guess-me/gameTypes.js";

export type {
  PlayerRole,
  GamePhase,
  Player,
  ActorData,
  Guess,
  GameSettings,
  RoundState,
  GameState,
  ScoreResult,
} from "../../../shared/guess-me/gameTypes.js";
