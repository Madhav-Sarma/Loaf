// ============================================================
// NumberSelection.tsx — Everyone picks their numbers
// ============================================================
// 💡 In Guess Me, ALL players pick a number simultaneously.
// Actors' numbers are used for scoring — they perform based
// on their number. Other players and the guesser also pick
// to keep everyone engaged and the game interactive.
// ============================================================

import { useState } from "react";
import type { GameState } from "../engine/gameTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NumberSelectionProps {
  state: GameState;
  playerId: string;
  onSubmitNumber: (number: number) => void;
}

export function NumberSelection({
  state,
  playerId,
  onSubmitNumber,
}: NumberSelectionProps) {
  const { min, max } = state.settings.numberRange;
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const currentPlayer = state.players.find((p) => p.id === playerId);
  const isActor = currentPlayer?.role === "actor";
  const isGuesser = currentPlayer?.role === "guesser";

  // Generate the array of numbers to display as buttons
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const handleSubmit = () => {
    if (selectedNumber !== null) {
      onSubmitNumber(selectedNumber);
      setHasSubmitted(true);
    }
  };

  // Guesser doesn't pick a number — just waits
  if (isGuesser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-50 to-purple-100">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold text-indigo-800 mb-2">
          Players are picking numbers...
        </h2>
        <p className="text-indigo-600 animate-pulse">
          You'll write the action prompt next!
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-50 to-purple-100">
      <h2 className="text-2xl font-bold text-indigo-800 mb-1">
        {isActor ? "🤫 Pick Your Secret Number" : "🎲 Pick a Number"}
      </h2>
      <p className="text-indigo-600 mb-2 text-center max-w-xs">
        {isActor
          ? "This is your secret — don't let anyone see!"
          : "Everyone picks at the same time!"}
      </p>
      {isActor && (
        <Badge variant="outline" className="mb-4 text-purple-700 border-purple-300 bg-purple-50">
          🎭 You are an Actor
        </Badge>
      )}

      {hasSubmitted ? (
        <Card className="text-center p-6">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="text-6xl">✅</div>
            <p className="font-medium text-indigo-700">
              Number locked in! Waiting for others...
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Number grid — shadcn Button for each number */}
          <div className="grid grid-cols-5 gap-3 mb-6 w-full max-w-xs">
            {numbers.map((num) => (
              <Button
                key={num}
                variant={selectedNumber === num ? "default" : "outline"}
                onClick={() => setSelectedNumber(num)}
                className={`aspect-square text-xl font-bold transition-all ${
                  selectedNumber === num
                    ? "bg-indigo-600 text-white scale-110 shadow-lg"
                    : "hover:bg-indigo-50"
                }`}
              >
                {num}
              </Button>
            ))}
          </div>

          {/* Confirm button */}
          <Button
            onClick={handleSubmit}
            disabled={selectedNumber === null}
            size="lg"
            className="w-full max-w-xs py-6 rounded-2xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {selectedNumber !== null
              ? `Lock in ${selectedNumber} 🔒`
              : "Pick a number first"}
          </Button>
        </>
      )}
    </div>
  );
}
