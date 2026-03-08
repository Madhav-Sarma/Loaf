// ============================================================
// NumberSelection.tsx — Everyone picks their numbers
// ============================================================
// 💡 In Guess Me, ALL players pick a number simultaneously.
// Actors' numbers are used for scoring — they perform based
// on their number. Other players and the guesser also pick
// to keep everyone engaged and the game interactive.
// ============================================================

import { useState } from "react";
import { Dice6, Lock, Search, Sparkles } from "lucide-react";

import type { GameState } from "../engine/gameTypes";
import { Badge } from "@/components/ui/badge";

import { AnimatedButton, GameCard, PhaseHeader, PhaseShell, WaitingPanel } from "./GameUi";

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
      <PhaseShell>
        <WaitingPanel
          message="Players are choosing numbers"
          detail="You will write the action prompt after everyone locks in."
        />
      </PhaseShell>
    );
  }

  return (
    <PhaseShell>
      <PhaseHeader
        title={isActor ? "Pick Your Secret Number" : "Pick A Number"}
        subtitle={
          isActor
            ? "This number guides your performance. Keep it private."
            : "Choose now so you can track the round with everyone else."
        }
        icon={isActor ? <Lock className="size-6 text-fuchsia-500" /> : <Dice6 className="size-6 text-cyan-500" />}
      />

      {isActor && (
        <Badge variant="outline" className="mb-2 border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700">
          <Sparkles className="size-3.5" />
          You are an Actor
        </Badge>
      )}

      {hasSubmitted ? (
        <GameCard className="w-full max-w-md text-center" contentClassName="py-6">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
            <Search className="size-7 text-emerald-600" />
          </div>
          <p className="text-base font-semibold text-slate-800">
              Number locked in! Waiting for others...
          </p>
        </GameCard>
      ) : (
        <>
          {/* Number grid — shadcn Button for each number */}
          <div className="grid w-full max-w-sm grid-cols-5 gap-2 sm:gap-3">
            {numbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setSelectedNumber(num)}
                className={`aspect-square text-xl font-bold transition-all ${
                  selectedNumber === num
                    ? "scale-105 rounded-2xl bg-linear-to-r from-cyan-500 to-indigo-500 text-white shadow-lg"
                    : "rounded-2xl border border-white/70 bg-white/80 text-slate-700 hover:scale-[1.02] hover:bg-white"
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Confirm button */}
          <AnimatedButton
            onClick={handleSubmit}
            disabled={selectedNumber === null}
            className="mt-2 h-14 w-full max-w-sm bg-linear-to-r from-cyan-500 to-indigo-500 text-lg"
            icon={<Lock className="size-5" />}
          >
            {selectedNumber !== null
              ? `Lock in ${selectedNumber}`
              : "Pick a number first"}
          </AnimatedButton>
        </>
      )}
    </PhaseShell>
  );
}
