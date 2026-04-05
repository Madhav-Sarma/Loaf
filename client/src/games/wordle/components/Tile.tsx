import type { CSSProperties, KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import type { LetterState } from '../types'

interface TileProps {
  letter: string
  state: LetterState
  locked: boolean
  active: boolean
  animateFlip: boolean
  shake: boolean
  tileIndex: number
  editable?: boolean
  readOnly?: boolean
  inputRef?: (node: HTMLInputElement | null) => void
  onInputFocus?: () => void
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  onInputChange?: (value: string) => void
}

const stateLabel: Record<LetterState, string> = {
  empty: 'empty',
  correct: 'correct',
  present: 'present',
  absent: 'absent',
}

export function Tile({
  letter,
  state,
  locked,
  active,
  animateFlip,
  shake,
  tileIndex,
  editable = false,
  readOnly = false,
  inputRef,
  onInputFocus,
  onInputKeyDown,
  onInputChange,
}: TileProps) {
  const resolvedState: LetterState = locked ? state : 'empty'
  const tileStyle =
    animateFlip
      ? ({ ['--tile-delay' as string]: `${tileIndex * 120}ms` } as CSSProperties)
      : undefined

  const label = letter ? letter.toUpperCase() : 'Empty tile'
  const accessibilityLabel = locked
    ? `${label}, ${stateLabel[resolvedState]}`
    : label

  return (
    <div
      role="gridcell"
      aria-label={editable ? undefined : accessibilityLabel}
      className={cn(
        'wordle-tile',
        `wordle-tile--${resolvedState}`,
        active && 'wordle-tile--active',
        animateFlip && 'wordle-tile--flip',
        shake && 'wordle-tile--shake',
      )}
      style={tileStyle}
    >
      {editable ? (
        <input
          ref={inputRef}
          className="wordle-tile-input"
          value={letter}
          onChange={(event) => onInputChange?.(event.target.value)}
          onFocus={onInputFocus}
          onKeyDown={onInputKeyDown}
          maxLength={1}
          inputMode="text"
          enterKeyHint="done"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          readOnly={readOnly}
          aria-label={accessibilityLabel}
        />
      ) : (
        <span>{letter.toUpperCase()}</span>
      )}
    </div>
  )
}
