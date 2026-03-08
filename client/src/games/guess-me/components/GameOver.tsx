// ============================================================
// GameOver.tsx — Final results screen
// ============================================================
// Uses Wigggle Widget for the winner display and shadcn Card
// for the final standings.
// ============================================================

import type { GameState } from "../engine/gameTypes";
import { getLeaderboard } from "../engine/gameEngine";
import { RefreshCcw, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Widget, WidgetContent, WidgetFooter, WidgetHeader, WidgetTitle } from "@/components/ui/widget";

import {
  AnimatedButton,
  AnimatedLeaderboard,
  ConfettiBurst,
  PhaseHeader,
  PhaseShell,
} from "./GameUi";

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
    <PhaseShell className="pb-10">
      <PhaseHeader
        title="Game Over"
        subtitle="Final standings are in. Celebrate, then run it back."
        icon={<Trophy className="size-7 text-amber-500" />}
      />

      {/* Winner announcement — Wigggle Widget */}
      <div className="relative">
        <ConfettiBurst />
        <Widget size="lg" className="mb-6 border-amber-300 bg-linear-to-b from-amber-50 to-yellow-100 shadow-xl shadow-amber-500/20">
        <WidgetHeader className="justify-center pt-2">
          <WidgetTitle className="text-amber-600 text-xs uppercase tracking-wide">
            {state.roundCount} rounds played
          </WidgetTitle>
        </WidgetHeader>
        <WidgetContent className="flex-col gap-3">
          <div className="text-7xl">🏆</div>
          <h1 className="text-2xl font-black text-amber-800 text-center px-4">
            {isWinner ? "You Won!" : `${winner?.name} Wins!`}
          </h1>
          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700 text-lg px-4 py-1">
            {winner?.score} points
          </Badge>
        </WidgetContent>
        <WidgetFooter />
      </Widget>
      </div>

      {/* Final leaderboard — shadcn Card */}
      <AnimatedLeaderboard players={leaderboard} currentPlayerId={playerId} className="w-full max-w-md" />

      {/* Play again (host only) */}
      {isHost && (
        <AnimatedButton
          onClick={onPlayAgain}
          className="h-14 w-full max-w-md bg-linear-to-r from-amber-500 via-orange-500 to-fuchsia-500 text-lg"
          icon={<RefreshCcw className="size-5 transition-transform duration-300 group-hover/button:rotate-180" />}
        >
          Play Again
        </AnimatedButton>
      )}
    </PhaseShell>
  );
}
