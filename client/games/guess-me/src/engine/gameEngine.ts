// ============================================================
// gameEngine.ts — Pure game logic for Guess Me
// ============================================================
// 💡 KEY DESIGN PRINCIPLE: This file has ZERO dependencies on
// React, Socket.IO, or any UI library. It's pure TypeScript
// functions that take state in and return new state out.
//
// Why? Because:
// 1. We can test all game logic without a browser
// 2. We can run this SAME code on the server to validate moves
// 3. It's way easier to debug — just look at input → output
//
// This pattern is sometimes called "functional core, imperative shell"
// — the engine is the pure functional core, and the UI/sockets
// are the imperative shell that calls into it.
// ============================================================

import { createDefaultSettings } from "./gameTypes";
import type {
  ActorData,
  GamePhase,
  GameSettings,
  GameState,
  Guess,
  Player,
  RoundState,
  ScoreResult,
} from "./gameTypes";

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Creates a brand new game state for a room.
 *
 * 💡 This is the starting point — called when a host creates a room.
 * Notice we start in "lobby" phase with no rounds yet.
 */
export function initGame(roomId: string, host: Player): GameState {
  return {
    roomId,
    phase: "lobby",
    players: [host],
    settings: createDefaultSettings(),
    currentRound: null,
    roundHistory: [],
    roundCount: 0,
  };
}

// ============================================================
// PLAYER MANAGEMENT
// ============================================================

/**
 * Adds a player to the game.
 *
 * 💡 We return a NEW state object instead of modifying the old one.
 * This is called "immutability" — we never change existing objects,
 * we create new ones. React relies on this to know when to re-render.
 * If we mutated the object, React wouldn't detect the change!
 */
export function addPlayer(state: GameState, player: Player): GameState {
  // Only allow joining during lobby phase
  if (state.phase !== "lobby") {
    return state; // no change — game already started
  }

  // Don't add duplicate players
  if (state.players.some((p) => p.id === player.id)) {
    return state;
  }

  return {
    ...state, // 💡 "spread" operator copies all existing properties
    players: [...state.players, player], // new array with the added player
  };
}

/**
 * Removes a player from the game.
 * If the host leaves, ownership transfers to the next player.
 */
export function removePlayer(state: GameState, playerId: string): GameState {
  const updatedPlayers = state.players.filter((p) => p.id !== playerId);

  // If no players left, return empty state
  if (updatedPlayers.length === 0) {
    return { ...state, players: [] };
  }

  // 💡 If the host left, promote the first remaining player.
  // This prevents "orphaned" rooms with no host.
  const wasHost = state.players.find((p) => p.id === playerId)?.isHost;
  if (wasHost) {
    updatedPlayers[0] = { ...updatedPlayers[0], isHost: true };
  }

  return { ...state, players: updatedPlayers };
}

// ============================================================
// SETTINGS
// ============================================================

/**
 * Updates game settings. Only works in the lobby.
 *
 * 💡 Partial<GameSettings> means "any subset of GameSettings."
 * So you can call updateSettings(state, { totalRounds: 10 })
 * without needing to provide every single setting.
 */
export function updateSettings(
  state: GameState,
  newSettings: Partial<GameSettings>
): GameState {
  if (state.phase !== "lobby") {
    return state;
  }

  return {
    ...state,
    settings: {
      ...state.settings,
      ...newSettings,
      // Handle nested numberRange separately so partial updates work
      numberRange: {
        ...state.settings.numberRange,
        ...(newSettings.numberRange ?? {}),
      },
    },
  };
}

// ============================================================
// ROUND MANAGEMENT
// ============================================================

/**
 * Starts a new round. Selects the guesser and actors, then
 * moves to the role-assignment phase.
 *
 * 💡 This is the most complex function — it orchestrates the
 * transition from lobby (or previous round) into a new round.
 */
