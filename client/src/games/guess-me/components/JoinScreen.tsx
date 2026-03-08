// ============================================================
// JoinScreen.tsx — Room creation and joining screen
// ============================================================
//
// 💡 This is the first thing players see. They can either:
// 1. Create a new room (become the host)
// 2. Join an existing room with a room code
//
// This component handles the "pre-game" networking — once
// the player is in a room, the existing game components take over.
// ============================================================

import { useState } from "react";
import { ArrowLeft, DoorOpen, Sparkles, UserPlus, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { AnimatedButton, GameCard, PhaseHeader, PhaseShell } from "./GameUi";

interface JoinScreenProps {
  // 💡 These come from the useGameSocket hook via App.tsx
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  isConnecting: boolean;
  error: string | null;
}

export function JoinScreen({
  onCreateRoom,
  onJoinRoom,
  isConnecting,
  error,
}: JoinScreenProps) {
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  // 💡 "mode" toggles between creating and joining a room.
  // null = initial state (show both options)
  const [mode, setMode] = useState<"create" | "join" | null>(null);

  const handleCreate = () => {
    if (playerName.trim().length === 0) return;
    onCreateRoom(playerName.trim());
  };

  const handleJoin = () => {
    if (playerName.trim().length === 0 || roomCode.trim().length === 0) return;
    onJoinRoom(roomCode.trim(), playerName.trim());
  };

  return (
    <div className="phase-bg min-h-screen">
      <PhaseShell>
        <PhaseHeader
          title="Welcome To Loaf"
          subtitle="Create a room or jump into one with your friends in seconds."
          icon={<Sparkles className="size-6 text-orange-500 animate-pulse" />}
        />

        <GameCard
          className="w-full max-w-md"
          title={mode === "create" ? "Create Room" : mode === "join" ? "Join Room" : "Let's Play"}
          subtitle="Large buttons and fast flow for mobile party sessions."
        >
          {/* Player Name (always shown) */}
          <div className="space-y-2">
            <Label htmlFor="playerName">Your name</Label>
            <Input
              id="playerName"
              placeholder="Enter your name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="h-12 rounded-xl border-white/60 bg-white/80 text-base"
              // 💡 onKeyDown handles Enter key for quick submission
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (mode === "create") handleCreate();
                  else if (mode === "join") handleJoin();
                }
              }}
            />
          </div>

          {/* Show mode selection initially */}
          {mode === null && (
            <div className="space-y-3 pt-2">
              <AnimatedButton
                onClick={() => setMode("create")}
                disabled={playerName.trim().length === 0}
                icon={<UserPlus className="size-4 transition-transform group-hover/button:rotate-6" />}
              >
                Create Room
              </AnimatedButton>
              <AnimatedButton
                className="bg-linear-to-r from-cyan-500 via-sky-400 to-indigo-500"
                onClick={() => setMode("join")}
                disabled={playerName.trim().length === 0}
                icon={<DoorOpen className="size-4 transition-transform group-hover/button:-translate-y-0.5" />}
              >
                Join Room
              </AnimatedButton>
            </div>
          )}

          {/* Create Room Mode */}
          {mode === "create" && (
            <div className="space-y-3 pt-2">
              <AnimatedButton
                onClick={handleCreate}
                disabled={isConnecting || playerName.trim().length === 0}
                icon={<Users className="size-4" />}
              >
                {isConnecting ? "Creating..." : "Create Room"}
              </AnimatedButton>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/70 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
                onClick={() => setMode(null)}
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            </div>
          )}

          {/* Join Room Mode */}
          {mode === "join" && (
            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  placeholder="Enter room code..."
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  // 💡 Make the input uppercase as you type for consistency
                  className="h-14 rounded-xl border-white/60 bg-white/80 text-center text-2xl tracking-[0.35em] font-black uppercase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoin();
                  }}
                />
              </div>
              <AnimatedButton
                className="bg-linear-to-r from-cyan-500 via-sky-400 to-indigo-500"
                onClick={handleJoin}
                disabled={
                  isConnecting ||
                  playerName.trim().length === 0 ||
                  roomCode.trim().length === 0
                }
                icon={<DoorOpen className="size-4" />}
              >
                {isConnecting ? "Joining..." : "Join Room"}
              </AnimatedButton>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/70 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
                onClick={() => setMode(null)}
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-center text-sm text-red-700">
              {error}
            </p>
          )}
        </GameCard>

        <Badge className="border-orange-200 bg-orange-100 text-orange-700">
          Best with 3+ players
        </Badge>
      </PhaseShell>
    </div>
  );
}
