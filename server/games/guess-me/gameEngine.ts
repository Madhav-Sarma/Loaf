// ============================================================
// gameEngine.ts — Pure game logic for Guess Me (server copy)
// ============================================================
// 💡 This engine runs on the server to validate and process
// all game actions. Types are imported from the shared folder
// so server and client always agree on data shapes.
// ============================================================

import { createDefaultSettings } from "../../../shared/guess-me/gameTypes.js";
import type {
  ActorData,
  GamePhase,
  GameSettings,
  GameState,
  Guess,
  Player,
  RoundState,
  ScoreResult,
} from "../../../shared/guess-me/gameTypes.js";

// ============================================================
// INITIALIZATION
// ============================================================

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

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.phase !== "lobby") return state;
  if (state.players.some((p) => p.id === player.id)) return state;

  return {
    ...state,
    players: [...state.players, player],
  };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const updatedPlayers = state.players.filter((p) => p.id !== playerId);

  if (updatedPlayers.length === 0) {
    return { ...state, players: [] };
  }

  // Transfer host if the host left
  const wasHost = state.players.find((p) => p.id === playerId)?.isHost;
  if (wasHost) {
    updatedPlayers[0] = { ...updatedPlayers[0], isHost: true };
  }

  return { ...state, players: updatedPlayers };
}

// ============================================================
// SETTINGS
// ============================================================