export function startRound(state: GameState): GameState {
  const { players, settings, roundCount } = state;

  // Need at least 3 players: 1 guesser + 1 actor + 1 player
  if (players.length < 3) {
    return state;
  }

  const newRoundNumber = roundCount + 1;

  // Select the guesser
  const guesserId = selectGuesser(players, settings, roundCount);

  // Select actors (excluding the guesser)
  const eligibleForActing = players.filter((p) => p.id !== guesserId);
  const actorIds = selectActors(eligibleForActing, settings.actorsPerRound);

  // 💡 Assign roles to every player for this round.
  // We create new player objects (immutability!) with updated roles.
  const updatedPlayers = players.map((p) => {
    let role: Player["role"];
    if (p.id === guesserId) role = "guesser";
    else if (actorIds.includes(p.id)) role = "actor";
    else role = "player";
    return { ...p, role };
  });

  // Create the initial actor data (no numbers chosen yet)
  const actorData: ActorData[] = actorIds.map((id) => ({
    playerId: id,
    secretNumber: 0, // will be set during number-selection phase
    hasPerformed: false,
  }));

  const newRound: RoundState = {
    roundNumber: newRoundNumber,
    guesserId,
    actorIds,
    actorData,
    playerNumbers: {},
    actionPrompt: "",
    guesses: [],
    currentPerformerIndex: 0,
  };

  return {
    ...state,
    phase: "role-assignment",
    players: updatedPlayers,
    currentRound: newRound,
    roundCount: newRoundNumber,
  };
}

/**
 * Picks the guesser based on the selection mode.
 *
 * 💡 "clockwise" = rotate through players in order (fair).
 * "random" = pick randomly (more chaotic, more fun).
 * The modulo operator (%) wraps around — so after the last
 * player, it goes back to the first. Classic trick!
 */
function selectGuesser(
  players: Player[],
  settings: GameSettings,
  roundCount: number
): string {
  if (settings.guesserSelectionMode === "clockwise") {
    // Rotate through player list using modulo
    const index = roundCount % players.length;
    return players[index].id;
  }
  // Random selection
  const index = Math.floor(Math.random() * players.length);
  return players[index].id;
}

/**
 * Picks a specified number of actors from eligible players.
 *
 * 💡 Fisher-Yates shuffle is the gold standard for shuffling.
 * It's O(n) and produces a perfectly uniform distribution —
 * unlike naive approaches like .sort(() => Math.random() - 0.5)
 * which are biased.
 */
function selectActors(eligible: Player[], count: number): string[] {
  // Shuffle using Fisher-Yates algorithm
  const shuffled = [...eligible]; // copy first — don't mutate the input!
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // swap
  }
  // Take the first 'count' players from the shuffled list
  return shuffled.slice(0, count).map((p) => p.id);
}

// ============================================================
// PHASE TRANSITIONS
// ============================================================

/**
 * Advances the game to the next phase.
 *
 * 💡 This is a simple state machine — given the current phase,
 * it returns the next phase. State machines are great for games
 * because they make the flow explicit and prevent invalid transitions.
 */
export function advancePhase(state: GameState): GameState {
  const nextPhaseMap: Record<GamePhase, GamePhase> = {
    "lobby": "role-assignment",
    "role-assignment": "number-selection",
    "number-selection": "prompt-writing",
    "prompt-writing": "performance",
    "performance": "guessing",
    "guessing": "guesser-review",
    "guesser-review": "reveal",
    "reveal": "scoring",
    "scoring": "lobby",    // goes back to lobby to start next round
    "game-over": "game-over", // terminal state — stays here
  };

  const nextPhase = nextPhaseMap[state.phase];

  // Check if the game should end instead of going back to lobby
  if (
    nextPhase === "lobby" &&
    state.roundCount >= state.settings.totalRounds
  ) {
    return { ...state, phase: "game-over" };
  }

  // When moving from scoring back to lobby, archive the round
  if (state.phase === "scoring" && state.currentRound) {
    return {
      ...state,
      phase: nextPhase,
      roundHistory: [...state.roundHistory, state.currentRound],
      currentRound: null,
    };
  }

  return { ...state, phase: nextPhase };
}

// ============================================================
// PLAYER ACTIONS
// ============================================================

/**
 * Actor submits their secret number.
 *
 * 💡 Notice the validation: we check phase, player role, and
 * number range. Never trust client input — always validate!
 * This is especially important because this engine might run
 * on the server too.
 */
