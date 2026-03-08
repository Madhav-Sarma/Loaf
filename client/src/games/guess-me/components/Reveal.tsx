// ============================================================
// Reveal.tsx — Secret numbers are revealed + scoring
// ============================================================
// 💡 The big moment! We show each actor's secret number and
// who guessed correctly. Then we display the score breakdown.
// Uses shadcn Card + Badge and Wigggle Widget for scores.
// ============================================================

import type { GameState, ScoreResult } from "../engine/gameTypes";
import { getLeaderboard } from "../engine/gameEngine";
import { Crown, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Widget, WidgetContent, WidgetHeader, WidgetTitle } from "@/components/ui/widget";

import {
  AnimatedButton,
  AnimatedLeaderboard,
  ConfettiBurst,
  GameCard,
  PhaseHeader,
  PhaseShell,
} from "./GameUi";

interface RevealProps {
  state: GameState;
  scoreResults: ScoreResult[];
  onContinue: () => void;
  playerId: string;
}

export function Reveal({
  state,
  scoreResults,
  onContinue,
  playerId,
}: RevealProps) {
  const round = state.currentRound;
  const isHost = state.players.find((p) => p.id === playerId)?.isHost ?? false;
  const leaderboard = getLeaderboard(state);
  const isLastRound = state.roundCount >= state.settings.totalRounds;

  if (!round) return null;

  // Get actor data with names
  const reveals = round.actorData.map((actor) => ({
    ...actor,
    name:
      state.players.find((p) => p.id === actor.playerId)?.name ?? "Unknown",
  }));

  return (
    <PhaseShell className="pb-10">
      <PhaseHeader
        title="The Big Reveal"
        subtitle="Secret numbers are out. Scores update live after every round."
        icon={<Crown className="size-6 text-amber-500" />}
      />

      <div className="relative w-full">
        <ConfettiBurst />

      {/* Actor reveals — Wigggle Widgets for each actor's number */}
      <div className="mb-6 flex flex-wrap justify-center gap-3">
        {reveals.map((actor) => (
          <Widget key={actor.playerId} size="sm" className="border-amber-200 bg-linear-to-b from-amber-50 to-orange-100 shadow-md">
            <WidgetHeader className="justify-center">
              <WidgetTitle className="text-amber-700 text-xs uppercase tracking-wide">🎭 {actor.name}</WidgetTitle>
            </WidgetHeader>
            <WidgetContent>
              <span className="text-4xl font-black text-amber-800">
                {actor.secretNumber}
              </span>
            </WidgetContent>
          </Widget>
        ))}
      </div>
      </div>

      {/* Score breakdown */}
      {scoreResults.length > 0 && (
        <GameCard className="relative w-full max-w-md overflow-hidden" title="Points Earned">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {scoreResults.slice(0, 4).map((result, index) => (
              <span
                key={`${result.playerId}-${index}`}
                className="score-pop absolute text-sm font-black text-cyan-200"
                style={{
                  left: `${14 + index * 20}%`,
                  top: `${72 - index * 10}%`,
                  animationDelay: `${index * 120}ms`,
                }}
              >
                {result.pointsEarned > 0 ? "+" : ""}
                {result.pointsEarned} pts
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {scoreResults.map((result, index) => {
              const playerName =
                state.players.find((p) => p.id === result.playerId)?.name ??
                "Unknown";
              const isPositive = result.pointsEarned > 0;

              return (
                <div
                  key={index}
                  className={`rounded-lg px-4 py-2 text-sm flex justify-between ${
                    isPositive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  <span className="font-semibold">{playerName}</span>
                  <Badge variant="outline" className={isPositive ? "border-emerald-300 text-emerald-700" : "border-rose-300 text-rose-700"}>
                    {isPositive ? "+" : ""}
                    {result.pointsEarned} — {result.reason}
                  </Badge>
                </div>
              );
            })}
          </div>
        </GameCard>
      )}

      {/* Leaderboard */}
      <AnimatedLeaderboard players={leaderboard} currentPlayerId={playerId} className="w-full max-w-md" />

      {/* Continue button (host only) */}
      {isHost && (
        <AnimatedButton
          onClick={onContinue}
          className="h-14 w-full max-w-md bg-linear-to-r from-amber-500 via-orange-500 to-rose-500 text-lg"
          icon={<Trophy className="size-5" />}
        >
          {isLastRound ? "See Final Results" : "Next Round"}
        </AnimatedButton>
      )}
    </PhaseShell>
  );
}
