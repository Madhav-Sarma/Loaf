import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { joinRoom } from 'trystero'

import {
  BATTLESHIP_ACTION,
  BATTLESHIP_APP_ID,
  CLIENT_ID_STORAGE_KEY,
  MATCH_STATE_STORAGE_PREFIX,
  PROFILE_STORAGE_KEY,
  ROOM_CODE_LENGTH,
  ROW_LABELS,
  SHIP_TEMPLATES,
} from '../constants'
import type {
  BattleshipMessage,
  ConnectionStage,
  Coordinate,
  MatchPhase,
  Orientation,
  PeerProfile,
  PersistedMatchState,
  ShipPlacement,
  ShotMark,
  SoundCue,
  SoundEvent,
  SyncStatePayload,
} from '../types'
import {
  getHostClientId,
  isFleetComplete,
  resolveIncomingAttack,
  toCellKey,
  upsertShipPlacement,
} from '../utils/board'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

interface TrysteroRoom {
  makeAction: (
    actionName: string
  ) => [
    (message: BattleshipMessage, peerId?: string | string[]) => void,
    (handler: (message: BattleshipMessage, peerId: string) => void) => void,
  ]
  onPeerJoin: (handler: (peerId: string) => void) => void
  onPeerLeave: (handler: (peerId: string) => void) => void
  leave: () => void
}

export interface UseBattleshipRoomResult {
  clientId: string
  connectionStage: ConnectionStage
  roomId: string
  playerName: string
  peer: PeerProfile | null
  phase: MatchPhase
  turnClientId: string | null
  winnerClientId: string | null
  localFleet: ShipPlacement[]
  localReady: boolean
  remoteReady: boolean
  outgoingShots: Record<string, ShotMark>
  incomingShots: Record<string, ShotMark>
  pendingShotKey: string | null
  isHost: boolean
  isPeerConnected: boolean
  isFleetReady: boolean
  error: string | null
  activity: string[]
  soundEvent: SoundEvent | null
  clearError: () => void
  joinRoom: (nextRoomId: string, nextPlayerName: string) => void
  leaveRoom: () => void
  placeShip: (
    shipKey: string,
    coordinate: Coordinate,
    orientation: Orientation
  ) => boolean
  removeShip: (shipKey: string) => void
  clearFleet: () => void
  setReady: (ready: boolean) => boolean
  fireShot: (coordinate: Coordinate) => boolean
  restartMatch: () => void
  copyInviteLink: () => Promise<boolean>
}