export function submitSecretNumber(
  state: GameState,
  playerId: string,
  number: number
): GameState {
  if (state.phase !== "number-selection" || !state.currentRound) {
    return state;
  }

  // The guesser doesn't pick a number
  if (playerId === state.currentRound.guesserId) {
    return state;
  }

  const { min, max } = state.settings.numberRange;
  if (number < min || number > max) {
    return state; // invalid number — reject silently
  }

  // Store the number for this player in playerNumbers.
  const newPlayerNumbers = {
    ...state.currentRound.playerNumbers,
    [playerId]: number,
  };

  // If this player is an actor, also update their actorData.
  // Only actors' numbers matter for scoring, but everyone picks
  // to keep the game engaging.
  const actorIndex = state.currentRound.actorData.findIndex(
    (a) => a.playerId === playerId
  );

  let newActorData = state.currentRound.actorData;
  if (actorIndex !== -1) {
    // Enforce duplicate-number setting across different actors.
    if (!state.settings.allowDuplicateNumbers) {
      const numberTakenByAnotherActor = state.currentRound.actorData.some(
        (actor) => actor.playerId !== playerId && actor.secretNumber === number
      );
      if (numberTakenByAnotherActor) {
        return state;
      }
    }

    newActorData = [...state.currentRound.actorData];
    newActorData[actorIndex] = {
      ...newActorData[actorIndex],
      secretNumber: number,
    };
  }

  return {
    ...state,
    currentRound: {
      ...state.currentRound,
      playerNumbers: newPlayerNumbers,
      actorData: newActorData,
    },
  };
}

/**
 * Guesser submits the action prompt for actors to perform.
 * Example: "Dance like your number" or "Sing for X seconds"
 */
export function submitActionPrompt(
  state: GameState,
  playerId: string,
  prompt: string
): GameState {
  if (state.phase !== "prompt-writing" || !state.currentRound) {
    return state;
  }

  // Only the guesser can write the prompt
  if (state.currentRound.guesserId !== playerId) {
    return state;
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length === 0) {
    return state;
  }

  return {
    ...state,
    currentRound: {
      ...state.currentRound,
      actionPrompt: trimmedPrompt,
    },
  };
}

/**
 * Marks an actor as having completed their performance.
 * Advances to the next performer, or to guessing if all done.
 */
export function completePerformance(
  state: GameState,
  actorId: string
): GameState {
  if (state.phase !== "performance" || !state.currentRound) {
    return state;
  }

  const actorIndex = state.currentRound.actorData.findIndex(
    (a) => a.playerId === actorId
  );
  if (actorIndex === -1) return state;

  const newActorData = [...state.currentRound.actorData];
  newActorData[actorIndex] = {
    ...newActorData[actorIndex],
    hasPerformed: true,
  };

  // Check if all actors have performed
  const allDone = newActorData.every((a) => a.hasPerformed);
  const nextPerformerIndex = allDone
    ? state.currentRound.currentPerformerIndex
    : state.currentRound.currentPerformerIndex + 1;

  return {
    ...state,
    // 💡 Automatically move to guessing phase once all actors are done
    phase: allDone ? "guessing" : "performance",
    currentRound: {
      ...state.currentRound,
      actorData: newActorData,
      currentPerformerIndex: nextPerformerIndex,
    },
  };
}

/**
 * A player (or the guesser) submits a guess for an actor's number.
 */
export function submitGuess(
  state: GameState,
  guesserId: string,
  actorId: string,
  guessedNumber: number
): GameState {
  const validPhases: GamePhase[] = ["guessing", "guesser-review"];
  if (!validPhases.includes(state.phase) || !state.currentRound) {
    return state;
  }

  // Actors can't guess for themselves
  if (guesserId === actorId) {
    return state;
  }

  const isGuesserGuess = guesserId === state.currentRound.guesserId;

  // During guesser-review, only the guesser can submit
  if (state.phase === "guesser-review" && !isGuesserGuess) {
    return state;
  }

  const guess: Guess = {
    guesserId,
    actorId,
    guessedNumber,
    isGuesserGuess,
  };

  // 💡 Replace existing guess from same guesser for same actor
  // (allow changing your mind before the round ends)
  const filteredGuesses = state.currentRound.guesses.filter(
    (g) => !(g.guesserId === guesserId && g.actorId === actorId)
  );

  return {
    ...state,
    currentRound: {
      ...state.currentRound,
      guesses: [...filteredGuesses, guess],
    },
  };
}

// ============================================================
// SCORING
// ============================================================

/**
 * Calculates scores for the current round.
 *
 * 💡 Scoring rules from the README:
 * +2 points for a correct player guess
 * +1 point for actor if they were guessed correctly
 * +4 points for guesser correct guess
 * -1 point for guesser incorrect guess
 *
 * We return both the updated state AND a breakdown so the UI
 * can show who earned what.
 */
