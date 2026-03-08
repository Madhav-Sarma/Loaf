// ============================================================
// Reveal.tsx — Secret numbers are revealed + scoring
// ============================================================
// 💡 The big moment! We show each actor's secret number and
// who guessed correctly. Then we display the score breakdown.
// Uses shadcn Card + Badge and Wigggle Widget for scores.
// ============================================================

import type { GameState, ScoreResult } from "../engine/gameTypes";
import { getLeaderboard } from "../engine/gameEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Widget, WidgetContent, WidgetHeader, WidgetTitle } from "@/components/ui/widget";

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
    <div className="min-h-screen flex flex-col items-center p-6 bg-gradient-to-b from-yellow-50 to-amber-100">
      <h2 className="text-3xl font-bold text-amber-800 mb-6">
        🎉 The Big Reveal!
      </h2>

      {/* Actor reveals — Wigggle Widgets for each actor's number */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {reveals.map((actor) => (
          <Widget key={actor.playerId} size="sm" className="border-amber-200 bg-amber-50">
            <WidgetHeader className="justify-center">
              <WidgetTitle className="text-amber-600 text-xs">🎭 {actor.name}</WidgetTitle>
            </WidgetHeader>
            <WidgetContent>
              <span className="text-4xl font-bold text-amber-800">
                {actor.secretNumber}
              </span>
            </WidgetContent>
          </Widget>
        ))}
      </div>

      {/* Score breakdown */}
      {scoreResults.length > 0 && (
        <Card className="w-full max-w-sm mb-8">
          <CardHeader>
            <CardTitle className="text-amber-700">Points Earned</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  <span>{playerName}</span>
                  <Badge variant="outline" className={isPositive ? "border-green-300 text-green-700" : "border-red-300 text-red-600"}>
                    {isPositive ? "+" : ""}
                    {result.pointsEarned} — {result.reason}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="w-full max-w-sm mb-8">
        <CardHeader>
          <CardTitle className="text-amber-700">🏆 Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leaderboard.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                index === 0 ? "ring-2 ring-amber-400 bg-amber-50" : "bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                </span>
                <span className="font-medium">
                  {player.name}
                  {player.id === playerId && (
                    <span className="text-amber-500 ml-1">(you)</span>
                  )}
                </span>
              </div>
              <Badge variant="outline" className="text-amber-700 border-amber-300 text-lg font-bold">
                {player.score}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Continue button (host only) */}
      {isHost && (
        <Button
          onClick={onContinue}
          size="lg"
          className="w-full max-w-sm py-6 rounded-2xl text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white"
        >
          {isLastRound ? "See Final Results 🏆" : "Next Round ➡️"}
        </Button>
      )}
    </div>
  );
}
