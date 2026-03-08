// ============================================================
// Guessing.tsx — Players submit their guesses
// ============================================================
// 💡 After all actors perform, every player (except actors)
// guesses what number each actor had. The guesser submits
// their guess in the next phase (GuesserReview).
// Uses shadcn Card and Button for structured guessing UI.
// ============================================================

import { useState } from "react";
import { Search, Sparkles, Target } from "lucide-react";

import type { GameState } from "../engine/gameTypes";
import { Badge } from "@/components/ui/badge";

import { AnimatedButton, GameCard, PhaseHeader, PhaseShell, WaitingPanel } from "./GameUi";

interface GuessingProps {
  state: GameState;
  playerId: string;
  hasFinished: boolean;
  onSubmitGuess: (actorId: string, number: number) => void;
  onFinishGuessing: () => void;
}

export function Guessing({
  state,
  playerId,
  hasFinished,
  onSubmitGuess,
  onFinishGuessing,
}: GuessingProps) {
  const round = state.currentRound;
  const { min, max } = state.settings.numberRange;
  const isGuesser = round?.guesserId === playerId;
  const isActor = round?.actorIds.includes(playerId) ?? false;

  // Track guesses locally so the user can see what they've submitted
  const [localGuesses, setLocalGuesses] = useState<Map<string, number>>(
    new Map()
  );

  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  if (!round) return null;

  const actors = round.actorIds.map((id) => ({
    id,
    name: state.players.find((p) => p.id === id)?.name ?? "Unknown",
  }));

  const handleGuess = (actorId: string, number: number) => {
    setLocalGuesses((prev) => {
      const updated = new Map(prev);
      updated.set(actorId, number);
      return updated;
    });
    onSubmitGuess(actorId, number);
  };

  const allGuessed = actors.every((a) => localGuesses.has(a.id));

  // Guesser waits during this phase
  if (isGuesser) {
    return (
      <PhaseShell>
        <WaitingPanel
          message="Players are guessing"
          detail="You will make your final guesses in the review phase."
        />
      </PhaseShell>
    );
  }

  // Actors can't guess
  if (isActor) {
    return (
      <PhaseShell>
        <WaitingPanel
          message="Players are guessing your number"
          detail="Watch reactions and keep your poker face."
        />
      </PhaseShell>
    );
  }

  // Player already submitted — waiting for others
  if (hasFinished) {
    return (
      <PhaseShell>
        <WaitingPanel
          message="Guesses submitted"
          detail="Waiting for everyone else to finish this phase."
        />
      </PhaseShell>
    );
  }

  // Regular player: Submit guesses
  return (
    <PhaseShell>
      <PhaseHeader
        title="Guess The Numbers"
        subtitle="Pick one number for each actor based on their performance."
        icon={<Target className="size-6 text-cyan-500" />}
      />

      {/* One Card per actor */}
      <div className="mb-6 w-full max-w-md space-y-4">
        {actors.map((actor) => (
          <GameCard key={actor.id} className="w-full" title={
            <span className="inline-flex items-center gap-2">
              🎭 {actor.name}
                {localGuesses.has(actor.id) && (
                  <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700" variant="outline">
                    ✓ {localGuesses.get(actor.id)}
                  </Badge>
                )}
            </span>
          }>
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {numbers.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleGuess(actor.id, num)}
                    className={`aspect-square text-sm font-bold transition-all ${
                      localGuesses.get(actor.id) === num
                        ? "scale-105 rounded-xl bg-linear-to-r from-cyan-500 to-indigo-500 text-white shadow-md"
                        : "rounded-xl border border-white/70 bg-white/85 text-slate-700 hover:scale-[1.02]"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
          </GameCard>
        ))}
      </div>

      {/* Submit all guesses */}
      <AnimatedButton
        onClick={onFinishGuessing}
        disabled={!allGuessed}
        className="h-14 w-full max-w-md bg-linear-to-r from-cyan-500 via-sky-400 to-indigo-500 text-lg"
        icon={allGuessed ? <Sparkles className="size-5" /> : <Search className="size-5" />}
      >
        {allGuessed ? "Submit Guesses" : "Guess for all actors first"}
      </AnimatedButton>
    </PhaseShell>
  );
}
