import { PauseIcon, PlayIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMusic } from "@/contexts/MusicContext";

interface AudioTrackItem {
  id: string;
  src: string;
  data: {
    title: string;
    artist: string;
  };
}

export const exampleTrack: AudioTrackItem = {
  id: "sample-1",
  src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  data: {
    title: "Summer Vibes",
    artist: "Sample Artist",
  },
};

function formatTime(time: number) {
  if (!time || Number.isNaN(time)) {
    return "0:00";
  }

  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function AudioPlayerProgress({ className }: { className?: string }) {
  const { currentTime, duration } = useMusic();
  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/30", className)}>
      <div
        className="h-full rounded-full bg-cyan-300 transition-all duration-300"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );
}

export function AudioPlayerTime({ className }: { className?: string }) {
  const { currentTime } = useMusic();
  return <span className={className}>{formatTime(currentTime)}</span>;
}

export function AudioPlayerDuration({ className }: { className?: string }) {
  const { duration } = useMusic();
  return <span className={className}>{formatTime(duration)}</span>;
}

export function AudioPlayerButton({
  item,
  className,
  variant = "default",
  size = "default",
}: {
  item: AudioTrackItem;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { currentTrack, isPlaying, setCurrentTrack, togglePlay } = useMusic();
  const isActiveTrack = currentTrack?.id === item.id;

  const handleClick = () => {
    if (!isActiveTrack) {
      setCurrentTrack({
        id: item.id,
        title: item.data.title,
        artist: item.data.artist,
        url: item.src,
      });
      return;
    }

    togglePlay();
  };

  return (
    <Button onClick={handleClick} className={className} variant={variant} size={size}>
      {isActiveTrack && isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
    </Button>
  );
}
