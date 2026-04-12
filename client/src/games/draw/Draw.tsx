import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeft,
  Brush,
  Crown,
  DoorOpen,
  Eraser,
  Palette,
  Play,
  Send,
  SkipForward,
  Timer,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import type { DrawStroke, DrawTool } from "../../../../shared/draw/types";
import { useDrawSocket } from "./hooks/useDrawSocket";

const COLOR_PALETTE = [
  "#0f172a",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ffffff",
];

const BRUSH_SIZES = [2, 4, 7, 11, 16];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRoomCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function getInitialName(): string {
  try {
    const stored = window.localStorage.getItem("draw:profile-name");
    if (stored) {
      return stored;
    }
  } catch {
    // Ignore storage failures.
  }

  return `Artist${Math.floor(Math.random() * 900 + 100)}`;
}

function formatPhase(phase: string): string {
  switch (phase) {
    case "word-select":
      return "Word Select";
    case "round-reveal":
      return "Round Reveal";
    case "game-over":
      return "Game Over";
    default:
      return phase.charAt(0).toUpperCase() + phase.slice(1);
  }
}

function drawStrokePath(ctx: CanvasRenderingContext2D, stroke: DrawStroke, width: number, height: number): void {
  if (stroke.points.length === 0) {
    return;
  }

  const [first, ...rest] = stroke.points;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size;

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }

  ctx.beginPath();
  ctx.moveTo(first.x * width, first.y * height);

  for (const point of rest) {
    ctx.lineTo(point.x * width, point.y * height);
  }

  if (stroke.points.length === 1) {
    ctx.lineTo(first.x * width + 0.001, first.y * height + 0.001);
  }

  ctx.stroke();
}

