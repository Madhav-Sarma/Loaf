// ============================================================
// Lobby.tsx — The waiting room before the game starts
// ============================================================
// 💡 This is the first screen players see. The host can:
// - See who's joined
// - Configure game settings
// - Start the game when ready
//
// Uses shadcn Card + Badge for structured layout, and
// Wigggle Widget for the room code display.
// ============================================================

import { useState, useRef } from "react";
import { Crown, Dice6, Settings2, Timer, Users } from "lucide-react";

import type { GameState, GameSettings } from "../engine/gameTypes";
import type { CopyIconHandle } from "@/components/ui/copy";
import { Badge } from "@/components/ui/badge";
import { CopyIcon } from "@/components/ui/copy";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  AnimatedButton,
  GameCard,
  PhaseHeader,
  PhaseShell,
  PlayerAvatar,
} from "./GameUi";

interface LobbyProps {
  gameState: GameState;
  currentPlayerId: string;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onStartGame: () => void;
}

export function Lobby({
  gameState,
  currentPlayerId,
  onUpdateSettings,
  onStartGame,
}: LobbyProps) {
  const isHost = gameState.players.find((p) => p.id === currentPlayerId)?.isHost;
  const canStart = gameState.players.length >= 3;
  const { settings } = gameState;

  const [numberMin, setNumberMin] = useState(settings.numberRange.min);
  const [numberMax, setNumberMax] = useState(settings.numberRange.max);
  const copyIconRef = useRef<CopyIconHandle>(null);

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(gameState.roomId.toUpperCase());
      copyIconRef.current?.startAnimation?.();
      setTimeout(() => {
        copyIconRef.current?.stopAnimation?.();
      }, 1400);
    } catch {
      // Copy failed silently
    }
  };

  return (
    <PhaseShell className="max-w-2xl">
      <PhaseHeader
        title="Room Lobby"
        subtitle="Set the vibe, tune the round settings, and kick off the game."
        icon={<Users className="size-6 text-cyan-500" />}
        roundLabel={`Players ${gameState.players.length}`}
      />

      {/* Room Code display with animated copy action */}
      <div className="group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 p-0.5 shadow-lg shadow-cyan-500/30">
        <div className="relative rounded-[calc(0.875rem-2px)] bg-gradient-to-r from-white/95 to-sky-50/90 px-4 py-2 dark:from-slate-900/95 dark:to-indigo-950/80">
          <p className="font-mono text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-indigo-600 dark:from-cyan-300 dark:to-indigo-400">
            {gameState.roomId.toUpperCase()}
          </p>
        </div>
        <button
          onClick={handleCopyRoomCode}
          className="mr-0.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 p-2 text-white shadow-md shadow-cyan-500/30 transition-all duration-200 hover:scale-110 active:scale-95 dark:shadow-indigo-500/20"
        >
          <CopyIcon ref={copyIconRef} size={18} />
        </button>
      </div>

      {/* Player List — shadcn Card */}
      <GameCard className="w-full" title={`Players (${gameState.players.length})`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="rounded-2xl border border-white/60 bg-white/75 p-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 dark:border-indigo-200/25 dark:bg-slate-800/75"
            >
              <div className="flex items-center justify-between gap-2">
                <PlayerAvatar
                  name={player.name}
                  isHost={player.isHost}
                  isSelf={player.id === currentPlayerId}
                />
                {player.isHost ? (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-200">
                    <Crown className="size-3.5" />
                    Host
                  </Badge>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </GameCard>

      {/* Settings (host only) */}
      {isHost && (
        <GameCard
          className="w-full"
          title={
            <span className="inline-flex items-center gap-2">
              <Settings2 className="size-5 text-fuchsia-500" />
              Game Settings
            </span>
          }
          subtitle="Keep rounds short and readable on phones for faster party flow."
        >
            {/* Number Range */}
            <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Number Range</Label>
              <div className="flex items-center gap-2">
                <Input
                type="number"
                value={numberMin}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNumberMin(val);
                  onUpdateSettings({ numberRange: { min: val, max: numberMax } });
                }}
                className="h-11 w-20 rounded-xl border-white/60 bg-white/80 text-center text-base font-bold text-slate-900 dark:border-indigo-200/30 dark:bg-slate-800/90 dark:text-slate-100"
                min={1}
              />
              <span className="text-slate-500 dark:text-slate-300">to</span>
              <Input
                type="number"
                value={numberMax}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNumberMax(val);
                  onUpdateSettings({ numberRange: { min: numberMin, max: val } });
                }}
                className="h-11 w-20 rounded-xl border-white/60 bg-white/80 text-center text-base font-bold text-slate-900 dark:border-indigo-200/30 dark:bg-slate-800/90 dark:text-slate-100"
                min={numberMin + 1}
              />
              </div>
            </div>

            {/* Actors per round */}
            <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Actors/Round</Label>
              <select
                value={settings.actorsPerRound}
                onChange={(e) =>
                  onUpdateSettings({ actorsPerRound: parseInt(e.target.value, 10) })
                }
                className="h-11 rounded-xl border border-white/60 bg-white/80 px-3 text-sm text-slate-900 dark:border-indigo-200/30 dark:bg-slate-800/90 dark:text-slate-100"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Total rounds */}
            <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total Rounds</Label>
              <select
                value={settings.totalRounds}
                onChange={(e) =>
                  onUpdateSettings({ totalRounds: parseInt(e.target.value, 10) })
                }
                className="h-11 rounded-xl border border-white/60 bg-white/80 px-3 text-sm text-slate-900 dark:border-indigo-200/30 dark:bg-slate-800/90 dark:text-slate-100"
              >
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Guesser selection mode */}
            <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Guesser Pick</Label>
              <select
                value={settings.guesserSelectionMode}
                onChange={(e) =>
                  onUpdateSettings({
                    guesserSelectionMode: e.target.value as "clockwise" | "random",
                  })
                }
                className="h-11 rounded-xl border border-white/60 bg-white/80 px-3 text-sm text-slate-900 dark:border-indigo-200/30 dark:bg-slate-800/90 dark:text-slate-100"
              >
                <option value="clockwise">Clockwise (fair)</option>
                <option value="random">Random (chaotic)</option>
              </select>
            </div>
        </GameCard>
      )}

      {/* Start Button — shadcn Button */}
      {isHost && (
        <AnimatedButton
          onClick={onStartGame}
          disabled={!canStart}
          className="h-14 w-full max-w-md bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-400 text-lg"
          icon={<Dice6 className="size-5 transition-transform duration-200 group-hover/button:rotate-12" />}
        >
          {canStart
            ? "Start Game! 🎮"
            : `Need ${3 - gameState.players.length} more player(s)`}
        </AnimatedButton>
      )}

      {/* Non-host waiting message */}
      {!isHost && (
        <p className="animate-pulse rounded-full bg-white/70 px-4 py-2 text-center text-sm font-semibold text-slate-600 dark:bg-slate-800/75 dark:text-slate-200">
          <Timer className="mr-1 inline size-4 text-cyan-500" />
          Waiting for the host to start the game...
        </p>
      )}
    </PhaseShell>
  );
}
