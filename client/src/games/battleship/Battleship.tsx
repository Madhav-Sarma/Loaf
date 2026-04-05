import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react'
import { ArrowLeft, RotateCcw, RotateCw, Send, Target } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { BOARD_SIZE, ROW_LABELS, SHIP_TEMPLATES } from './constants'
import { useBattleSounds } from './hooks/useBattleSounds'
import {
  generateRoomCode,
  useBattleshipRoom,
} from './hooks/useBattleshipRoom'
import type { Coordinate, Orientation } from './types'
import { getShipCellKeySet, getSunkShipCellKeySet, toCellKey } from './utils/board'
import './battleship.css'

const DRAG_DATA_KEY = 'application/x-loaf-battleship-ship'

interface GridViewProps {
  title: string
  showShips?: boolean
  shipCells?: Set<string>
  hitCells: Set<string>
  missCells: Set<string>
  sunkCells?: Set<string>
  pendingCellKey?: string | null
  interactive?: boolean
  disabled?: boolean
  onCellClick?: (coordinate: Coordinate) => void
  onCellDrop?: (coordinate: Coordinate, event: DragEvent<HTMLButtonElement>) => void
}

function normalizeRoomInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}

export function Battleship() {
  const [searchParams] = useSearchParams()
  const {
    clientId,
    connectionStage,
    roomId,
    playerName,
    peer,
    phase,
    turnClientId,
    winnerClientId,
    localFleet,
    localReady,
    remoteReady,
    outgoingShots,
    incomingShots,
    pendingShotKey,
    isFleetReady,
    error,
    soundEvent,
    clearError,
    joinRoom,
    leaveRoom,
    placeShip,
    clearFleet,
    setReady,
    fireShot,
    restartMatch,
  } = useBattleshipRoom()

  const { playCue } = useBattleSounds()
  const playedSoundEventIdRef = useRef(0)

  const [roomInput, setRoomInput] = useState(() => {
    const normalized = normalizeRoomInput(searchParams.get('room') ?? '')
    return normalized || generateRoomCode()
  })
  const [nameInput, setNameInput] = useState(playerName)
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [selectedShipKey, setSelectedShipKey] = useState<string | null>(
    SHIP_TEMPLATES[0].key
  )
  const [placementHint, setPlacementHint] = useState<string | null>(null)

  useEffect(() => {
    setNameInput(playerName)
  }, [playerName])

  useEffect(() => {
    if (!soundEvent) {
      return
    }

    if (playedSoundEventIdRef.current === soundEvent.id) {
      return
    }

    playedSoundEventIdRef.current = soundEvent.id
    void playCue(soundEvent.cue)
  }, [playCue, soundEvent])

  useEffect(() => {
    if (!placementHint) {
      return
    }

    const timer = window.setTimeout(() => {
      setPlacementHint(null)
    }, 1800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [placementHint])

  const placedShipKeys = useMemo(
    () => new Set(localFleet.map((ship) => ship.key)),
    [localFleet]
  )

  const shipCellSet = useMemo(() => getShipCellKeySet(localFleet), [localFleet])
  const sunkCellSet = useMemo(() => getSunkShipCellKeySet(localFleet), [localFleet])

  const incomingHitSet = useMemo(
    () =>
      new Set(
        Object.entries(incomingShots)
          .filter(([, value]) => value === 'hit')
          .map(([cellKey]) => cellKey)
      ),
    [incomingShots]
  )

  const incomingMissSet = useMemo(
    () =>
      new Set(
        Object.entries(incomingShots)
          .filter(([, value]) => value === 'miss')
          .map(([cellKey]) => cellKey)
      ),
    [incomingShots]
  )

  const outgoingHitSet = useMemo(
    () =>
      new Set(
        Object.entries(outgoingShots)
          .filter(([, value]) => value === 'hit')
          .map(([cellKey]) => cellKey)
      ),
    [outgoingShots]
  )

  const outgoingMissSet = useMemo(
    () =>
      new Set(
        Object.entries(outgoingShots)
          .filter(([, value]) => value === 'miss')
          .map(([cellKey]) => cellKey)
      ),
    [outgoingShots]
  )

  const shipByCell = useMemo(() => {
    const mapping = new Map<string, string>()

    for (const ship of localFleet) {
      for (const cell of ship.cells) {
        mapping.set(toCellKey(cell), ship.key)
      }
    }

    return mapping
  }, [localFleet])

  const peerConnected = Boolean(peer?.connected)
  const myTurn = phase === 'battle' && turnClientId === clientId

  const statusText = useMemo(() => {
    if (connectionStage !== 'in-room') {
      return 'Join a room to start.'
    }

    if (!peer) {
      return 'Waiting for opponent to join this room.'
    }

    if (!peer.connected) {
      return 'Opponent disconnected. Waiting for reconnection.'
    }

    if (phase === 'setup') {
      if (!isFleetReady) {
        return 'Place all ship sizes on your board.'
      }

      if (!localReady) {
        return 'Lock fleet when placement is done.'
      }

      if (!remoteReady) {
        return 'Waiting for opponent to lock fleet.'
      }

      return 'Both fleets locked. Starting battle...'
    }

    if (phase === 'battle') {
      return myTurn ? 'Your turn to fire.' : 'Opponent turn.'
    }

    if (winnerClientId === clientId) {
      return 'You won the round.'
    }

    return 'You lost the round.'
  }, [
    clientId,
    connectionStage,
    isFleetReady,
    localReady,
    myTurn,
    peer,
    phase,
    remoteReady,
    winnerClientId,
  ])

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    joinRoom(roomInput, nameInput)
  }

  const handlePlacement = (shipKey: string, coordinate: Coordinate) => {
    const placed = placeShip(shipKey, coordinate, orientation)

    if (!placed) {
      setPlacementHint('Invalid placement.')
      return
    }

    setPlacementHint(null)
    setSelectedShipKey(shipKey)
  }

  const handleCellDrop = (
    coordinate: Coordinate,
    event: DragEvent<HTMLButtonElement>
  ) => {
    const shipKeyFromDrag = event.dataTransfer.getData(DRAG_DATA_KEY)
    const shipKey = shipKeyFromDrag || selectedShipKey

    if (!shipKey) {
      return
    }

    handlePlacement(shipKey, coordinate)
  }

  const renderGrid = ({
    title,
    showShips = false,
    shipCells,
    hitCells,
    missCells,
    sunkCells,
    pendingCellKey,
    interactive = false,
    disabled = false,
    onCellClick,
    onCellDrop,
  }: GridViewProps) => {
    return (
      <section className="rounded-3xl border border-orange-300/30 bg-white/75 p-2.5 shadow-lg backdrop-blur-md dark:border-sky-300/20 dark:bg-slate-900/50 sm:p-3">
        <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
          {title}
        </h3>

        <div className="mx-auto grid w-fit grid-cols-[auto_repeat(10,1.2rem)] gap-[2px] sm:grid-cols-[auto_repeat(10,1.45rem)] sm:gap-1 lg:grid-cols-[auto_repeat(10,1.6rem)]">
          <div />
          {Array.from({ length: BOARD_SIZE }, (_, x) => (
            <div
              key={`x-${title}-${x}`}
              className="text-center text-[9px] font-bold text-slate-500 dark:text-slate-400 sm:text-[10px]"
            >
              {x + 1}
            </div>
          ))}

          {Array.from({ length: BOARD_SIZE }, (_, y) => (
            <Fragment key={`row-${title}-${y}`}>
              <div className="flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400 sm:text-[10px]">
                {ROW_LABELS[y]}
              </div>

              {Array.from({ length: BOARD_SIZE }, (_, x) => {
                const coordinate = { x, y }
                const cellKey = toCellKey(coordinate)
                const hasShip = Boolean(shipCells?.has(cellKey))
                const isHit = hitCells.has(cellKey)
                const isMiss = missCells.has(cellKey)
                const isSunk = Boolean(sunkCells?.has(cellKey) && isHit)
                const isPending = pendingCellKey === cellKey

                return (
                  <button
                    key={`${title}-${cellKey}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => onCellClick?.(coordinate)}
                    onDragOver={(event) => {
                      if (!onCellDrop) {
                        return
                      }

                      event.preventDefault()
                    }}
                    onDrop={(event) => {
                      if (!onCellDrop) {
                        return
                      }

                      event.preventDefault()
                      onCellDrop(coordinate, event)
                    }}
                    className={cn(
                      'relative flex aspect-square w-full items-center justify-center rounded-[5px] border text-[9px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 sm:rounded-md sm:text-[10px]',
                      hasShip && showShips &&
                        'border-emerald-400/60 bg-emerald-500/25 text-emerald-900 dark:text-emerald-100',
                      !hasShip && !isHit && !isMiss &&
                        'border-slate-300/70 bg-white/70 text-slate-500 dark:border-slate-600 dark:bg-slate-800/65 dark:text-slate-400',
                      interactive && !disabled &&
                        'cursor-crosshair hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-200/30 dark:hover:bg-cyan-500/20',
                      disabled && 'cursor-not-allowed opacity-70',
                      isHit && 'bship-hit-cell border-rose-500/70 bg-rose-500/25 text-rose-700',
                      isMiss &&
                        'bship-miss-cell border-sky-400/60 bg-sky-300/25 text-sky-700 dark:text-sky-200',
                      isSunk && 'bship-sunk-cell border-rose-600/90 bg-rose-600/35 text-white',
                      isPending && 'bship-pending-cell border-amber-400 bg-amber-200/35'
                    )}
                    aria-label={`${ROW_LABELS[y]}${x + 1}`}
                  >
                    {isHit ? 'X' : null}
                    {isMiss ? '•' : null}
                    {!isHit && !isMiss && hasShip && showShips ? '■' : null}
                    {isPending ? (
                      <span className="absolute inset-0 animate-pulse rounded-md border border-amber-500/90" />
                    ) : null}
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="phase-bg min-h-screen pb-12">
      <header className="mx-auto max-w-5xl px-4 pt-6 sm:pt-8">
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-900/10 bg-white/70 p-3 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/55">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:-translate-y-0.5 hover:border-orange-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>

          <h1 className="inline-flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
            <Target className="size-5 text-orange-500" />
            Battleship
          </h1>
        </div>
      </header>

      <main className="mx-auto mt-5 w-full max-w-5xl space-y-4 px-4">
        {connectionStage !== 'in-room' ? (
          <Card className="rounded-3xl border border-orange-300/35 bg-white/85 shadow-xl dark:border-sky-300/20 dark:bg-slate-900/55">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-900 dark:text-slate-100">
                Join Room
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleJoin}>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Input
                    value={roomInput}
                    onChange={(event) => {
                      if (error) {
                        clearError()
                      }

                      setRoomInput(normalizeRoomInput(event.target.value))
                    }}
                    placeholder="ROOM"
                    className="h-11 font-black tracking-[0.16em] uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-11"
                    onClick={() => setRoomInput(generateRoomCode())}
                  >
                    Random
                  </Button>
                </div>

                <Input
                  value={nameInput}
                  onChange={(event) => {
                    if (error) {
                      clearError()
                    }

                    setNameInput(event.target.value)
                  }}
                  placeholder="Player name"
                  className="h-11"
                />

                {error ? (
                  <p className="rounded-xl border border-rose-300/60 bg-rose-100/80 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-rose-900/30 dark:text-rose-200">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-2xl text-sm font-black uppercase tracking-wide"
                >
                  <Send className="size-4" />
                  Enter
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="rounded-3xl border border-orange-300/35 bg-white/85 shadow-xl dark:border-sky-300/20 dark:bg-slate-900/55">
              <CardContent className="space-y-2 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-700 dark:text-slate-100">
                    Room {roomId}
                  </p>
                  <Button type="button" variant="outline" size="lg" onClick={leaveRoom}>
                    Leave
                  </Button>
                </div>

                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {statusText}
                </p>
              </CardContent>
            </Card>

            {phase === 'setup' ? (
              <>
                <Card className="rounded-3xl border border-orange-300/35 bg-white/85 shadow-xl dark:border-sky-300/20 dark:bg-slate-900/55">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={localReady}
                        onClick={() =>
                          setOrientation((previous) =>
                            previous === 'horizontal' ? 'vertical' : 'horizontal'
                          )
                        }
                      >
                        {orientation === 'horizontal' ? (
                          <RotateCw className="size-4" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        Rotate ({orientation})
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={localReady}
                        onClick={() => {
                          clearFleet()
                          setSelectedShipKey(SHIP_TEMPLATES[0].key)
                        }}
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-5">
                      {SHIP_TEMPLATES.map((ship) => {
                        const isSelected = selectedShipKey === ship.key
                        const isPlaced = placedShipKeys.has(ship.key)

                        return (
                          <button
                            key={ship.key}
                            type="button"
                            draggable={!localReady}
                            disabled={localReady}
                            onClick={() => setSelectedShipKey(ship.key)}
                            onDragStart={(event) => {
                              event.dataTransfer.setData(DRAG_DATA_KEY, ship.key)
                              event.dataTransfer.effectAllowed = 'move'
                              setSelectedShipKey(ship.key)
                            }}
                            className={cn(
                              'rounded-2xl border p-2 text-center transition-all',
                              isSelected
                                ? 'border-cyan-400 bg-cyan-100/65 dark:bg-cyan-500/20'
                                : 'border-slate-300/60 bg-white/75 dark:border-slate-600 dark:bg-slate-900/65',
                              isPlaced &&
                                'border-emerald-400/60 bg-emerald-100/65 dark:bg-emerald-500/20',
                              localReady && 'opacity-50'
                            )}
                          >
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                              {ship.size}
                            </p>
                            <div className="mx-auto mt-1 flex max-w-20 gap-0.5">
                              {Array.from({ length: ship.size }, (_, index) => (
                                <span
                                  key={`${ship.key}-segment-${index}`}
                                  className="h-1.5 flex-1 rounded bg-gradient-to-r from-cyan-500 to-emerald-500"
                                />
                              ))}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {placementHint ? (
                      <p className="rounded-xl border border-amber-300/60 bg-amber-100/80 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-100">
                        {placementHint}
                      </p>
                    ) : null}

                    {error ? (
                      <p className="rounded-xl border border-rose-300/60 bg-rose-100/80 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-rose-900/30 dark:text-rose-200">
                        {error}
                      </p>
                    ) : null}

                    <Button
                      type="button"
                      size="lg"
                      disabled={!isFleetReady && !localReady}
                      onClick={() => setReady(!localReady)}
                      className="h-12 w-full rounded-2xl text-sm font-black uppercase tracking-wide"
                    >
                      {localReady ? 'Unlock Fleet' : 'Lock Fleet'}
                    </Button>
                  </CardContent>
                </Card>

                {renderGrid({
                  title: 'Your Board',
                  showShips: true,
                  shipCells: shipCellSet,
                  hitCells: incomingHitSet,
                  missCells: incomingMissSet,
                  sunkCells: sunkCellSet,
                  disabled: localReady,
                  onCellClick: (coordinate) => {
                    const shipAtCell = shipByCell.get(toCellKey(coordinate))
                    const shipToPlace = selectedShipKey ?? shipAtCell

                    if (!shipToPlace) {
                      return
                    }

                    handlePlacement(shipToPlace, coordinate)
                  },
                  onCellDrop: handleCellDrop,
                })}
              </>
            ) : null}

            {phase !== 'setup' ? (
              <>
                {error ? (
                  <p className="rounded-xl border border-rose-300/60 bg-rose-100/80 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/40 dark:bg-rose-900/30 dark:text-rose-200">
                    {error}
                  </p>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  {renderGrid({
                    title: 'Enemy Board',
                    hitCells: outgoingHitSet,
                    missCells: outgoingMissSet,
                    pendingCellKey: pendingShotKey,
                    interactive: myTurn,
                    disabled: !myTurn || Boolean(pendingShotKey) || !peerConnected,
                    onCellClick: (coordinate) => {
                      void fireShot(coordinate)
                    },
                  })}

                  {renderGrid({
                    title: 'Your Board',
                    showShips: true,
                    shipCells: shipCellSet,
                    hitCells: incomingHitSet,
                    missCells: incomingMissSet,
                    sunkCells: sunkCellSet,
                    disabled: true,
                  })}
                </div>
              </>
            ) : null}

            {phase === 'finished' ? (
              <Button
                type="button"
                size="lg"
                onClick={restartMatch}
                className="h-12 w-full rounded-2xl text-sm font-black uppercase tracking-wide"
              >
                New Round
              </Button>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}
