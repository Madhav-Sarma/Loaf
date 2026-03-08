// ============================================================
// App.tsx — Main component for Guess Me (Multiplayer Version)
// ============================================================
//
// 💡 HOW THE MULTIPLAYER FLOW WORKS:
//
// 1. Player opens the app → sees JoinScreen
// 2. Player creates or joins a room → connected to server
// 3. In lobby, host configures settings and starts the game
// 4. All game actions go through the server:
//    Player action → socket emit → server processes → broadcasts state
// 5. This component just renders whatever state the server sends
//
// 💡 BEFORE vs AFTER:
// Before (demo mode): All game logic ran locally with fake players.
// After (multiplayer): All game logic runs on the server. The client
// just sends actions and renders the state it receives. This is
// called "server authority" — the server is the single source of truth.
// ============================================================

import { useState } from "react";
import { GameOver } from "./components/GameOver";
import { GuesserReview } from "./components/GuesserReview";
import { Guessing } from "./components/Guessing";
import { JoinScreen } from "./components/JoinScreen";
import { Lobby } from "./components/Lobby";
import { NumberSelection } from "./components/NumberSelection";
import { Performance } from "./components/Performance";
import { PromptWriting } from "./components/PromptWriting";
import { Reveal } from "./components/Reveal";
import { RoleReveal } from "./components/RoleReveal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGameSocket } from "./hooks/useGameSocket";

export function App() {
  // 💡 The useGameSocket hook manages EVERYTHING about the connection:
  // - Connecting to the server
  // - Creating/joining rooms
  // - Sending game actions
  // - Receiving game state updates
  //
  // We destructure out exactly what we need. Think of it like
  // plugging in a cable — the hook handles all the wiring,
  // and we just use the exposed controls.
  const {
    connectionState,
    playerId,
    error,
    gameState,
    scoreResults,
    createRoom,
    joinRoom,
    startGame,
    updateSettings,
    roleContinue,
    submitNumber,
    submitPrompt,
    completePerformance,
    submitGuess,
    finishGuessing,
    finalizeGuesserReview,
    revealContinue,
    playAgain,
  } = useGameSocket();

  // 💡 Local state for tracking if THIS player has finished guessing.
  // The server tracks this for ALL players, but we also track it
  // locally so we can immediately disable the UI after clicking
  // "finish" (without waiting for the server roundtrip).
  const [hasFinishedGuessing, setHasFinishedGuessing] = useState(false);

  // ----------------------------------------------------------
  // SCREEN 1: Not connected or not in a room → JoinScreen
  // ----------------------------------------------------------
  if (connectionState !== "in-room" || !gameState || !playerId) {
    return (
      <JoinScreen
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        isConnecting={connectionState === "joining"}
        error={
          connectionState === "disconnected"
            ? "Connecting to server..."
            : error
        }
      />
    );
  }

  // ----------------------------------------------------------
  // SCREEN 2: In a room → Show the game!
  // ----------------------------------------------------------
  // 💡 From here, it's just like the old demo code — but instead
  // of calling engine functions directly, we call socket actions.
  // The server runs the engine and broadcasts the result.

  // Reset local guessing state when the phase changes away from guessing
  if (gameState.phase !== "guessing" && hasFinishedGuessing) {
    setHasFinishedGuessing(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100">
      <header className="max-w-md mx-auto px-4 pt-4">
        <Card className="p-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-amber-800">🍞 Guess Me</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                Round {Math.max(gameState.roundCount, 1)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {gameState.phase}
              </Badge>
            </div>
          </div>
        </Card>
      </header>

      <main className="pb-8">
        {gameState.phase === "lobby" && (
          <Lobby
            gameState={gameState}
            currentPlayerId={playerId}
            onUpdateSettings={updateSettings}
            onStartGame={startGame}
          />
        )}

        {gameState.phase === "role-assignment" && (
          <RoleReveal
            gameState={gameState}
            currentPlayerId={playerId}
            onContinue={roleContinue}
          />
        )}

        {gameState.phase === "number-selection" && (
          <NumberSelection
            key={playerId}
            state={gameState}
            playerId={playerId}
            onSubmitNumber={submitNumber}
          />
        )}

        {gameState.phase === "prompt-writing" && (
          <PromptWriting
            state={gameState}
            playerId={playerId}
            onSubmitPrompt={submitPrompt}
          />
        )}

        {gameState.phase === "performance" && (
          <Performance
            state={gameState}
            playerId={playerId}
            onCompletePerformance={completePerformance}
          />
        )}

        {gameState.phase === "guessing" && (
          <Guessing
            key={playerId}
            state={gameState}
            playerId={playerId}
            hasFinished={hasFinishedGuessing}
            onSubmitGuess={submitGuess}
            onFinishGuessing={() => {
              setHasFinishedGuessing(true);
              finishGuessing();
            }}
          />
        )}

        {gameState.phase === "guesser-review" && (
          <GuesserReview
            key={playerId}
            state={gameState}
            playerId={playerId}
            onSubmitGuesserGuess={submitGuess}
            onFinalize={finalizeGuesserReview}
          />
        )}

        {gameState.phase === "reveal" && (
          <Reveal
            state={gameState}
            playerId={playerId}
            scoreResults={scoreResults}
            onContinue={revealContinue}
          />
        )}

        {gameState.phase === "game-over" && (
          <GameOver
            state={gameState}
            playerId={playerId}
            onPlayAgain={playAgain}
          />
        )}
      </main>
    </div>
  );
}
