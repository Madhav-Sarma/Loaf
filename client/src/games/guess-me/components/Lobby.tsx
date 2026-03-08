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

import { useState } from "react";
import { Crown, Dice6, Settings2, Timer, Users } from "lucide-react";

import type { GameState, GameSettings } from "../engine/gameTypes";
import { Badge } from "@/components/ui/badge";
import { Widget, WidgetContent, WidgetHeader, WidgetTitle } from "@/components/ui/widget";
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

  return (
    <PhaseShell className="max-w-2xl">
      <PhaseHeader
        title="Room Lobby"
        subtitle="Set the vibe, tune the round settings, and kick off the game."
        icon={<Users className="size-6 text-cyan-500" />}
        roundLabel={`Players ${gameState.players.length}`}
      />

      {/* Room Code — Wigggle Widget gives it a dashboard-style look */}
      <Widget size="sm" className="border-orange-200 bg-linear-to-b from-orange-50 to-amber-100 shadow-lg shadow-orange-500/15">
        <WidgetHeader className="justify-center">
          <WidgetTitle className="text-orange-600 text-xs tracking-wide uppercase">Room Code</WidgetTitle>
        </WidgetHeader>
        <WidgetContent>
          <span className="text-4xl font-black tracking-[0.4em] text-orange-700 animate-pulse">
            {gameState.roomId}
          </span>
        </WidgetContent>
      </Widget>

      {/* Player List — shadcn Card */}
      <GameCard className="w-full" title={`Players (${gameState.players.length})`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="rounded-2xl border border-white/60 bg-white/75 p-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <PlayerAvatar
                  name={player.name}
                  isHost={player.isHost}
                  isSelf={player.id === currentPlayerId}
                />
                {player.isHost ? (
                  <Badge className="bg-amber-100 text-amber-700">
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
              <Label className="text-sm font-semibold text-slate-700">Number Range</Label>
              <div className="flex items-center gap-2">
                <Input
                type="number"
                value={numberMin}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNumberMin(val);
                  onUpdateSettings({ numberRange: { min: val, max: numberMax } });
                }}
                className="h-11 w-20 rounded-xl border-white/60 bg-white/80 text-center text-base font-bold"
                min={1}
              />
              <span className="text-slate-500">to</span>
              <Input
                type="number"
                value={numberMax}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNumberMax(val);
                  onUpdateSettings({ numberRange: { min: numberMin, max: val } });
                }}
                className="h-11 w-20 rounded-xl border-white/60 bg-white/80 text-center text-base font-bold"
                min={numberMin + 1}
              />
              </div>
            </div>

            {/* Actors per round */}
            <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
              <Label className="text-sm font-semibold text-slate-700">Actors/Round</Label>
              <select
                value={settings.actorsPerRound}
                onChange={(e) =>
                  onUpdateSettings({ actorsPerRound: parseInt(e.target.value, 10) })
                }
                className="h-11 rounded-xl border border-white/60 bg-white/80 px-3 text-sm"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Total rounds */}
            <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
              <Label className="text-sm font-semibold text-slate-700">Total Rounds</Label>
              <select
                value={settings.totalRounds}
                onChange={(e) =>
                  onUpdateSettings({ totalRounds: parseInt(e.target.value, 10) })
                }
                className="h-11 rounded-xl border border-white/60 bg-white/80 px-3 text-sm"
              >
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Guesser selection mode */}
            <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
              <Label className="text-sm font-semibold text-slate-700">Guesser Pick</Label>
              <select
                value={settings.guesserSelectionMode}
                onChange={(e) =>
                  onUpdateSettings({
                    guesserSelectionMode: e.target.value as "clockwise" | "random",
                  })
                }
                className="h-11 rounded-xl border border-white/60 bg-white/80 px-3 text-sm"
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
        <p className="rounded-full bg-white/70 px-4 py-2 text-center text-sm font-semibold text-slate-600 animate-pulse">
          <Timer className="mr-1 inline size-4 text-cyan-500" />
          Waiting for the host to start the game...
        </p>
      )}
    </PhaseShell>
  );
}
