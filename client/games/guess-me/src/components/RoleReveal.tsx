// ============================================================
// RoleReveal.tsx — Shows players their role for this round
// ============================================================
// 💡 This is a simple "announcement" screen. It builds suspense
// by telling each player what their role is before the action.
// Uses a Wigggle Widget for the role card display.
// ============================================================

import type { GameState } from "../engine/gameTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Widget, WidgetContent, WidgetFooter, WidgetHeader, WidgetTitle } from "@/components/ui/widget";

interface RoleRevealProps {
  gameState: GameState;
  currentPlayerId: string;
  onContinue: () => void;
}

export function RoleReveal({
  gameState,
  currentPlayerId,
  onContinue,
}: RoleRevealProps) {
  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) return null;

  // 💡 Each role gets a different emoji, color, and description.
  const roleConfig = {
    guesser: {
      emoji: "🔍",
      title: "You are the Guesser!",
      description: "Write an action prompt for the actors, then try to guess their secret numbers!",
      bgColor: "bg-purple-50 border-purple-200",
      textColor: "text-purple-800",
      badgeClass: "bg-purple-100 text-purple-700",
      containerBg: "from-purple-50 to-violet-100",
    },
    actor: {
      emoji: "🎭",
      title: "You are an Actor!",
      description: "Pick a secret number, then perform the action based on your number!",
      bgColor: "bg-orange-50 border-orange-200",
      textColor: "text-orange-800",
      badgeClass: "bg-orange-100 text-orange-700",
      containerBg: "from-orange-50 to-amber-100",
    },
    player: {
      emoji: "👀",
      title: "You are a Viewer!",
      description: "Watch the performances and try to guess each actor's secret number!",
      bgColor: "bg-blue-50 border-blue-200",
      textColor: "text-blue-800",
      badgeClass: "bg-blue-100 text-blue-700",
      containerBg: "from-blue-50 to-cyan-100",
    },
  };

  const config = roleConfig[currentPlayer.role];

  return (
    <div className={`flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6 bg-gradient-to-b ${config.containerBg} rounded-2xl mx-4`}>
      {/* Role card as a Wigggle Widget */}
      <Widget size="lg" className={config.bgColor}>
        <WidgetHeader className="justify-center pt-4">
          <WidgetTitle className={config.textColor}>
            <Badge variant="outline" className={config.badgeClass}>
              Round {gameState.roundCount} of {gameState.settings.totalRounds}
            </Badge>
          </WidgetTitle>
        </WidgetHeader>
        <WidgetContent className="flex-col gap-4">
          <span className="text-6xl">{config.emoji}</span>
          <h1 className={`text-2xl font-bold ${config.textColor}`}>
            {config.title}
          </h1>
          <p className="text-center text-gray-600 max-w-xs text-sm whitespace-normal">
            {config.description}
          </p>
        </WidgetContent>
        <WidgetFooter className="justify-center pb-4">
          <Button
            onClick={onContinue}
            size="lg"
            className="px-8 py-3 rounded-lg shadow-md font-semibold"
          >
            Got it!
          </Button>
        </WidgetFooter>
      </Widget>
    </div>
  );
}
