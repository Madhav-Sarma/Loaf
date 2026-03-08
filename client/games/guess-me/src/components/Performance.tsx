// ============================================================
// Performance.tsx — Actors perform one at a time (in line)
// ============================================================
// 💡 This is the "stage" — one actor performs at a time while
// everyone watches. The guesser controls when to move to the
// next actor by clicking "Next Performer."
// Actors perform sequentially (in line), one after another.
// ============================================================

import type { GameState } from "../engine/gameTypes";
import { getCurrentPerformer } from "../engine/gameEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-rose-50 to-pink-100">
      {/* Progress indicator */}
      <Badge variant="outline" className="mb-4 text-rose-500 border-rose-300">
        Performer {performerIndex} of {totalPerformers}
      </Badge>

      {/* The stage — shadcn Card */}
      <Card className="w-full max-w-sm mb-6 text-center">
        <CardHeader>
          <div className="text-5xl mb-2">🎭</div>
          <CardTitle className="text-xl text-rose-800">
            {performer.name}'s Turn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-rose-50 rounded-xl p-4">
            <p className="text-sm text-rose-400 mb-1">Action Prompt</p>
            <p className="text-lg font-medium text-rose-700">
              "{round.actionPrompt}"
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Role-specific messages */}
      {isPerformer && (
        <div className="w-full max-w-sm text-center mb-6">
          <p className="text-rose-700 font-medium text-lg">
            🌟 You're up! Perform the action!
          </p>
          <p className="text-rose-500 text-sm mt-1">
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
        <Button
          onClick={() => onCompletePerformance(performer.id)}
          size="lg"
          className="w-full max-w-sm py-6 rounded-2xl text-lg font-bold bg-rose-500 hover:bg-rose-600 text-white"
        >
          {performerIndex < totalPerformers
            ? "Next Performer ➡️"
            : "All Done — Start Guessing! 🎯"}
        </Button>
      )}
    </div>
  );
}
