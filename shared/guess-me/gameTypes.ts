// ============================================================
// shared/guess-me/gameTypes.ts — Shared type definitions
// ============================================================
//
// 💡 WHY A SHARED TYPES FILE?
// Both the server and client need to agree on the shape of data.
// Instead of maintaining two copies (which can drift apart and
// cause bugs), we put ALL shared types in one place.
//
// Both sides import from here:
//   import type { GameState } from "../../../shared/guess-me/gameTypes"
//
// If you change a type here, TypeScript will immediately flag
// everywhere that needs updating — that's the power of a
// single source of truth for types!
// ============================================================

// --- Player Roles ---
// In each round, players take on one of three roles:
// - "guesser"  → writes the action prompt, makes the final guess
// - "actor"    → secretly picks a number and performs the action
// - "player"   → watches and submits guesses
export type PlayerRole = "guesser" | "actor" | "player";

// --- Game Phases ---
// The game moves through these phases in order each round.
// 💡 Using a union type means TypeScript will catch typos!
export type GamePhase =
  | "lobby"             // waiting for players to join
  | "role-assignment"   // selecting actors and guesser for this round
  | "number-selection"  // actors secretly pick their numbers
  | "prompt-writing"    // guesser writes the action prompt
  | "performance"       // actors perform one by one
  | "guessing"          // players submit their guesses
  | "guesser-review"    // guesser sees all guesses, makes final guess
  | "reveal"            // secret numbers are revealed
  | "scoring"           // points are calculated and shown
  | "game-over";        // final scores, game ends

// --- Player ---
// Represents a single player in the game.
export interface Player {
  id: string;           // unique socket ID from Socket.IO
  name: string;         // display name chosen by the player
  score: number;        // cumulative score across all rounds
  role: PlayerRole;     // current role this round
  isHost: boolean;      // did this player create the room?
}

// --- Actor Data ---
// Extra data tracked for each actor during a round.
// 💡 We separate this from Player because not every player
// is an actor — only actors need this data.
export interface ActorData {
  playerId: string;     // links back to the Player
  secretNumber: number; // the number they secretly chose
  hasPerformed: boolean; // have they done their performance yet?
}

// --- Guess ---
// A guess submitted by a player (or the guesser).
export interface Guess {
  guesserId: string;    // who submitted this guess
  actorId: string;      // which actor they're guessing about
  guessedNumber: number; // the number they guessed
  isGuesserGuess: boolean; // true if this came from THE guesser (not a regular player)
}

// --- Game Settings ---
// Configurable options set in the lobby before the game starts.
export interface GameSettings {
  numberRange: {
    min: number;        // lowest number actors can pick (default: 1)
    max: number;        // highest number actors can pick (default: 10)
  };
  allowDuplicateNumbers: boolean; // can multiple actors pick the same number?
  guesserSelectionMode: "clockwise" | "random"; // how we pick the guesser
  actorsPerRound: number;   // how many actors perform each round
  guessersPerRound: number; // how many guessers each round (usually 1)
  totalRounds: number;      // how many rounds before game over
}

// --- Round State ---
// All the data for a single round of play.
export interface RoundState {
  roundNumber: number;
  guesserId: string;        // who is the guesser this round
  actorIds: string[];       // who are the actors this round
  actorData: ActorData[];   // secret numbers and performance status
  playerNumbers: Record<string, number>; // everyone's chosen number (playerId → number)
  actionPrompt: string;     // the prompt the guesser wrote
  guesses: Guess[];         // all guesses submitted this round
  currentPerformerIndex: number; // which actor is currently performing
}

// --- Game State ---
// The complete state of a Guess Me game.
// 💡 This is the "single source of truth" — everything about
// the game can be derived from this object.
export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  settings: GameSettings;
  currentRound: RoundState | null; // null before the first round starts
  roundHistory: RoundState[];      // completed rounds for reference
  roundCount: number;              // which round we're on (1-indexed)
}

// --- Score Result ---
// Breakdown of points earned in a single round.
export interface ScoreResult {
  playerId: string;
  pointsEarned: number;
  reason: string;       // human-readable explanation (e.g., "+2 correct guess!")
}

// --- Default Settings ---
// 💡 We export a function (not a constant) so each game gets
// its own copy. If we exported an object, all games would
// share the same reference and modifying one would affect others.
export function createDefaultSettings(): GameSettings {
  return {
    numberRange: { min: 1, max: 10 },
    allowDuplicateNumbers: false,
    guesserSelectionMode: "clockwise",
    actorsPerRound: 1,
    guessersPerRound: 1,
    totalRounds: 5,
  };
}
