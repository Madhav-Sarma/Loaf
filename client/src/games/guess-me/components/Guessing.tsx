// ============================================================
// Guessing.tsx — Players submit their guesses
// ============================================================
// 💡 After all actors perform, every player (except actors)
// guesses what number each actor had. The guesser submits
// their guess in the next phase (GuesserReview).
// Uses shadcn Card and Button for structured guessing UI.
// ============================================================

import { useState } from "react";
import type { GameState } from "../engine/gameTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-cyan-100">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold text-blue-800 mb-2">
          Players are guessing...
        </h2>
        <p className="text-blue-600 animate-pulse">
          You'll make your guess next!
        </p>
      </div>
    );
  }

  // Actors can't guess
  if (isActor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-cyan-100">
        <div className="text-6xl mb-4">😏</div>
        <h2 className="text-2xl font-bold text-blue-800 mb-2">
          Players are guessing your number
        </h2>
        <p className="text-blue-600">Sit back and watch!</p>
      </div>
    );
  }

  // Player already submitted — waiting for others
  if (hasFinished) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-cyan-100">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-blue-800 mb-2">
          Guesses submitted!
        </h2>
        <p className="text-blue-600 animate-pulse">
          Waiting for other players to finish guessing...
        </p>
      </div>
    );
  }

  // Regular player: Submit guesses
  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-gradient-to-b from-blue-50 to-cyan-100">
      <h2 className="text-2xl font-bold text-blue-800 mb-2">
        🎯 Guess the Numbers!
      </h2>
      <p className="text-blue-600 mb-6">
        What number did each actor have?
      </p>

      {/* One Card per actor */}
      <div className="w-full max-w-sm space-y-6 mb-6">
        {actors.map((actor) => (
          <Card key={actor.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎭 {actor.name}
                {localGuesses.has(actor.id) && (
                  <Badge className="bg-green-100 text-green-700 border-green-300" variant="outline">
                    ✓ {localGuesses.get(actor.id)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {numbers.map((num) => (
                  <Button
                    key={num}
                    variant={localGuesses.get(actor.id) === num ? "default" : "outline"}
                    onClick={() => handleGuess(actor.id, num)}
                    className={`aspect-square text-sm font-bold transition-all ${
                      localGuesses.get(actor.id) === num
                        ? "bg-blue-600 text-white scale-105 shadow"
                        : "hover:bg-blue-50"
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

      {/* Submit all guesses */}
      <Button
        onClick={onFinishGuessing}
        disabled={!allGuessed}
        size="lg"
        className="w-full max-w-sm py-6 rounded-2xl text-lg font-bold bg-blue-500 hover:bg-blue-600 text-white"
      >
        {allGuessed ? "Submit Guesses 🎯" : "Guess for all actors first"}
      </Button>
    </div>
  );
}
