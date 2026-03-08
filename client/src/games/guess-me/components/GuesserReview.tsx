// ============================================================
// GuesserReview.tsx — Guesser reviews player guesses and makes final pick
// ============================================================
// 💡 The guesser sees what everyone guessed, then locks in
// their own final answer for each actor.
// ============================================================

import { useState } from "react";
import type { GameState } from "../engine/gameTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-50 to-violet-100">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold text-indigo-800 mb-2">Guesser Reviewing Guesses...</h2>
        <p className="text-indigo-600">Waiting for the final guess.</p>
      </div>
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
    <div className="min-h-screen flex flex-col items-center p-6 bg-gradient-to-b from-indigo-50 to-violet-100">
      <h2 className="text-2xl font-bold text-indigo-800 mb-2">Final Guess Time</h2>
      <p className="text-indigo-600 mb-6 text-center">See player guesses, then lock your final answer for each actor.</p>

      <div className="w-full max-w-sm space-y-5 mb-6">
        {actors.map((actor) => (
          <Card key={actor.id}>
            <CardHeader>
              <CardTitle>🎭 {actor.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Player guesses */}
              <div className="text-sm text-muted-foreground">
                {actor.playerGuesses.length === 0 ? (
                  <p>No player guesses submitted.</p>
                ) : (
                  actor.playerGuesses.map((guess, index) => {
                    const guesserName = state.players.find((p) => p.id === guess.guesserId)?.name ?? "Unknown";
                    return (
                      <div key={`${guess.guesserId}-${index}`} className="flex items-center gap-2">
                        <span>{guesserName}:</span>
                        <Badge variant="outline">{guess.guessedNumber}</Badge>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Number grid for guesser's pick */}
              <div className="grid grid-cols-5 gap-2">
                {numbers.map((num) => (
                  <Button
                    key={num}
                    variant={localGuesses.get(actor.id) === num ? "default" : "outline"}
                    onClick={() => handlePick(actor.id, num)}
                    className={`aspect-square text-sm font-bold transition-all ${
                      localGuesses.get(actor.id) === num
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-indigo-50"
                    }`}
                  >
                    {num}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        disabled={!canFinalize}
        onClick={onFinalize}
        size="lg"
        className="w-full max-w-sm py-6 rounded-2xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        Finalize and Reveal
      </Button>
    </div>
  );
}