export function updateSettings(
  state: GameState,
  newSettings: Partial<GameSettings>
): GameState {
  if (state.phase !== "lobby") return state;

  return {
    ...state,
    settings: {
      ...state.settings,
      ...newSettings,
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

export function startRound(state: GameState): GameState {
  const { players, settings, roundCount } = state;

  if (players.length < 3) return state;

  const newRoundNumber = roundCount + 1;
  const guesserId = selectGuesser(players, settings, roundCount);
  const eligibleForActing = players.filter((p) => p.id !== guesserId);
  const actorIds = selectActors(eligibleForActing, settings.actorsPerRound);

  const updatedPlayers = players.map((p) => {
    let role: Player["role"];
    if (p.id === guesserId) role = "guesser";
    else if (actorIds.includes(p.id)) role = "actor";
    else role = "player";
    return { ...p, role };
  });

  const actorData: ActorData[] = actorIds.map((id) => ({
    playerId: id,
    secretNumber: 0,
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

function selectGuesser(
  players: Player[],
  settings: GameSettings,
  roundCount: number
): string {
  if (settings.guesserSelectionMode === "clockwise") {
    const index = roundCount % players.length;
    return players[index].id;
  }
  const index = Math.floor(Math.random() * players.length);
  return players[index].id;
}

function selectActors(eligible: Player[], count: number): string[] {
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).map((p) => p.id);
}

// ============================================================
// PHASE TRANSITIONS
// ============================================================

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
    "scoring": "lobby",
    "game-over": "game-over",
  };

  const nextPhase = nextPhaseMap[state.phase];

  if (nextPhase === "lobby" && state.roundCount >= state.settings.totalRounds) {
    return { ...state, phase: "game-over" };
  }

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

export function submitSecretNumber(
  state: GameState,
  playerId: string,
  number: number
): GameState {
  if (state.phase !== "number-selection" || !state.currentRound) return state;
  if (playerId === state.currentRound.guesserId) return state;

  const { min, max } = state.settings.numberRange;
  if (number < min || number > max) return state;

  const newPlayerNumbers = {
    ...state.currentRound.playerNumbers,
    [playerId]: number,
  };

  const actorIndex = state.currentRound.actorData.findIndex(
    (a) => a.playerId === playerId
  );

  let newActorData = state.currentRound.actorData;
  if (actorIndex !== -1) {
    if (!state.settings.allowDuplicateNumbers) {
      const numberTakenByAnotherActor = state.currentRound.actorData.some(
        (actor) => actor.playerId !== playerId && actor.secretNumber === number
      );
      if (numberTakenByAnotherActor) return state;
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

export function submitActionPrompt(
  state: GameState,
  playerId: string,
  prompt: string
): GameState {
  if (state.phase !== "prompt-writing" || !state.currentRound) return state;
  if (state.currentRound.guesserId !== playerId) return state;

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length === 0) return state;

  return {
    ...state,
    currentRound: {
      ...state.currentRound,
      actionPrompt: trimmedPrompt,
    },
  };
}

export function completePerformance(
  state: GameState,
  actorId: string
): GameState {
  if (state.phase !== "performance" || !state.currentRound) return state;

  const actorIndex = state.currentRound.actorData.findIndex(
    (a) => a.playerId === actorId
  );
  if (actorIndex === -1) return state;

  const newActorData = [...state.currentRound.actorData];
  newActorData[actorIndex] = {
    ...newActorData[actorIndex],
    hasPerformed: true,
  };

  const allDone = newActorData.every((a) => a.hasPerformed);
  const nextPerformerIndex = allDone
    ? state.currentRound.currentPerformerIndex
    : state.currentRound.currentPerformerIndex + 1;

  return {
    ...state,
    phase: allDone ? "guessing" : "performance",
    currentRound: {
      ...state.currentRound,
      actorData: newActorData,
      currentPerformerIndex: nextPerformerIndex,
    },
  };
}

export function submitGuess(
  state: GameState,
  guesserId: string,
  actorId: string,
  guessedNumber: number
): GameState {
  const validPhases: GamePhase[] = ["guessing", "guesser-review"];
  if (!validPhases.includes(state.phase) || !state.currentRound) return state;
  if (guesserId === actorId) return state;

  const isGuesserGuess = guesserId === state.currentRound.guesserId;
  if (state.phase === "guesser-review" && !isGuesserGuess) return state;

  const guess: Guess = {
    guesserId,
    actorId,
    guessedNumber,
    isGuesserGuess,
  };

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

export function calculateScores(
  state: GameState
): { state: GameState; results: ScoreResult[] } {
  if (!state.currentRound) return { state, results: [] };

  const results: ScoreResult[] = [];
  const round = state.currentRound;

  const secretNumbers = new Map<string, number>();
  for (const actor of round.actorData) {
    secretNumbers.set(actor.playerId, actor.secretNumber);
  }

  const pointsMap = new Map<string, number>();

  for (const guess of round.guesses) {
    const actualNumber = secretNumbers.get(guess.actorId);
    if (actualNumber === undefined) continue;

    const isCorrect = guess.guessedNumber === actualNumber;

    if (guess.isGuesserGuess) {
      const points = isCorrect ? 4 : -1;
      pointsMap.set(guess.guesserId, (pointsMap.get(guess.guesserId) ?? 0) + points);
      results.push({
        playerId: guess.guesserId,
        pointsEarned: points,
        reason: isCorrect
          ? `+4 guesser correctly guessed actor's number!`
          : `-1 guesser guessed wrong`,
      });

      if (isCorrect) {
        pointsMap.set(guess.actorId, (pointsMap.get(guess.actorId) ?? 0) + 1);
        results.push({
          playerId: guess.actorId,
          pointsEarned: 1,
          reason: `+1 actor was guessed correctly by the guesser`,
        });
      }
    } else {
      if (isCorrect) {
        const points = 2;
        pointsMap.set(guess.guesserId, (pointsMap.get(guess.guesserId) ?? 0) + points);
        results.push({
          playerId: guess.guesserId,
          pointsEarned: points,
          reason: `+2 correct guess!`,
        });

        pointsMap.set(guess.actorId, (pointsMap.get(guess.actorId) ?? 0) + 1);
        results.push({
          playerId: guess.actorId,
          pointsEarned: 1,
          reason: `+1 actor was guessed correctly`,
        });
      }
    }
  }

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

export function allPlayersReady(state: GameState): boolean {
  if (!state.currentRound) return false;
  return state.players
    .filter((p) => p.id !== state.currentRound!.guesserId)
    .every((p) => state.currentRound!.playerNumbers[p.id] !== undefined);
}
