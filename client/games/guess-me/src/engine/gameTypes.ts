// ============================================================
// gameTypes.ts — Re-exports from shared types
// ============================================================
// 💡 The canonical type definitions now live in:
//   shared/guess-me/gameTypes.ts
//
// This file re-exports everything so existing component imports
// (e.g., import { GameState } from "../engine/gameTypes")
// continue working without any changes. Over time, you can
// migrate components to import directly from the shared folder.
// ============================================================

export {
  createDefaultSettings,
} from "../../../../../shared/guess-me/gameTypes";

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
} from "../../../../../shared/guess-me/gameTypes";
