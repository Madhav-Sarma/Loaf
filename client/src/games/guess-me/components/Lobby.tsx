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
import type { GameState, GameSettings } from "../engine/gameTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Widget, WidgetContent, WidgetHeader, WidgetTitle } from "@/components/ui/widget";
import { Label } from "@/components/ui/label";

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
    <div className="flex flex-col items-center gap-6 p-4 max-w-md mx-auto">
      {/* Room Code — Wigggle Widget gives it a dashboard-style look */}
      <Widget size="sm" className="border-amber-200 bg-amber-50">
        <WidgetHeader className="justify-center">
          <WidgetTitle className="text-amber-500 text-xs">Room Code</WidgetTitle>
        </WidgetHeader>
        <WidgetContent>
          <span className="text-4xl font-bold tracking-widest text-amber-800">
            {gameState.roomId}
          </span>
        </WidgetContent>
      </Widget>

      {/* Player List — shadcn Card */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Players ({gameState.players.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
            >
              <span className="text-base font-medium">{player.name}</span>
              {player.isHost && (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                  Host
                </Badge>
              )}
              {player.id === currentPlayerId && <Badge>You</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Settings (host only) */}
      {isHost && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Number Range */}
            <div className="flex gap-4 items-center">
              <Label className="w-28 text-sm">Number Range</Label>
              <input
                type="number"
                value={numberMin}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNumberMin(val);
                  onUpdateSettings({ numberRange: { min: val, max: numberMax } });
                }}
                className="w-16 p-2 border rounded text-center"
                min={1}
              />
              <span>to</span>
              <input
                type="number"
                value={numberMax}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNumberMax(val);
                  onUpdateSettings({ numberRange: { min: numberMin, max: val } });
                }}
                className="w-16 p-2 border rounded text-center"
                min={numberMin + 1}
              />
            </div>

            {/* Actors per round */}
            <div className="flex gap-4 items-center">
              <Label className="w-28 text-sm">Actors/Round</Label>
              <select
                value={settings.actorsPerRound}
                onChange={(e) =>
                  onUpdateSettings({ actorsPerRound: parseInt(e.target.value, 10) })
                }
                className="p-2 border rounded"
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Total rounds */}
            <div className="flex gap-4 items-center">
              <Label className="w-28 text-sm">Total Rounds</Label>
              <select
                value={settings.totalRounds}
                onChange={(e) =>
                  onUpdateSettings({ totalRounds: parseInt(e.target.value, 10) })
                }
                className="p-2 border rounded"
              >
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Guesser selection mode */}
            <div className="flex gap-4 items-center">
              <Label className="w-28 text-sm">Guesser Pick</Label>
              <select
                value={settings.guesserSelectionMode}
                onChange={(e) =>
                  onUpdateSettings({
                    guesserSelectionMode: e.target.value as "clockwise" | "random",
                  })
                }
                className="p-2 border rounded"
              >
                <option value="clockwise">Clockwise (fair)</option>
                <option value="random">Random (chaotic)</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Button — shadcn Button */}
      {isHost && (
        <Button
          onClick={onStartGame}
          disabled={!canStart}
          size="lg"
          className="w-full py-6 rounded-2xl text-lg font-bold bg-green-500 hover:bg-green-600 text-white"
        >
          {canStart
            ? "Start Game! 🎮"
            : `Need ${3 - gameState.players.length} more player(s)`}
        </Button>
      )}

      {/* Non-host waiting message */}
      {!isHost && (
        <p className="text-muted-foreground text-center animate-pulse">
          Waiting for the host to start the game...
        </p>
      )}
    </div>
  );
}
