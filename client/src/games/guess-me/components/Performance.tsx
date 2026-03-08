// ============================================================
// Performance.tsx — Actors perform one at a time (in line)
// ============================================================
// 💡 This is the "stage" — one actor performs at a time while
// everyone watches. The guesser controls when to move to the
// next actor by clicking "Next Performer."
// Actors perform sequentially (in line), one after another.
// ============================================================

import { useEffect, useState } from "react";

import type { GameState } from "../engine/gameTypes";
import { getCurrentPerformer } from "../engine/gameEngine";
import { Mic2, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { AnimatedButton, GameCard, PhaseHeader, PhaseShell } from "./GameUi";

interface PerformanceProps {
  state: GameState;
  playerId: string;
  onCompletePerformance: (actorId: string) => void;
}

export function Performance({
  state,
  playerId,
  onCompletePerformance,
}: PerformanceProps) {
  const performer = getCurrentPerformer(state);
  const isGuesser = state.currentRound?.guesserId === playerId;
  const isPerformer = performer?.id === playerId;
  const round = state.currentRound;

  if (!round || !performer) return null;

  const performerIndex = round.currentPerformerIndex + 1;
  const totalPerformers = round.actorIds.length;
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(true);

  useEffect(() => {
    setCountdown(3);
    setShowCountdown(true);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowCountdown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 650);

    return () => clearInterval(interval);
  }, [performer.id, round.currentPerformerIndex]);

  return (
    <PhaseShell>
      <PhaseHeader
        title="Performance Stage"
        subtitle="One actor at a time. Watch closely for hidden number clues."
        icon={<Mic2 className="size-6 text-rose-500" />}
      />

      {/* Progress indicator */}
      <Badge variant="outline" className="mb-2 border-rose-200 bg-rose-100 text-rose-700">
        <Timer className="size-3.5" />
        Performer {performerIndex} of {totalPerformers}
      </Badge>

      {/* The stage — shadcn Card */}
      <GameCard className="w-full max-w-md text-center" title={`${performer.name}'s Turn`}>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-500">Action Prompt</p>
            <p className="text-base font-semibold text-rose-700 sm:text-lg">
              "{round.actionPrompt}"
            </p>
          </div>
      </GameCard>

      {showCountdown && (
        <div className="glass-surface pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55">
          <div className="text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-cyan-200">Performance starts in</p>
            <p className="bounce-soft text-8xl font-black text-white sm:text-9xl">
              {countdown > 0 ? countdown : "🎭"}
            </p>
            <p className="mt-3 text-2xl font-bold text-fuchsia-200">Perform!</p>
          </div>
        </div>
      )}

      {/* Role-specific messages */}
      {isPerformer && (
        <div className="w-full max-w-sm text-center mb-6">
          <p className="text-lg font-bold text-rose-700">
            🌟 You're up! Perform the action!
          </p>
          <p className="mt-1 text-sm text-rose-500">
            Remember your secret number — let it guide your performance
          </p>
        </div>
      )}

      {!isPerformer && !isGuesser && (
        <p className="text-rose-600 mb-6">
          Watch carefully and try to figure out their number! 👀
        </p>
      )}

      {/* Guesser controls — only the guesser can advance */}
      {isGuesser && (
        <AnimatedButton
          onClick={() => onCompletePerformance(performer.id)}
          className="h-14 w-full max-w-sm bg-linear-to-r from-rose-500 via-pink-500 to-orange-400 text-lg"
          icon={<Mic2 className="size-5" />}
        >
          {performerIndex < totalPerformers
            ? "Next Performer ➡️"
            : "All Done — Start Guessing! 🎯"}
        </AnimatedButton>
      )}
    </PhaseShell>
  );
}
