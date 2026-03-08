// ============================================================
// GuesserReview.tsx — Guesser reviews player guesses and makes final pick
// ============================================================
// 💡 The guesser sees what everyone guessed, then locks in
// their own final answer for each actor.
// ============================================================

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

import type { GameState } from "../engine/gameTypes";
import { Badge } from "@/components/ui/badge";

import { AnimatedButton, GameCard, PhaseHeader, PhaseShell, WaitingPanel } from "./GameUi";

interface GuesserReviewProps {
  state: GameState;
  playerId: string;
  onSubmitGuesserGuess: (actorId: string, number: number) => void;
  onFinalize: () => void;
}

export function GuesserReview({
  state,
  playerId,
  onSubmitGuesserGuess,
  onFinalize,
}: GuesserReviewProps) {
  const round = state.currentRound;
  const [localGuesses, setLocalGuesses] = useState<Map<string, number>>(new Map());

  if (!round) return null;

  const isGuesser = round.guesserId === playerId;
  const { min, max } = state.settings.numberRange;
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  if (!isGuesser) {
    return (
      <PhaseShell>
        <WaitingPanel
          message="Guesser is reviewing"
          detail="The final picks are being locked in right now."
        />
      </PhaseShell>
    );
  }

  const actors = round.actorIds.map((id) => ({
    id,
    name: state.players.find((p) => p.id === id)?.name ?? "Unknown",
    playerGuesses: round.guesses.filter((g) => !g.isGuesserGuess && g.actorId === id),
  }));

  const handlePick = (actorId: string, guessedNumber: number) => {
    setLocalGuesses((prev) => {
      const next = new Map(prev);
      next.set(actorId, guessedNumber);
      return next;
    });
    onSubmitGuesserGuess(actorId, guessedNumber);
  };

  const canFinalize = actors.every((a) => localGuesses.has(a.id));

  return (
    <PhaseShell>
      <PhaseHeader
        title="Final Guess Time"
        subtitle="Use the crowd guesses as hints, then lock your answer per actor."
        icon={<Search className="size-6 text-indigo-500" />}
      />

      <div className="mb-6 w-full max-w-md space-y-4">
        {actors.map((actor) => (
          <GameCard key={actor.id} title={`🎭 ${actor.name}`} className="w-full">
              {/* Player guesses */}
              <div className="space-y-2 text-sm text-slate-600">
                {actor.playerGuesses.length === 0 ? (
                  <p>No player guesses submitted.</p>
                ) : (
                  actor.playerGuesses.map((guess, index) => {
                    const guesserName = state.players.find((p) => p.id === guess.guesserId)?.name ?? "Unknown";
                    return (
                      <div key={`${guess.guesserId}-${index}`} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-1.5">
                        <span className="font-medium">{guesserName}</span>
                        <Badge variant="outline" className="border-cyan-200 bg-cyan-100 text-cyan-700">
                          {guess.guessedNumber}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Number grid for guesser's pick */}
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                {numbers.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePick(actor.id, num)}
                    className={`aspect-square text-sm font-bold transition-all ${
                      localGuesses.get(actor.id) === num
                        ? "rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 text-white shadow-md"
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

      <AnimatedButton
        disabled={!canFinalize}
        onClick={onFinalize}
        className="h-14 w-full max-w-md bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-lg"
        icon={<Sparkles className="size-5" />}
      >
        Finalize and Reveal
      </AnimatedButton>
    </PhaseShell>
  );
}