export function Draw() {
  const {
    sessionId,
    connectionState,
    roomCode,
    error,
    state,
    createRoom,
    joinRoom,
    leaveRoom,
    updateSettings,
    startGame,
    pickWord,
    submitGuess,
    sendMessage,
    clearCanvas,
    skipTurn,
    sendStroke,
  } = useDrawSocket();

  const [mode, setMode] = useState<"create" | "join">("create");
  const [nameInput, setNameInput] = useState(getInitialName);
  const [roomInput, setRoomInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState("#0f172a");
  const [size, setSize] = useState(7);
  const [now, setNow] = useState(Date.now());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<{ pointerId: number | null; strokeId: string | null }>({
    pointerId: null,
    strokeId: null,
  });

  const me = useMemo(
    () => state?.players.find((player) => player.sessionId === sessionId) ?? null,
    [sessionId, state?.players]
  );

  const turn = state?.turn ?? null;
  const phase = state?.phase ?? "lobby";
  const isHost = Boolean(me && state && me.id === state.hostId);
  const isArtist = Boolean(me && turn && me.id === turn.artistId);
  const canDraw = phase === "drawing" && isArtist;
  const canGuess = phase === "drawing" && !isArtist && Boolean(me && !me.hasGuessedCurrentTurn);
  const phaseSecondsLeft = turn?.phaseEndsAt
    ? Math.max(0, Math.ceil((turn.phaseEndsAt - now) / 1000))
    : null;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 300);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const renderCanvas = useCallback(
    (strokes: DrawStroke[]) => {
      const canvas = canvasRef.current;
      const wrap = canvasWrapRef.current;
      if (!canvas || !wrap) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const bounds = wrap.getBoundingClientRect();
      const cssWidth = Math.max(200, Math.floor(bounds.width));
      const cssHeight = Math.max(240, Math.floor(bounds.height));

      if (canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)) {
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      for (const stroke of strokes) {
        drawStrokePath(ctx, stroke, cssWidth, cssHeight);
      }

      ctx.globalCompositeOperation = "source-over";
    },
    []
  );

  useEffect(() => {
    renderCanvas(turn?.strokes ?? []);
  }, [renderCanvas, turn?.strokes]);

  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) {
      return;
    }

    const observer = new ResizeObserver(() => {
      renderCanvas(turn?.strokes ?? []);
    });

    observer.observe(wrap);
    return () => {
      observer.disconnect();
    };
  }, [renderCanvas, turn?.strokes]);

  const toNormalizedPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      return null;
    }

    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) {
      return;
    }

    const point = toNormalizedPoint(event);
    if (!point) {
      return;
    }

    const strokeId = `${sessionId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    pointerRef.current = {
      pointerId: event.pointerId,
      strokeId,
    };

    event.currentTarget.setPointerCapture(event.pointerId);

    sendStroke({
      strokeId,
      tool,
      color,
      size,
      point,
      isStart: true,
      isEnd: false,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) {
      return;
    }

    if (pointerRef.current.pointerId !== event.pointerId || !pointerRef.current.strokeId) {
      return;
    }

    const point = toNormalizedPoint(event);
    if (!point) {
      return;
    }

    sendStroke({
      strokeId: pointerRef.current.strokeId,
      tool,
      color,
      size,
      point,
      isStart: false,
      isEnd: false,
    });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) {
      return;
    }

    if (pointerRef.current.pointerId !== event.pointerId || !pointerRef.current.strokeId) {
      return;
    }

    const point = toNormalizedPoint(event);
    if (!point) {
      return;
    }

    sendStroke({
      strokeId: pointerRef.current.strokeId,
      tool,
      color,
      size,
      point,
      isStart: false,
      isEnd: true,
    });

    pointerRef.current = {
      pointerId: null,
      strokeId: null,
    };

    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleJoinSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = nameInput.trim();
    if (!normalizedName) {
      return;
    }

    try {
      window.localStorage.setItem("draw:profile-name", normalizedName);
    } catch {
      // Ignore storage failures.
    }

    if (mode === "create") {
      createRoom(normalizedName);
      return;
    }

    joinRoom(roomInput, normalizedName);
  };

  const handleMessageSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = messageInput.trim();
    if (!text) {
      return;
    }

    if (canGuess) {
      submitGuess(text);
    } else {
      sendMessage(text);
    }

    setMessageInput("");
  };

  if (connectionState !== "in-room" || !state || !me) {
    return (
      <div className="phase-bg min-h-screen px-4 py-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-border/70 bg-card/85 p-6 text-card-foreground shadow-2xl backdrop-blur-md">
          <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to games
          </Link>

          <h1 className="text-4xl font-black tracking-tight text-foreground">Draw Battle</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fast multiplayer sketch rounds with server-authoritative scoring, hints, and reconnect-safe rooms.
          </p>

          <div className="mt-6 inline-flex rounded-2xl bg-muted/70 p-1">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                mode === "create" ? "bg-background text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Create room
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                mode === "join" ? "bg-background text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Join room
            </button>
          </div>

          <form onSubmit={handleJoinSubmit} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-foreground">
              Display name
              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring"
                maxLength={20}
                placeholder="Your nickname"
              />
            </label>

            {mode === "join" && (
              <label className="block text-sm font-semibold text-foreground">
                Room code
                <input
                  value={roomInput}
                  onChange={(event) => setRoomInput(normalizeRoomCode(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm uppercase tracking-[0.25em] text-foreground outline-none transition focus:border-ring"
                  maxLength={6}
                  placeholder="ABC123"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={connectionState === "joining"}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-black uppercase tracking-wide text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connectionState === "joining" ? "Connecting..." : mode === "create" ? "Create room" : "Join room"}
            </button>
          </form>

          {(error || roomCode) && (
            <div className="mt-4 space-y-2 text-sm">
              {roomCode && (
                <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 font-semibold text-primary">
                  Last room: {roomCode}
                </p>
              )}
              {error && (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 font-semibold text-destructive">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="phase-bg min-h-screen pb-8">
      <header className="mx-auto max-w-[1320px] px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card/85 p-3 text-card-foreground shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1 rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary">
              <ArrowLeft className="size-3.5" />
              Home
            </Link>
            <div>
              <h1 className="text-lg font-black text-foreground sm:text-xl">Draw Battle</h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Room {state.roomCode} • {formatPhase(state.phase)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1 rounded-xl bg-secondary px-2 py-1 text-secondary-foreground">
              <Users className="size-3.5" />
              {state.players.filter((player) => player.connected).length}/{state.settings.maxPlayers}
            </span>
            {typeof phaseSecondsLeft === "number" && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-secondary px-2 py-1 text-secondary-foreground">
                <Timer className="size-3.5" />
                {phaseSecondsLeft}s
              </span>
            )}
            <button
              type="button"
              onClick={leaveRoom}
              className="inline-flex items-center gap-1 rounded-xl border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/20"
            >
              <DoorOpen className="size-3.5" />
              Leave
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-3 grid max-w-[1320px] gap-3 px-3 sm:px-4 lg:grid-cols-[90px_190px_minmax(0,1fr)_330px]">
        <section className="rounded-2xl border border-border/70 bg-card/85 p-2 shadow-lg backdrop-blur-md lg:h-[640px]">
          <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">Tools</p>
          <div className="flex flex-row gap-2 lg:flex-col">
            <button
              type="button"
              onClick={() => setTool("pen")}
              className={`flex h-12 w-full items-center justify-center rounded-xl border text-foreground transition ${
                tool === "pen" ? "border-primary bg-primary/10" : "border-input bg-background"
              }`}
              title="Pen"
            >
              <Brush className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setTool("eraser")}
              className={`flex h-12 w-full items-center justify-center rounded-xl border text-foreground transition ${
                tool === "eraser" ? "border-primary bg-primary/10" : "border-input bg-background"
              }`}
              title="Eraser"
            >
              <Eraser className="size-5" />
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              disabled={!canDraw}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-input bg-background text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
              title="Clear canvas"
            >
              CLR
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/85 p-3 shadow-lg backdrop-blur-md lg:h-[640px]">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Palette className="size-3.5" />
            Palette
          </p>

          <div className="grid grid-cols-5 gap-2">
            {COLOR_PALETTE.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setColor(entry)}
                className={`h-8 rounded-md border ${color === entry ? "border-foreground ring-2 ring-ring" : "border-input"}`}
                style={{ backgroundColor: entry }}
                title={entry}
              />
            ))}
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Brush size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BRUSH_SIZES.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setSize(entry)}
                className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                  size === entry ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground"
                }`}
              >
                {entry}px
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted/50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Room controls</p>

            <label className="block text-xs font-semibold text-foreground">
              Rounds
              <input
                type="number"
                min={1}
                max={8}
                value={state.settings.totalRounds}
                onChange={(event) => isHost && updateSettings({ totalRounds: Number(event.target.value) })}
                disabled={!isHost || state.phase !== "lobby"}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>

            <label className="block text-xs font-semibold text-foreground">
              Draw time (sec)
              <input
                type="number"
                min={30}
                max={180}
                value={state.settings.drawTimeSec}
                onChange={(event) => isHost && updateSettings({ drawTimeSec: Number(event.target.value) })}
                disabled={!isHost || state.phase !== "lobby"}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>

            <label className="block text-xs font-semibold text-foreground">
              Pick time (sec)
              <input
                type="number"
                min={8}
                max={30}
                value={state.settings.pickTimeSec}
                onChange={(event) => isHost && updateSettings({ pickTimeSec: Number(event.target.value) })}
                disabled={!isHost || state.phase !== "lobby"}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>

            <label className="block text-xs font-semibold text-foreground">
              Hints
              <input
                type="number"
                min={0}
                max={4}
                value={state.settings.hintCount}
                onChange={(event) => isHost && updateSettings({ hintCount: Number(event.target.value) })}
                disabled={!isHost || state.phase !== "lobby"}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>

            {isHost && (state.phase === "lobby" || state.phase === "game-over") && (
              <button
                type="button"
                onClick={startGame}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-black text-primary-foreground hover:bg-primary/90"
              >
                <Play className="size-4" />
                {state.phase === "game-over" ? "Play again" : "Start game"}
              </button>
            )}

            {isHost && state.phase !== "lobby" && state.phase !== "game-over" && (
              <button
                type="button"
                onClick={skipTurn}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm font-bold text-foreground hover:border-primary hover:text-primary"
              >
                <SkipForward className="size-4" />
                Skip turn
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/85 p-3 shadow-lg backdrop-blur-md lg:h-[640px]">
          <div className="mb-3 rounded-xl border border-border bg-muted/50 px-3 py-2">
            {phase === "word-select" && isArtist && turn?.wordOptions ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pick a word</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {turn.wordOptions.map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => pickWord(word)}
                      className="rounded-lg border border-input bg-background px-2 py-2 text-sm font-bold text-foreground hover:border-primary hover:text-primary"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-foreground">
                  {turn?.revealedMask || "Waiting for next turn..."}
                </p>
                {isArtist && turn?.revealedWord && phase === "drawing" && (
                  <span className="rounded-lg bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">
                    Your word: {turn.revealedWord}
                  </span>
                )}
              </div>
            )}
          </div>

          <div ref={canvasWrapRef} className="h-[430px] rounded-2xl border-2 border-border bg-white lg:h-[560px]">
            <canvas
              ref={canvasRef}
              className={`h-full w-full touch-none rounded-2xl ${canDraw ? "cursor-crosshair" : "cursor-default"}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointer}
              onPointerCancel={finishPointer}
            />
          </div>
        </section>

        <aside className="rounded-2xl border border-border/70 bg-card/85 p-3 shadow-lg backdrop-blur-md lg:h-[640px] lg:overflow-hidden">
          <div className="rounded-xl border border-border bg-muted/50 p-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Players</p>
            <ul className="mt-2 space-y-1">
              {state.players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <li key={player.id} className="flex items-center justify-between rounded-lg bg-background px-2 py-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${player.connected ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className="font-semibold text-foreground">{player.name}</span>
                      {player.id === state.hostId && <Crown className="size-3.5 text-amber-500" />}
                    </div>
                    <span className="font-black text-foreground">{player.score}</span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="mt-3 flex h-[360px] flex-col rounded-xl border border-border bg-background">
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Chat & Guesses</p>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
              {state.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg px-2 py-1 text-xs ${
                    message.kind === "system"
                      ? "bg-muted text-muted-foreground"
                      : message.kind === "correct"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-background text-foreground/80"
                  }`}
                >
                  {message.kind !== "system" && (
                    <span className="mr-1 font-bold text-foreground">{message.playerName}:</span>
                  )}
                  {message.text}
                </div>
              ))}
            </div>

            <form onSubmit={handleMessageSubmit} className="flex items-center gap-2 border-t border-border p-2">
              <input
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                placeholder={canGuess ? "Type your guess..." : "Send a message"}
                className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs font-semibold text-destructive">
              {error}
            </p>
          )}
        </aside>
      </main>
    </div>
  );
}