export function calculateScores(
  state: GameState
): { state: GameState; results: ScoreResult[] } {
  if (!state.currentRound) {
    return { state, results: [] };
  }

  const results: ScoreResult[] = [];
  const round = state.currentRound;

  // Build a lookup: actorId → secretNumber for quick access
  const secretNumbers = new Map<string, number>();
  for (const actor of round.actorData) {
    secretNumbers.set(actor.playerId, actor.secretNumber);
  }

  // 💡 We use a Map to accumulate points, then apply them all at once.
  // This avoids modifying player objects multiple times.
  const pointsMap = new Map<string, number>();

  for (const guess of round.guesses) {
    const actualNumber = secretNumbers.get(guess.actorId);
    if (actualNumber === undefined) continue;

    const isCorrect = guess.guessedNumber === actualNumber;

    if (guess.isGuesserGuess) {
      // Guesser scoring: +4 for correct, -1 for incorrect
      const points = isCorrect ? 4 : -1;
      pointsMap.set(guess.guesserId, (pointsMap.get(guess.guesserId) ?? 0) + points);
      results.push({
        playerId: guess.guesserId,
        pointsEarned: points,
        reason: isCorrect
          ? `+4 guesser correctly guessed actor's number!`
          : `-1 guesser guessed wrong`,
      });

      // Actor gets +1 if the guesser guessed them correctly
      if (isCorrect) {
        pointsMap.set(guess.actorId, (pointsMap.get(guess.actorId) ?? 0) + 1);
        results.push({
          playerId: guess.actorId,
          pointsEarned: 1,
          reason: `+1 actor was guessed correctly by the guesser`,
        });
      }
    } else {
      // Regular player scoring: +2 for correct guess
      if (isCorrect) {
        const points = 2;
        pointsMap.set(guess.guesserId, (pointsMap.get(guess.guesserId) ?? 0) + points);
        results.push({
          playerId: guess.guesserId,
          pointsEarned: points,
          reason: `+2 correct guess!`,
        });

        // Actor gets +1 if any player guessed them correctly
        pointsMap.set(guess.actorId, (pointsMap.get(guess.actorId) ?? 0) + 1);
        results.push({
          playerId: guess.actorId,
          pointsEarned: 1,
          reason: `+1 actor was guessed correctly`,
        });
      }
    }
  }

  // Apply accumulated points to players
  const updatedPlayers = state.players.map((p) => {
    const earned = pointsMap.get(p.id) ?? 0;
    return earned !== 0 ? { ...p, score: p.score + earned } : p;
  });

  return {
    state: { ...state, players: updatedPlayers },
    results,
  };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Checks if all actors have submitted their secret numbers.
 * Useful for the UI to know when to enable the "continue" button.
 */
export function allActorsReady(state: GameState): boolean {
  if (!state.currentRound) return false;
  return state.currentRound.actorData.every((a) => a.secretNumber !== 0);
}

/**
 * Checks if ALL players have submitted their numbers.
 * 💡 In Guess Me, everyone picks a number simultaneously.
 * Only actors' numbers matter for scoring, but everyone picks
 * to keep the game engaging.
 */
export function allPlayersReady(state: GameState): boolean {
  if (!state.currentRound) return false;
  // The guesser doesn't pick a number, so exclude them
  return state.players
    .filter((p) => p.id !== state.currentRound!.guesserId)
    .every((p) => state.currentRound!.playerNumbers[p.id] !== undefined);
}

/**
 * Gets the current performer (the actor who should be performing now).
 */
export function getCurrentPerformer(state: GameState): Player | null {
  if (!state.currentRound || state.phase !== "performance") return null;
  const actorId =
    state.currentRound.actorIds[state.currentRound.currentPerformerIndex];
  return state.players.find((p) => p.id === actorId) ?? null;
}

/**
 * Gets the sorted leaderboard.
 */
export function getLeaderboard(state: GameState): Player[] {
  return [...state.players].sort((a, b) => b.score - a.score);
}

/**
 * Checks if the game can start (enough players, in lobby).
 */
export function canStartGame(state: GameState): boolean {
  return state.phase === "lobby" && state.players.length >= 3;
}
