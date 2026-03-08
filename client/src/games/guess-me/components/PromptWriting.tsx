// ============================================================
// PromptWriting.tsx — Guesser writes the action prompt
// ============================================================
// 💡 The guesser creates a fun prompt like "Dance like your number"
// or "Clap X times" — the actors will then perform this action
// in a way that hints at their secret number.
// Uses shadcn Textarea, Card, and Button components.
// ============================================================

import { useState } from "react";
import { Edit3, Sparkles, WandSparkles } from "lucide-react";

import type { GameState } from "../engine/gameTypes";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import { AnimatedButton, GameCard, PhaseHeader, PhaseShell, WaitingPanel } from "./GameUi";

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
      <PhaseShell>
        <PhaseHeader
          title="Write The Action"
          subtitle="Create a short prompt that actors can perform based on their hidden number."
          icon={<Edit3 className="size-6 text-emerald-500" />}
        />

        {hasSubmitted ? (
          <GameCard className="w-full max-w-md text-center" contentClassName="space-y-4 py-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
              <WandSparkles className="size-7 text-emerald-600" />
            </div>
            <p className="font-semibold text-slate-900">Prompt submitted!</p>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700 text-wrap whitespace-normal">
                "{state.currentRound?.actionPrompt || prompt}"
              </Badge>
          </GameCard>
        ) : (
          <GameCard className="w-full max-w-md" contentClassName="space-y-3">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={EXAMPLE_PROMPTS[exampleIndex]}
                maxLength={200}
                rows={3}
                className="min-h-28 rounded-2xl border-white/60 bg-white/85 text-base sm:text-lg focus:border-emerald-500 resize-none"
              />
              <p className="text-right text-xs font-semibold text-slate-500">
                {prompt.length}/200
              </p>
              <AnimatedButton
                onClick={handleSubmit}
                disabled={prompt.trim().length === 0}
                className="h-14 bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-400 text-lg"
                icon={<Sparkles className="size-5" />}
              >
                Submit Prompt
              </AnimatedButton>
          </GameCard>
        )}
      </PhaseShell>
    );
  }

  // Non-guesser waiting view
  return (
    <PhaseShell>
      <WaitingPanel
        message="Guesser is writing"
        detail="They are crafting the action prompt for this round."
      />
    </PhaseShell>
  );
}
