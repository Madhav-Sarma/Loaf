import { Crown, Sparkles, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnimatedButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  type?: "button" | "submit";
}

export function AnimatedButton({
  children,
  onClick,
  disabled,
  className,
  icon,
  type = "button",
}: AnimatedButtonProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 w-full rounded-2xl border border-indigo-300/30 bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(129,140,248,0.55)] active:scale-95 disabled:opacity-40",
        className
      )}
    >
      <span className="inline-flex items-center gap-2 pulse-glow">
        {icon}
        {children}
      </span>
    </Button>
  );
}

interface GameCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function GameCard({
  title,
  subtitle,
  children,
  className,
  contentClassName,
}: GameCardProps) {
  return (
    <Card
      className={cn(
        "border border-white/40 bg-white/70 backdrop-blur-md shadow-xl shadow-slate-900/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_35px_rgba(20,20,60,0.55)] dark:border-indigo-200/20 dark:bg-slate-900/55 dark:shadow-black/35",
        className
      )}
    >
      {(title || subtitle) && (
        <CardHeader className="pb-2">
          {title ? <CardTitle className="text-slate-900 dark:text-slate-100">{title}</CardTitle> : null}
          {subtitle ? <p className="text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
        </CardHeader>
      )}
      <CardContent className={cn("space-y-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

interface PlayerAvatarProps {
  name: string;
  isHost?: boolean;
  isSelf?: boolean;
}

export function PlayerAvatar({ name, isHost, isSelf }: PlayerAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="inline-flex items-center gap-2 wiggle-hover">
      <div className="flex size-9 items-center justify-center rounded-full bg-linear-to-br from-cyan-400 to-indigo-500 text-sm font-bold text-white shadow-md shadow-cyan-500/30 transition-transform duration-200 hover:scale-110">
        {initial}
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{name}</span>
        {isHost ? <Crown className="size-4 text-amber-400 transition-transform duration-200 hover:rotate-12" /> : null}
        {isSelf ? <Badge className="bg-cyan-500 text-white">You</Badge> : null}
      </div>
    </div>
  );
}

interface PhaseHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  roundLabel?: string;
}

export function PhaseHeader({ title, subtitle, icon, roundLabel }: PhaseHeaderProps) {
  return (
    <div className="space-y-2 text-center">
      {roundLabel ? (
        <Badge className="border-cyan-300/40 bg-cyan-100 text-cyan-700 dark:bg-cyan-400/20 dark:text-cyan-200">{roundLabel}</Badge>
      ) : null}
      <h2 className="inline-flex items-center justify-center gap-2 text-3xl font-black tracking-wide text-slate-900 dark:text-slate-50 sm:text-4xl">
        {icon}
        {title}
      </h2>
      {subtitle ? <p className="mx-auto max-w-md text-base text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
    </div>
  );
}

interface ScoreBadgeProps {
  score: number;
  highlight?: boolean;
}

export function ScoreBadge({ score, highlight }: ScoreBadgeProps) {
  return (
    <Badge
      className={cn(
        "h-7 px-3 text-sm font-bold",
        highlight
          ? "bg-linear-to-r from-cyan-400 to-blue-500 text-slate-950"
          : "bg-slate-100 text-slate-700 dark:bg-slate-700/80 dark:text-slate-100"
      )}
    >
      {score} pts
    </Badge>
  );
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

interface AnimatedLeaderboardProps {
  players: LeaderboardEntry[];
  currentPlayerId: string;
  className?: string;
}

export function AnimatedLeaderboard({
  players,
  currentPlayerId,
  className,
}: AnimatedLeaderboardProps) {
  return (
    <GameCard
      className={className}
      title={
        <span className="inline-flex items-center gap-2">
          <Trophy className="size-5 text-amber-500" />
          Leaderboard
        </span>
      }
      contentClassName="space-y-2"
    >
      {players.map((player, index) => {
        const isTop = index === 0;
        return (
          <div
            key={`${player.id}-${player.score}`}
            className={cn(
              "flex items-center justify-between rounded-xl border p-3 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-1",
              isTop
                ? "border-cyan-300/45 bg-linear-to-r from-cyan-100 to-indigo-100 shadow-md dark:from-cyan-400/20 dark:to-indigo-400/25 dark:shadow-cyan-500/20"
                : "border-white/40 bg-white/75 dark:border-indigo-200/20 dark:bg-slate-800/65"
            )}
          >
            <div className="inline-flex items-center gap-2">
              <span className="w-8 text-center font-bold text-slate-500 dark:text-slate-400">#{index + 1}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {player.name}
                {player.id === currentPlayerId ? " (you)" : ""}
              </span>
              {isTop ? <Sparkles className="size-4 text-cyan-300 pulse-glow" /> : null}
            </div>
            <ScoreBadge score={player.score} highlight={isTop} />
          </div>
        );
      })}
    </GameCard>
  );
}

export function WaitingPanel({ message, detail }: { message: string; detail: string }) {
  return (
    <GameCard className="w-full max-w-md text-center" contentClassName="space-y-3 py-4">
      <Users className="mx-auto size-10 text-cyan-300 pulse-glow" />
      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{message}</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">{detail}</p>
    </GameCard>
  );
}

export function ConfettiBurst() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {[...Array.from({ length: 24 })].map((_, index) => (
        <span
          key={index}
          className="confetti-piece absolute top-0 block h-2 w-2 rounded-sm"
          style={{
            left: `${(index % 12) * 8 + Math.random() * 3}%`,
            animationDelay: `${(index % 6) * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function PhaseShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "relative mx-auto flex w-full max-w-xl flex-col items-center gap-5 px-4 pb-8 pt-5 sm:pt-8",
        className
      )}
    >
      {children}
    </section>
  );
}