function createIdSeed(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`
}

function normalizeRoomCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH)
}

function normalizePlayerName(value: string): string {
  return value.trim().slice(0, 24)
}

function getMatchStateStorageKey(roomId: string, clientId: string): string {
  return `${MATCH_STATE_STORAGE_PREFIX}:${roomId}:${clientId}`
}

function buildCoordinateLabel({ x, y }: Coordinate): string {
  return `${ROW_LABELS[y]}${x + 1}`
}

function getPhasePriority(phase: MatchPhase): number {
  if (phase === 'setup') {
    return 0
  }

  if (phase === 'battle') {
    return 1
  }

  return 2
}

function useStableClientId(): string {
  const [clientId] = useState(() => {
    try {
      const saved = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)
      if (saved) {
        return saved
      }

      const next = createIdSeed()
      window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, next)
      return next
    } catch {
      return createIdSeed()
    }
  })

  return clientId
}

function useStoredPlayerName(): string {
  const [playerName] = useState(() => {
    try {
      const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY)
      if (saved) {
        return saved
      }
    } catch {
      // Ignore storage errors and fallback.
    }

    const seed = Math.floor(Math.random() * 900 + 100)
    return `Captain${seed}`
  })

  return playerName
}

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  let result = ''

  for (let index = 0; index < length; index += 1) {
    const nextIndex = Math.floor(Math.random() * ROOM_ALPHABET.length)
    result += ROOM_ALPHABET[nextIndex]
  }

  return result
}

export function useBattleshipRoom(): UseBattleshipRoomResult {
  const clientId = useStableClientId()
  const storedPlayerName = useStoredPlayerName()

  const [connectionStage, setConnectionStage] = useState<ConnectionStage>('idle')
  const [roomId, setRoomId] = useState('')
  const [playerName, setPlayerName] = useState(storedPlayerName)
  const [peer, setPeer] = useState<PeerProfile | null>(null)

  const [phase, setPhase] = useState<MatchPhase>('setup')
  const [turnClientId, setTurnClientId] = useState<string | null>(null)
  const [winnerClientId, setWinnerClientId] = useState<string | null>(null)

  const [localFleet, setLocalFleet] = useState<ShipPlacement[]>([])
  const [localReady, setLocalReady] = useState(false)
  const [remoteReady, setRemoteReady] = useState(false)

  const [outgoingShots, setOutgoingShots] = useState<Record<string, ShotMark>>({})
  const [incomingShots, setIncomingShots] = useState<Record<string, ShotMark>>({})
  const [pendingShotKey, setPendingShotKey] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [activity, setActivity] = useState<string[]>([])
  const [soundEvent, setSoundEvent] = useState<SoundEvent | null>(null)

  const roomRef = useRef<TrysteroRoom | null>(null)
  const sendMessageRef = useRef<
    ((message: BattleshipMessage, peerId?: string | string[]) => void) | null
  >(null)
  const soundEventCounterRef = useRef(0)

  const stateRef = useRef({
    clientId,
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
  })

  useEffect(() => {
    stateRef.current = {
      clientId,
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
    }
  }, [
    clientId,
    incomingShots,
    localFleet,
    localReady,
    outgoingShots,
    peer,
    pendingShotKey,
    phase,
    playerName,
    remoteReady,
    turnClientId,
    winnerClientId,
  ])

  const appendActivity = useCallback((message: string) => {
    setActivity((previous) => [message, ...previous].slice(0, 10))
  }, [])

  const emitSound = useCallback((cue: SoundCue, message: string) => {
    soundEventCounterRef.current += 1
    setSoundEvent({ id: soundEventCounterRef.current, cue, message })
  }, [])

  const sendMessage = useCallback(
    (message: BattleshipMessage, peerId?: string | string[]) => {
      sendMessageRef.current?.(message, peerId)
    },
    []
  )

  const resetRoundState = useCallback((clearFleet = true) => {
    setPhase('setup')
    setTurnClientId(null)
    setWinnerClientId(null)
    setOutgoingShots({})
    setIncomingShots({})
    setPendingShotKey(null)
    setLocalReady(false)
    setRemoteReady(false)

    if (clearFleet) {
      setLocalFleet([])
    }
  }, [])

  const hydrateMatchState = useCallback(
    (nextRoomId: string, nextPlayerName: string) => {
      const storageKey = getMatchStateStorageKey(nextRoomId, clientId)

      try {
        const raw = window.localStorage.getItem(storageKey)

        if (!raw) {
          resetRoundState(true)
          return
        }

        const parsed = JSON.parse(raw) as PersistedMatchState
        if (!parsed || parsed.roomId !== nextRoomId) {
          resetRoundState(true)
          return
        }

        const restoredFleet = Array.isArray(parsed.localFleet)
          ? parsed.localFleet
          : []

        setLocalFleet(restoredFleet)
        setLocalReady(
          Boolean(parsed.localReady) &&
            isFleetComplete(restoredFleet, SHIP_TEMPLATES)
        )
        setRemoteReady(Boolean(parsed.remoteReady))
        setPhase(parsed.phase ?? 'setup')
        setTurnClientId(parsed.turnClientId ?? null)
        setWinnerClientId(parsed.winnerClientId ?? null)
        setOutgoingShots(parsed.outgoingShots ?? {})
        setIncomingShots(parsed.incomingShots ?? {})
        setPendingShotKey(null)

        appendActivity(`Restored saved match state for ${nextRoomId}.`)
      } catch {
        resetRoundState(true)
      }

      try {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, nextPlayerName)
      } catch {
        // Ignore storage errors.
      }
    },
    [appendActivity, clientId, resetRoundState]
  )

  useEffect(() => {
    if (!roomId) {
      return
    }

    const payload: PersistedMatchState = {
      roomId,
      playerName,
      localFleet,
      localReady,
      remoteReady,
      phase,
      turnClientId,
      winnerClientId,
      outgoingShots,
      incomingShots,
      savedAt: Date.now(),
    }

    try {
      window.localStorage.setItem(
        getMatchStateStorageKey(roomId, clientId),
        JSON.stringify(payload)
      )
    } catch {
      // Ignore storage errors.
    }
  }, [
    clientId,
    incomingShots,
    localFleet,
    localReady,
    outgoingShots,
    phase,
    playerName,
    remoteReady,
    roomId,
    turnClientId,
    winnerClientId,
  ])

  const emitHello = useCallback(
    (peerId?: string | string[]) => {
      const snapshot = stateRef.current

      sendMessage(
        {
          type: 'hello',
          payload: {
            clientId: snapshot.clientId,
            name: snapshot.playerName,
            ready: snapshot.localReady,
            phase: snapshot.phase,
          },
        },
        peerId
      )
    },
    [sendMessage]
  )

  const emitSyncState = useCallback(
    (peerId?: string | string[]) => {
      const snapshot = stateRef.current

      sendMessage(
        {
          type: 'sync-state',
          payload: {
            clientId: snapshot.clientId,
            name: snapshot.playerName,
            ready: snapshot.localReady,
            phase: snapshot.phase,
            turnClientId: snapshot.turnClientId,
            winnerClientId: snapshot.winnerClientId,
            outgoingShots: snapshot.outgoingShots,
            incomingShots: snapshot.incomingShots,
            timestamp: Date.now(),
          },
        },
        peerId
      )
    },
    [sendMessage]
  )

  const handleSyncState = useCallback(
    (payload: SyncStatePayload, peerId: string) => {
      const snapshot = stateRef.current
      if (payload.clientId === snapshot.clientId) {
        return
      }

      setPeer({
        peerId,
        clientId: payload.clientId,
        name: payload.name,
        connected: true,
      })
      setRemoteReady(payload.ready)

      setOutgoingShots((previous) => ({
        ...payload.incomingShots,
        ...previous,
      }))
      setIncomingShots((previous) => ({
        ...payload.outgoingShots,
        ...previous,
      }))

      if (getPhasePriority(payload.phase) > getPhasePriority(snapshot.phase)) {
        setPhase(payload.phase)
      }

      if (payload.winnerClientId) {
        setWinnerClientId(payload.winnerClientId)
        setTurnClientId(null)
        setPhase('finished')
      } else if (payload.turnClientId) {
        setTurnClientId(payload.turnClientId)
      }

      appendActivity('State synchronized with opponent.')
    },
    [appendActivity]
  )

  const handleIncomingMessage = useCallback(
    (message: BattleshipMessage, peerId: string) => {
      const snapshot = stateRef.current

      if (message.type === 'hello') {
        if (message.payload.clientId === snapshot.clientId) {
          return
        }

        setPeer({
          peerId,
          clientId: message.payload.clientId,
          name: message.payload.name,
          connected: true,
        })
        setRemoteReady(message.payload.ready)

        appendActivity(`${message.payload.name} is connected.`)
        return
      }

      if (message.type === 'ready') {
        if (message.payload.clientId === snapshot.clientId) {
          return
        }

        setRemoteReady(message.payload.ready)
        appendActivity(
          message.payload.ready
            ? 'Opponent locked their fleet.'
            : 'Opponent is adjusting ship placement.'
        )
        return
      }

      if (message.type === 'battle-start') {
        setPhase('battle')
        setWinnerClientId(null)
        setTurnClientId(message.payload.turnClientId)
        setPendingShotKey(null)

        appendActivity(
          message.payload.turnClientId === snapshot.clientId
            ? 'Battle started. Your turn to fire.'
            : 'Battle started. Opponent fires first.'
        )
        return
      }

      if (message.type === 'attack') {
        if (message.payload.fromClientId === snapshot.clientId) {
          return
        }

        if (snapshot.phase !== 'battle') {
          return
        }

        const coordinate = { x: message.payload.x, y: message.payload.y }
        const shotKey = toCellKey(coordinate)
        const attackOutcome = resolveIncomingAttack(snapshot.localFleet, coordinate)

        setLocalFleet(attackOutcome.updatedFleet)
        setIncomingShots((previous) => ({
          ...previous,
          [shotKey]: attackOutcome.result === 'miss' ? 'miss' : 'hit',
        }))

        const winnerId = attackOutcome.allShipsSunk
          ? message.payload.fromClientId
          : null
        const nextTurnId = winnerId
          ? null
          : attackOutcome.result === 'miss'
            ? snapshot.clientId
            : message.payload.fromClientId

        if (winnerId) {
          setPhase('finished')
          setWinnerClientId(winnerId)
          setTurnClientId(null)
          emitSound('lose', 'All your ships are sunk.')
          appendActivity('All your ships are sunk. You lost this round.')
        } else {
          setTurnClientId(nextTurnId)

          if (attackOutcome.result === 'sunk') {
            emitSound('sunk', 'One of your ships has been sunk.')
          } else if (attackOutcome.result === 'hit') {
            emitSound('hit', 'Your ship was hit.')
          } else {
            emitSound('miss', 'Opponent missed.')
          }

          appendActivity(
            `Opponent fired at ${buildCoordinateLabel(coordinate)}: ${attackOutcome.result}.`
          )
        }

        sendMessage(
          {
            type: 'attack-result',
            payload: {
              attackId: message.payload.attackId,
              x: message.payload.x,
              y: message.payload.y,
              result: attackOutcome.result,
              winnerClientId: winnerId,
              nextTurnClientId: nextTurnId,
              sunkShipKey: attackOutcome.sunkShipKey,
            },
          },
          peerId
        )

        return
      }

      if (message.type === 'attack-result') {
        // Only the player who fired this attack should process the result.
        // This avoids accidental turn corruption from echoed or stale messages.
        if (!message.payload.attackId.startsWith(`${snapshot.clientId}-`)) {
          return
        }

        const coordinate = { x: message.payload.x, y: message.payload.y }
        const shotKey = toCellKey(coordinate)

        setOutgoingShots((previous) => ({
          ...previous,
          [shotKey]: message.payload.result === 'miss' ? 'miss' : 'hit',
        }))
        setPendingShotKey(null)

        if (message.payload.winnerClientId) {
          setWinnerClientId(message.payload.winnerClientId)
          setTurnClientId(null)
          setPhase('finished')

          if (message.payload.winnerClientId === snapshot.clientId) {
            emitSound('win', 'You win this round!')
            appendActivity('Victory! You sunk all enemy ships.')
          } else {
            emitSound('lose', 'You lost this round.')
            appendActivity('Defeat. Opponent sank your fleet.')
          }
          return
        }

        const nextTurnClientId =
          message.payload.result === 'miss'
            ? snapshot.peer?.clientId ?? message.payload.nextTurnClientId
            : snapshot.clientId

        setTurnClientId(nextTurnClientId)

        if (message.payload.result === 'sunk') {
          emitSound('sunk', 'Enemy ship sunk.')
        } else if (message.payload.result === 'hit') {
          emitSound('hit', 'Direct hit!')
        } else {
          emitSound('miss', 'Shot missed.')
        }

        appendActivity(
          `Shot at ${buildCoordinateLabel(coordinate)} resulted in ${message.payload.result}.`
        )
        return
      }

      if (message.type === 'sync-request') {
        emitSyncState(peerId)
        return
      }

      if (message.type === 'sync-state') {
        handleSyncState(message.payload, peerId)
        return
      }

      if (message.type === 'restart') {
        resetRoundState(true)
        appendActivity('Opponent started a new round. Place ships again.')
      }
    },
    [appendActivity, emitSound, emitSyncState, handleSyncState, resetRoundState, sendMessage]
  )

  const joinRoomAction = useCallback(
    (nextRoomId: string, nextPlayerName: string) => {
      const normalizedRoomCode = normalizeRoomCode(nextRoomId)
      const normalizedPlayerName = normalizePlayerName(nextPlayerName)

      if (!normalizedRoomCode) {
        setError('Enter a valid room code (letters and numbers).')
        return
      }

      if (!normalizedPlayerName) {
        setError('Enter a player name to continue.')
        return
      }

      setError(null)
      setConnectionStage('joining')

      if (roomRef.current) {
        roomRef.current.leave()
      }

      roomRef.current = null
      sendMessageRef.current = null
      setPeer(null)

      setRoomId(normalizedRoomCode)
      setPlayerName(normalizedPlayerName)

      try {
        window.localStorage.setItem(PROFILE_STORAGE_KEY, normalizedPlayerName)
      } catch {
        // Ignore storage errors.
      }

      hydrateMatchState(normalizedRoomCode, normalizedPlayerName)

      const room = joinRoom({ appId: BATTLESHIP_APP_ID }, normalizedRoomCode)
      const typedRoom = room as unknown as TrysteroRoom
      const [sendWireMessage, getWireMessage] = typedRoom.makeAction(
        BATTLESHIP_ACTION
      )

      roomRef.current = typedRoom
      sendMessageRef.current = sendWireMessage

      getWireMessage((message, peerId) => {
        handleIncomingMessage(message, peerId)
      })

      typedRoom.onPeerJoin((peerId) => {
        setConnectionStage('in-room')

        setPeer((previous) => {
          if (!previous) {
            return {
              peerId,
              clientId: '',
              name: 'Opponent',
              connected: true,
            }
          }

          if (previous.peerId === peerId) {
            return { ...previous, connected: true }
          }

          return previous
        })

        setPendingShotKey(null)
        appendActivity('Peer connected. Synchronizing state...')

        emitHello(peerId)
        sendMessage(
          {
            type: 'sync-request',
            payload: { clientId: stateRef.current.clientId },
          },
          peerId
        )
      })

      typedRoom.onPeerLeave((peerId) => {
        setPeer((previous) => {
          if (!previous || previous.peerId !== peerId) {
            return previous
          }

          return {
            ...previous,
            connected: false,
          }
        })

        setPendingShotKey(null)
        appendActivity('Opponent disconnected. Waiting for reconnection...')
      })

      setConnectionStage('in-room')
      appendActivity(
        `Joined room ${normalizedRoomCode}. Share the room code with your opponent.`
      )

      window.setTimeout(() => {
        emitHello()
        sendMessage({
          type: 'sync-request',
          payload: { clientId: stateRef.current.clientId },
        })
      }, 240)
    },
    [appendActivity, emitHello, handleIncomingMessage, hydrateMatchState, sendMessage]
  )

  const leaveRoom = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.leave()
    }

    roomRef.current = null
    sendMessageRef.current = null

    setConnectionStage('idle')
    setRoomId('')
    setPeer(null)
    setError(null)
    setActivity([])
    setSoundEvent(null)
    resetRoundState(true)
  }, [resetRoundState])

  useEffect(() => {
    return () => {
      roomRef.current?.leave()
    }
  }, [])

  useEffect(() => {
    if (
      phase !== 'setup' ||
      !localReady ||
      !remoteReady ||
      !peer ||
      !peer.connected ||
      !peer.clientId
    ) {
      return
    }

    const hostClientId = getHostClientId(clientId, peer.clientId)
    if (hostClientId !== clientId) {
      return
    }

    setPhase('battle')
    setWinnerClientId(null)
    setTurnClientId(hostClientId)
    setPendingShotKey(null)

    sendMessage({
      type: 'battle-start',
      payload: {
        turnClientId: hostClientId,
      },
    })

    appendActivity('Both players are ready. Battle started.')
  }, [
    appendActivity,
    clientId,
    localReady,
    peer,
    phase,
    remoteReady,
    sendMessage,
  ])

  const placeShip = useCallback(
    (shipKey: string, coordinate: Coordinate, orientation: Orientation) => {
      if (stateRef.current.phase !== 'setup') {
        return false
      }

      const targetShip = SHIP_TEMPLATES.find((ship) => ship.key === shipKey)
      if (!targetShip) {
        return false
      }

      let placed = false

      setLocalFleet((previousFleet) => {
        const nextFleet = upsertShipPlacement(
          previousFleet,
          targetShip,
          coordinate,
          orientation
        )

        if (!nextFleet) {
          return previousFleet
        }

        placed = true
        return nextFleet
      })

      if (!placed) {
        setError('Invalid placement. Stay in bounds and avoid overlapping ships.')
        return false
      }

      setError(null)

      if (stateRef.current.localReady) {
        setLocalReady(false)
        sendMessage({
          type: 'ready',
          payload: {
            clientId: stateRef.current.clientId,
            ready: false,
          },
        })
      }

      return true
    },
    [sendMessage]
  )

  const removeShip = useCallback(
    (shipKey: string) => {
      if (stateRef.current.phase !== 'setup') {
        return
      }

      setLocalFleet((previousFleet) =>
        previousFleet.filter((ship) => ship.key !== shipKey)
      )

      if (stateRef.current.localReady) {
        setLocalReady(false)
        sendMessage({
          type: 'ready',
          payload: {
            clientId: stateRef.current.clientId,
            ready: false,
          },
        })
      }
    },
    [sendMessage]
  )

  const clearFleet = useCallback(() => {
    if (stateRef.current.phase !== 'setup') {
      return
    }

    setLocalFleet([])

    if (stateRef.current.localReady) {
      setLocalReady(false)
      sendMessage({
        type: 'ready',
        payload: {
          clientId: stateRef.current.clientId,
          ready: false,
        },
      })
    }
  }, [sendMessage])

  const setReady = useCallback(
    (ready: boolean) => {
      if (stateRef.current.phase !== 'setup') {
        return false
      }

      if (ready && !isFleetComplete(stateRef.current.localFleet, SHIP_TEMPLATES)) {
        setError('Place all ships before marking yourself ready.')
        return false
      }

      setLocalReady(ready)
      setError(null)

      sendMessage({
        type: 'ready',
        payload: {
          clientId: stateRef.current.clientId,
          ready,
        },
      })

      emitHello()

      appendActivity(
        ready
          ? 'Fleet locked. Waiting for opponent readiness.'
          : 'Fleet unlocked for repositioning.'
      )

      return true
    },
    [appendActivity, emitHello, sendMessage]
  )

  const fireShot = useCallback(
    (coordinate: Coordinate) => {
      const snapshot = stateRef.current

      if (snapshot.phase !== 'battle') {
        return false
      }

      if (snapshot.turnClientId !== snapshot.clientId) {
        return false
      }

      if (!snapshot.peer?.connected) {
        setError('Opponent is offline. Waiting for reconnection.')
        return false
      }

      if (snapshot.pendingShotKey) {
        return false
      }

      const shotKey = toCellKey(coordinate)

      if (snapshot.outgoingShots[shotKey]) {
        return false
      }

      const attackId = `${snapshot.clientId}-${Date.now()}-${shotKey}`

      setPendingShotKey(shotKey)
      setError(null)
      appendActivity(`Fired at ${buildCoordinateLabel(coordinate)}.`)

      sendMessage({
        type: 'attack',
        payload: {
          attackId,
          fromClientId: snapshot.clientId,
          x: coordinate.x,
          y: coordinate.y,
        },
      })

      window.setTimeout(() => {
        if (stateRef.current.pendingShotKey === shotKey) {
          setPendingShotKey(null)
          setError('Attack timed out. Try again when the connection stabilizes.')
        }
      }, 7000)

      return true
    },
    [appendActivity, sendMessage]
  )

  const restartMatch = useCallback(() => {
    if (!roomId) {
      return
    }

    resetRoundState(true)

    sendMessage({
      type: 'restart',
      payload: {
        clientId: stateRef.current.clientId,
      },
    })

    appendActivity('New round started. Place your ships again.')
  }, [appendActivity, resetRoundState, roomId, sendMessage])

  const copyInviteLink = useCallback(async () => {
    if (!roomId) {
      return false
    }

    const inviteLink = `${window.location.origin}/games/battleship?room=${roomId}`

    try {
      await navigator.clipboard.writeText(inviteLink)
      appendActivity('Invite link copied to clipboard.')
      return true
    } catch {
      setError('Unable to copy invite link from this browser.')
      return false
    }
  }, [appendActivity, roomId])

  const isHost = useMemo(() => {
    const hostClientId = getHostClientId(clientId, peer?.clientId || null)
    return hostClientId === clientId
  }, [clientId, peer?.clientId])

  const isPeerConnected = Boolean(peer?.connected)
  const isFleetReady = isFleetComplete(localFleet, SHIP_TEMPLATES)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
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
    isHost,
    isPeerConnected,
    isFleetReady,
    error,
    activity,
    soundEvent,
    clearError,
    joinRoom: joinRoomAction,
    leaveRoom,
    placeShip,
    removeShip,
    clearFleet,
    setReady,
    fireShot,
    restartMatch,
    copyInviteLink,
  }
}
