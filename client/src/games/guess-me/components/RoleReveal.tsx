// ============================================================
// RoleReveal.tsx — Shows players their role for this round
// ============================================================
// 💡 This is a simple "announcement" screen. It builds suspense
// by telling each player what their role is before the action.
// Uses a Wigggle Widget for the role card display.
// ============================================================

import type { GameState } from "../engine/gameTypes";
import { Eye, Handshake, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { AnimatedButton, GameCard, PhaseHeader, PhaseShell } from "./GameUi";

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
      icon: <Search className="size-12 text-violet-500" />,
      title: "You are the Guesser!",
      description: "Write an action prompt for the actors, then try to guess their secret numbers!",
      textColor: "text-violet-800",
      badgeClass: "bg-violet-100 text-violet-700",
    },
    actor: {
      icon: <Handshake className="size-12 text-orange-500" />,
      title: "You are an Actor!",
      description: "Pick a secret number, then perform the action based on your number!",
      textColor: "text-orange-800",
      badgeClass: "bg-orange-100 text-orange-700",
    },
    player: {
      icon: <Eye className="size-12 text-cyan-500" />,
      title: "You are a Viewer!",
      description: "Watch the performances and try to guess each actor's secret number!",
      textColor: "text-blue-800",
      badgeClass: "bg-blue-100 text-blue-700",
    },
  };

  const config = roleConfig[currentPlayer.role];

  return (
    <PhaseShell>
      <PhaseHeader
        title="Role Reveal"
        subtitle="Keep it secret. Play your role like a pro and fool your friends."
        icon={<Sparkles className="size-6 text-fuchsia-500 animate-pulse" />}
        roundLabel={`Round ${gameState.roundCount} / ${gameState.settings.totalRounds}`}
      />

      <GameCard className="w-full max-w-lg text-center" contentClassName="space-y-5 py-3">
        <div className="mx-auto inline-flex rounded-2xl bg-white p-4 shadow-sm">{config.icon}</div>
        <h1 className={`text-2xl font-black ${config.textColor}`}>{config.title}</h1>
        <p className="mx-auto max-w-sm text-sm text-slate-600 sm:text-base">{config.description}</p>
        <Badge className={config.badgeClass}>Ready for this round</Badge>
        <AnimatedButton
          onClick={onContinue}
          className="mx-auto h-12 max-w-sm"
          icon={<Sparkles className="size-4" />}
        >
          Got It
        </AnimatedButton>
      </GameCard>
    </PhaseShell>
  );
}
