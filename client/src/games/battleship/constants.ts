import type { ShipTemplate } from './types'

export const BATTLESHIP_APP_ID = 'loaf-battleship-v1'

export const BATTLESHIP_ACTION = 'battleship-wire'

export const BOARD_SIZE = 10

export const ROOM_CODE_LENGTH = 6

export const CLIENT_ID_STORAGE_KEY = 'loaf:battleship:client-id'

export const PROFILE_STORAGE_KEY = 'loaf:battleship:last-profile'

export const MATCH_STATE_STORAGE_PREFIX = 'loaf:battleship:match'

export const SHIP_TEMPLATES: ShipTemplate[] = [
  { key: 'carrier', label: 'Carrier', size: 5 },
  { key: 'battleship', label: 'Battleship', size: 4 },
  { key: 'cruiser', label: 'Cruiser', size: 3 },
  { key: 'submarine', label: 'Submarine', size: 3 },
  { key: 'destroyer', label: 'Destroyer', size: 2 },
]

export const ROW_LABELS = Array.from(
  { length: BOARD_SIZE },
  (_, index) => String.fromCharCode(65 + index)
)
