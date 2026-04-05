import { BOARD_SIZE } from '../constants'
import type {
  Coordinate,
  Orientation,
  ShipPlacement,
  ShipTemplate,
  ShotResolution,
} from '../types'

interface AttackOutcome {
  updatedFleet: ShipPlacement[]
  result: ShotResolution
  sunkShipKey?: string
  allShipsSunk: boolean
}

export function toCellKey({ x, y }: Coordinate): string {
  return `${x}:${y}`
}

export function isCoordinateInBounds({ x, y }: Coordinate): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE
}

export function buildShipCells(
  start: Coordinate,
  size: number,
  orientation: Orientation
): Coordinate[] {
  return Array.from({ length: size }, (_, offset) => ({
    x: orientation === 'horizontal' ? start.x + offset : start.x,
    y: orientation === 'vertical' ? start.y + offset : start.y,
  }))
}

export function createShipPlacement(
  template: ShipTemplate,
  start: Coordinate,
  orientation: Orientation
): ShipPlacement | null {
  const cells = buildShipCells(start, template.size, orientation)
  const isInsideBoard = cells.every((cell) => isCoordinateInBounds(cell))

  if (!isInsideBoard) {
    return null
  }

  return {
    ...template,
    start,
    orientation,
    cells,
    hitCellKeys: [],
  }
}

export function canPlaceShip(
  existingShips: ShipPlacement[],
  start: Coordinate,
  size: number,
  orientation: Orientation
): boolean {
  const nextCells = buildShipCells(start, size, orientation)
  const nextCellKeys = new Set(nextCells.map(toCellKey))

  const inBounds = nextCells.every((cell) => isCoordinateInBounds(cell))
  if (!inBounds) {
    return false
  }

  const occupiedCells = getShipCellKeySet(existingShips)

  for (const nextCellKey of nextCellKeys) {
    if (occupiedCells.has(nextCellKey)) {
      return false
    }
  }

  return true
}

export function upsertShipPlacement(
  fleet: ShipPlacement[],
  template: ShipTemplate,
  start: Coordinate,
  orientation: Orientation
): ShipPlacement[] | null {
  const fleetWithoutCurrentShip = fleet.filter((ship) => ship.key !== template.key)

  if (!canPlaceShip(fleetWithoutCurrentShip, start, template.size, orientation)) {
    return null
  }

  const placement = createShipPlacement(template, start, orientation)
  if (!placement) {
    return null
  }

  return [...fleetWithoutCurrentShip, placement]
}

export function getShipCellKeySet(fleet: ShipPlacement[]): Set<string> {
  return new Set(
    fleet.flatMap((ship) => ship.cells.map((cell) => toCellKey(cell)))
  )
}

export function getSunkShipCellKeySet(fleet: ShipPlacement[]): Set<string> {
  return new Set(
    fleet
      .filter((ship) => ship.hitCellKeys.length >= ship.cells.length)
      .flatMap((ship) => ship.cells.map((cell) => toCellKey(cell)))
  )
}

export function isFleetComplete(
  fleet: ShipPlacement[],
  templates: ShipTemplate[]
): boolean {
  return templates.every((template) =>
    fleet.some((placement) => placement.key === template.key)
  )
}

export function findShipAtCell(
  fleet: ShipPlacement[],
  coordinate: Coordinate
): ShipPlacement | undefined {
  const targetCellKey = toCellKey(coordinate)

  return fleet.find((ship) =>
    ship.cells.some((cell) => toCellKey(cell) === targetCellKey)
  )
}

export function resolveIncomingAttack(
  fleet: ShipPlacement[],
  coordinate: Coordinate
): AttackOutcome {
  const targetCellKey = toCellKey(coordinate)
  const hitShip = findShipAtCell(fleet, coordinate)

  if (!hitShip) {
    return {
      updatedFleet: fleet,
      result: 'miss',
      allShipsSunk: false,
    }
  }

  const nextFleet = fleet.map((ship) => {
    if (ship.key !== hitShip.key) {
      return ship
    }

    if (ship.hitCellKeys.includes(targetCellKey)) {
      return ship
    }

    return {
      ...ship,
      hitCellKeys: [...ship.hitCellKeys, targetCellKey],
    }
  })

  const impactedShip = nextFleet.find((ship) => ship.key === hitShip.key)

  if (!impactedShip) {
    return {
      updatedFleet: fleet,
      result: 'miss',
      allShipsSunk: false,
    }
  }

  const sunk = impactedShip.hitCellKeys.length >= impactedShip.cells.length
  const allShipsSunk = nextFleet.every(
    (ship) => ship.hitCellKeys.length >= ship.cells.length
  )

  return {
    updatedFleet: nextFleet,
    result: sunk ? 'sunk' : 'hit',
    sunkShipKey: sunk ? impactedShip.key : undefined,
    allShipsSunk,
  }
}

export function getHostClientId(
  localClientId: string,
  peerClientId: string | null
): string {
  if (!peerClientId) {
    return localClientId
  }

  return [localClientId, peerClientId].sort()[0]
}
