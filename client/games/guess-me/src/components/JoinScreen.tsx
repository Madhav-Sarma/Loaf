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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 flex flex-col items-center justify-center p-4">
      {/* Title / Branding */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-amber-800 mb-2">🍞 Loaf</h1>
        <p className="text-amber-600 text-lg">Party games with friends</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">
            {mode === "create" ? "Create a Room" : mode === "join" ? "Join a Room" : "Let's Play!"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Player Name (always shown) */}
          <div className="space-y-2">
            <Label htmlFor="playerName">Your Name</Label>
            <Input
              id="playerName"
              placeholder="Enter your name..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
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
              <Button
                className="w-full h-12 text-base"
                onClick={() => setMode("create")}
                disabled={playerName.trim().length === 0}
              >
                Create Room
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => setMode("join")}
                disabled={playerName.trim().length === 0}
              >
                Join Room
              </Button>
            </div>
          )}

          {/* Create Room Mode */}
          {mode === "create" && (
            <div className="space-y-3 pt-2">
              <Button
                className="w-full h-12 text-base"
                onClick={handleCreate}
                disabled={isConnecting || playerName.trim().length === 0}
              >
                {isConnecting ? "Creating..." : "Create Room"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setMode(null)}
              >
                Back
              </Button>
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
                  className="text-center text-2xl tracking-widest font-bold uppercase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoin();
                  }}
                />
              </div>
              <Button
                className="w-full h-12 text-base"
                onClick={handleJoin}
                disabled={
                  isConnecting ||
                  playerName.trim().length === 0 ||
                  roomCode.trim().length === 0
                }
              >
                {isConnecting ? "Joining..." : "Join Room"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setMode(null)}
              >
                Back
              </Button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded-md">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-amber-600/60 mt-6">
        Get 3+ friends together and play on your phones!
      </p>
    </div>
  );
}
