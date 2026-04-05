import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'

import { Tile } from './Tile'
import type { LetterState } from '../types'

interface GameBoardProps {
  rows: string[]
  evaluations: LetterState[][]
  currentGuess: string
  canType: boolean
  wordLength: number
  revealRowIndex: number | null
  invalidRowIndex: number | null
  onLetter: (letter: string) => void
  onDelete: () => void
  onSubmit: () => void
}

export function GameBoard({
  rows,
  evaluations,
  currentGuess,
  canType,
  wordLength,
  revealRowIndex,
  invalidRowIndex,
  onLetter,
  onDelete,
  onSubmit,
}: GameBoardProps) {
  const currentRowIndex = evaluations.length
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const activeInputIndex = useMemo(
    () => Math.min(currentGuess.length, wordLength - 1),
    [currentGuess.length, wordLength],
  )

  const boardStyle = {
    ['--wordle-columns' as string]: String(wordLength),
  } as CSSProperties

  useEffect(() => {
    if (!canType) {
      return
    }

    inputRefs.current[activeInputIndex]?.focus()
  }, [activeInputIndex, canType])

  const handleInputFocus = useCallback(
    (tileIndex: number) => {
      if (!canType || tileIndex === activeInputIndex) {
        return
      }

      inputRefs.current[activeInputIndex]?.focus()
    },
    [activeInputIndex, canType],
  )

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        onSubmit()
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        onDelete()
        return
      }

      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault()
        onLetter(event.key.toLowerCase())
        return
      }

      const navigationKeys = ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
      if (navigationKeys.includes(event.key)) {
        return
      }

      if (event.key.length === 1) {
        event.preventDefault()
      }
    },
    [onDelete, onLetter, onSubmit],
  )

  const handleInputChange = useCallback(
    (rawValue: string) => {
      if (!canType) {
        return
      }

      const normalized = rawValue.toLowerCase().replace(/[^a-z]/g, '')
      if (!normalized) {
        return
      }

      onLetter(normalized[normalized.length - 1])
    },
    [canType, onLetter],
  )

  return (
    <div
      className="wordle-board"
      style={boardStyle}
      role="grid"
      aria-label="Wordle game board"
    >
      {rows.map((row, rowIndex) => {
        const locked = rowIndex < evaluations.length
        const isCurrentEditableRow = canType && rowIndex === currentRowIndex
        const shouldAnimateFlip = revealRowIndex === rowIndex
        const shouldShake = invalidRowIndex === rowIndex
        const letters = Array.from({ length: wordLength }, (_, tileIndex) => row[tileIndex] ?? '')

        return (
          <div key={rowIndex} className="wordle-row" role="row" aria-label={`Row ${rowIndex + 1}`}>
            {letters.map((letter, tileIndex) => {
              const state = locked ? evaluations[rowIndex]?.[tileIndex] ?? 'empty' : 'empty'
              const active = !locked && rowIndex === currentRowIndex && tileIndex === activeInputIndex
              const isActiveInputCell = isCurrentEditableRow && tileIndex === activeInputIndex

              return (
                <Tile
                  key={`${rowIndex}-${tileIndex}`}
                  letter={letter}
                  state={state}
                  locked={locked}
                  active={active}
                  animateFlip={shouldAnimateFlip}
                  shake={shouldShake}
                  tileIndex={tileIndex}
                  editable={isCurrentEditableRow}
                  readOnly={!isActiveInputCell}
                  inputRef={
                    isCurrentEditableRow
                      ? (node) => {
                          inputRefs.current[tileIndex] = node
                        }
                      : undefined
                  }
                  onInputFocus={() => handleInputFocus(tileIndex)}
                  onInputKeyDown={handleInputKeyDown}
                  onInputChange={handleInputChange}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
