// ============================================================
// PromptWriting.tsx — Guesser writes the action prompt
// ============================================================
// 💡 The guesser creates a fun prompt like "Dance like your number"
// or "Clap X times" — the actors will then perform this action
// in a way that hints at their secret number.
// Uses shadcn Textarea, Card, and Button components.
// ============================================================

import { useState } from "react";
import type { GameState } from "../engine/gameTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface PromptWritingProps {
  state: GameState;
  playerId: string;
  onSubmitPrompt: (prompt: string) => void;
}

// Some example prompts to inspire the guesser
const EXAMPLE_PROMPTS = [
  "Dance for your number of seconds",
  "Clap your number of times",
  "Draw something with your number of lines",
  "Say a word with your number of letters",
  "Do your number of push-ups",
  "Hum a song for your number of seconds",
];

export function PromptWriting({
  state,
  playerId,
  onSubmitPrompt,
}: PromptWritingProps) {
  const [prompt, setPrompt] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isGuesser = state.currentRound?.guesserId === playerId;

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (trimmed.length > 0) {
      onSubmitPrompt(trimmed);
      setHasSubmitted(true);
    }
  };

  // Pick a stable random example based on round number
  const exampleIndex =
    (state.currentRound?.roundNumber ?? 0) % EXAMPLE_PROMPTS.length;

  if (isGuesser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-emerald-50 to-teal-100">
        <h2 className="text-2xl font-bold text-emerald-800 mb-2">
          ✍️ Write the Action
        </h2>
        <p className="text-emerald-600 mb-6 text-center max-w-xs">
          Write a prompt that actors will perform. Their performance should
          somehow reflect their secret number.
        </p>

        {hasSubmitted ? (
          <Card className="text-center p-6 max-w-sm">
            <CardContent className="flex flex-col items-center gap-4">
              <div className="text-6xl">📝</div>
              <p className="text-emerald-700 font-medium">Prompt submitted!</p>
              <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                "{state.currentRound?.actionPrompt || prompt}"
              </Badge>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-sm p-4">
            <CardContent className="space-y-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={EXAMPLE_PROMPTS[exampleIndex]}
                maxLength={200}
                rows={3}
                className="text-lg border-emerald-200 focus:border-emerald-500 resize-none"
              />
              <p className="text-xs text-emerald-400 text-right">
                {prompt.length}/200
              </p>
              <Button
                onClick={handleSubmit}
                disabled={prompt.trim().length === 0}
                size="lg"
                className="w-full py-6 rounded-2xl text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Submit Prompt ✨
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Non-guesser waiting view
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-emerald-50 to-teal-100">
      <div className="text-6xl mb-4 animate-bounce">✍️</div>
      <h2 className="text-2xl font-bold text-emerald-800 mb-2">
        Guesser is writing...
      </h2>
      <p className="text-emerald-600 animate-pulse">
        They're coming up with an action for actors to perform
      </p>
    </div>
  );
}
