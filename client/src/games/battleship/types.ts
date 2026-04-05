export type Orientation = 'horizontal' | 'vertical'

export type MatchPhase = 'setup' | 'battle' | 'finished'

export type ConnectionStage = 'idle' | 'joining' | 'in-room'

export type ShotMark = 'hit' | 'miss'

export type ShotResolution = 'hit' | 'miss' | 'sunk'

export type SoundCue = 'hit' | 'miss' | 'sunk' | 'win' | 'lose'

export interface Coordinate {
  x: number
  y: number
}

export interface ShipTemplate {
  key: string
  label: string
  size: number
}

export interface ShipPlacement extends ShipTemplate {
  orientation: Orientation
  start: Coordinate
  cells: Coordinate[]
  hitCellKeys: string[]
}

export interface PeerProfile {
  peerId: string
  clientId: string
  name: string
  connected: boolean
}

export interface SoundEvent {
  id: number
  cue: SoundCue
  message: string
}

export interface SyncStatePayload {
  clientId: string
  name: string
  ready: boolean
  phase: MatchPhase
  turnClientId: string | null
  winnerClientId: string | null
  outgoingShots: Record<string, ShotMark>
  incomingShots: Record<string, ShotMark>
  timestamp: number
}

export type BattleshipMessage =
  | {
      type: 'hello'
      payload: {
        clientId: string
        name: string
        ready: boolean
        phase: MatchPhase
      }
    }
  | {
      type: 'ready'
      payload: {
        clientId: string
        ready: boolean
      }
    }
  | {
      type: 'battle-start'
      payload: {
        turnClientId: string
      }
    }
  | {
      type: 'attack'
      payload: {
        attackId: string
        fromClientId: string
        x: number
        y: number
      }
    }
  | {
      type: 'attack-result'
      payload: {
        attackId: string
        x: number
        y: number
        result: ShotResolution
        winnerClientId: string | null
        nextTurnClientId: string | null
        sunkShipKey?: string
      }
    }
  | {
      type: 'sync-request'
      payload: {
        clientId: string
      }
    }
  | {
      type: 'sync-state'
      payload: SyncStatePayload
    }
  | {
      type: 'restart'
      payload: {
        clientId: string
      }
    }

export interface PersistedMatchState {
  roomId: string
  playerName: string
  localFleet: ShipPlacement[]
  localReady: boolean
  remoteReady: boolean
  phase: MatchPhase
  turnClientId: string | null
  winnerClientId: string | null
  outgoingShots: Record<string, ShotMark>
  incomingShots: Record<string, ShotMark>
  savedAt: number
}
