// ============================================================
// GameOver.tsx — Final results screen
// ============================================================
// Uses Wigggle Widget for the winner display and shadcn Card
// for the final standings.
// ============================================================

import type { GameState } from "../engine/gameTypes";
import { getLeaderboard } from "../engine/gameEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Widget, WidgetContent, WidgetFooter, WidgetHeader, WidgetTitle } from "@/components/ui/widget";

interface GameOverProps {
  state: GameState;
  playerId: string;
  onPlayAgain: () => void;
}

export function GameOver({ state, playerId, onPlayAgain }: GameOverProps) {
  const leaderboard = getLeaderboard(state);
  const winner = leaderboard[0];
  const isHost = state.players.find((p) => p.id === playerId)?.isHost ?? false;
  const isWinner = winner?.id === playerId;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-yellow-100 to-amber-200">
      {/* Winner announcement — Wigggle Widget */}
      <Widget size="lg" className="border-amber-300 bg-gradient-to-b from-amber-50 to-yellow-100 mb-8">
        <WidgetHeader className="justify-center pt-2">
          <WidgetTitle className="text-amber-500 text-xs">
            {state.roundCount} rounds played
          </WidgetTitle>
        </WidgetHeader>
        <WidgetContent className="flex-col gap-3">
          <div className="text-7xl">🏆</div>
          <h1 className="text-2xl font-bold text-amber-800">
            {isWinner ? "You Won!" : `${winner?.name} Wins!`}
          </h1>
          <Badge variant="outline" className="text-amber-600 border-amber-300 text-lg px-4 py-1">
            {winner?.score} points
          </Badge>
        </WidgetContent>
        <WidgetFooter />
      </Widget>

      {/* Final leaderboard — shadcn Card */}
      <Card className="w-full max-w-sm mb-8">
        <CardHeader>
          <CardTitle className="text-center text-amber-700">Final Standings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leaderboard.map((player, index) => (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                index === 0
                  ? "bg-amber-400 text-white"
                  : "bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {index === 0
                    ? "🥇"
                    : index === 1
                    ? "🥈"
                    : index === 2
                    ? "🥉"
                    : `#${index + 1}`}
                </span>
                <span className="font-medium">
                  {player.name}
                  {player.id === playerId && " (you)"}
                </span>
              </div>
              <span className="text-xl font-bold">{player.score}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Play again (host only) */}
      {isHost && (
        <Button
          onClick={onPlayAgain}
          size="lg"
          className="w-full max-w-sm py-6 rounded-2xl text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white"
        >
          Play Again 🔄
        </Button>
      )}
    </div>
  );
}
