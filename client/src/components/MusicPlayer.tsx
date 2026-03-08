import { SkipBackIcon, SkipForwardIcon } from "lucide-react";

import { Widget, WidgetContent } from "@/components/ui/widget";
import {
  AudioPlayerButton,
  AudioPlayerDuration,
  AudioPlayerProgress,
  AudioPlayerProvider,
  AudioPlayerTime,
  exampleTrack,
} from "@/components/ui/audio-player";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMusic } from "@/contexts/MusicContext";

export function MusicPlayer() {
  const { currentTrack, nextTrack, previousTrack } = useMusic();

  const activeTrack = currentTrack
    ? {
        id: currentTrack.id,
        src: currentTrack.url,
        data: {
          title: currentTrack.title,
          artist: currentTrack.artist,
        },
      }
    : exampleTrack;

  return (
    <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <AudioPlayerProvider>
        <Widget size="md" className="pointer-events-auto h-44 w-full max-w-md overflow-hidden border-white/20 p-0 shadow-2xl shadow-slate-900/35">
          <WidgetContent>
            <div className="relative size-full">
              <img
                src="https://i.scdn.co/image/ab67616d0000b273dfd5b5d99cf81f1864deef01"
                alt={activeTrack.data.title}
                className="size-full rounded-l-3xl object-cover"
              />
            </div>
            <div className="size-full bg-slate-950/85">
              <div className="flex h-full w-full flex-col items-start justify-between p-5">
                <div className="space-y-0">
                  <Label className="text-base text-slate-100">{activeTrack.data.title}</Label>
                  <Label className="text-muted-foreground text-sm">{activeTrack.data.artist}</Label>
                </div>

                <div className="flex w-full flex-col gap-1.5">
                  <AudioPlayerProgress className="h-full max-h-2 w-full flex-1" />
                  <div className="flex w-full items-center justify-between">
                    <AudioPlayerTime className="text-muted-foreground text-xs" />
                    <AudioPlayerDuration className="text-muted-foreground text-xs" />
                  </div>
                </div>

                <div className="mx-auto flex w-max items-center justify-between gap-x-6">
                  <Button variant="ghost" size="icon-sm" onClick={previousTrack}>
                    <SkipBackIcon className="stroke-muted-foreground" />
                  </Button>
                  <AudioPlayerButton size="icon-sm" variant="secondary" item={activeTrack} />
                  <Button variant="ghost" size="icon-sm" onClick={nextTrack}>
                    <SkipForwardIcon className="stroke-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          </WidgetContent>
        </Widget>
      </AudioPlayerProvider>
    </div>
  );
}
