import { Delete, CornerDownLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { KeyboardState } from '../types'
import { KEYBOARD_ROWS } from '../word-utils'

interface KeyboardProps {
  keyStates: KeyboardState
  disabled: boolean
  onLetter: (letter: string) => void
  onDelete: () => void
  onEnter: () => void
}

export function Keyboard({
  keyStates,
  disabled,
  onLetter,
  onDelete,
  onEnter,
}: KeyboardProps) {
  return (
    <div className="wordle-keyboard" aria-label="On-screen keyboard">
      {KEYBOARD_ROWS.map((row) => (
        <div key={row} className="wordle-keyboard-row">
          {row.split('').map((letter) => {
            const state = keyStates[letter] ?? 'empty'

            return (
              <button
                key={letter}
                type="button"
                className={cn('wordle-key', `wordle-key--${state}`)}
                aria-label={`Type ${letter.toUpperCase()}`}
                onClick={() => onLetter(letter)}
                disabled={disabled}
              >
                {letter.toUpperCase()}
              </button>
            )
          })}
        </div>
      ))}

      <div className="wordle-keyboard-row">
        <button
          type="button"
          className="wordle-key wordle-key--wide wordle-key--action"
          onClick={onEnter}
          disabled={disabled}
          aria-label="Submit guess"
        >
          <CornerDownLeft size={16} />
          Enter
        </button>

        {'zxcvbnm'.split('').map((letter) => {
          const state = keyStates[letter] ?? 'empty'

          return (
            <button
              key={letter}
              type="button"
              className={cn('wordle-key', `wordle-key--${state}`)}
              aria-label={`Type ${letter.toUpperCase()}`}
              onClick={() => onLetter(letter)}
              disabled={disabled}
            >
              {letter.toUpperCase()}
            </button>
          )
        })}

        <button
          type="button"
          className="wordle-key wordle-key--wide wordle-key--action"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Delete letter"
        >
          <Delete size={16} />
          Del
        </button>
      </div>
    </div>
  )
}
