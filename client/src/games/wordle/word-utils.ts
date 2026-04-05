import type { KeyboardState, LetterState } from './types'

export const MIN_WORD_LENGTH = 3
export const MAX_WORD_LENGTH = 8
export const DEFAULT_WORD_LENGTH = 5
export const WORDLE_STORAGE_KEY = 'loaf.wordle.state.v1'
export const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const

const KEY_STATE_PRIORITY: Record<LetterState, number> = {
  empty: 0,
  absent: 1,
  present: 2,
  correct: 3,
}

const REFERENCE_DATE_UTC_MS = Date.UTC(2022, 0, 1)
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function clampWordLength(length: number): number {
  if (!Number.isFinite(length)) {
    return DEFAULT_WORD_LENGTH
  }

  return Math.max(MIN_WORD_LENGTH, Math.min(MAX_WORD_LENGTH, Math.floor(length)))
}

export function computeMaxAttempts(wordLength: number): number {
  return Math.max(5, wordLength + 1)
}

export function normalizeGuess(raw: string, wordLength: number): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, wordLength)
}

export function evaluateGuess(guess: string, answer: string): LetterState[] {
  const states: LetterState[] = Array.from({ length: answer.length }, () => 'absent')
  const remainingCounts = new Map<string, number>()

  for (const letter of answer) {
    remainingCounts.set(letter, (remainingCounts.get(letter) ?? 0) + 1)
  }

  for (let index = 0; index < answer.length; index += 1) {
    const guessedLetter = guess[index]

    if (guessedLetter === answer[index]) {
      states[index] = 'correct'
      remainingCounts.set(guessedLetter, (remainingCounts.get(guessedLetter) ?? 0) - 1)
    }
  }

  for (let index = 0; index < answer.length; index += 1) {
    if (states[index] === 'correct') {
      continue
    }

    const guessedLetter = guess[index]
    const remaining = remainingCounts.get(guessedLetter) ?? 0

    if (remaining > 0) {
      states[index] = 'present'
      remainingCounts.set(guessedLetter, remaining - 1)
    }
  }

  return states
}

export function buildKeyboardState(guesses: string[], evaluations: LetterState[][]): KeyboardState {
  const keyboardState: KeyboardState = {}

  for (let rowIndex = 0; rowIndex < guesses.length; rowIndex += 1) {
    const guess = guesses[rowIndex]
    const rowEvaluation = evaluations[rowIndex] ?? []

    for (let letterIndex = 0; letterIndex < guess.length; letterIndex += 1) {
      const letter = guess[letterIndex]
      const nextState = rowEvaluation[letterIndex] ?? 'absent'
      const currentState = keyboardState[letter] ?? 'empty'

      if (KEY_STATE_PRIORITY[nextState] > KEY_STATE_PRIORITY[currentState]) {
        keyboardState[letter] = nextState
      }
    }
  }

  return keyboardState
}

export function toDateKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateKey(dateKey: string): Date | null {
  const match = DATE_KEY_PATTERN.exec(dateKey)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

export function getDateKeyOffset(dateKey: string, offsetDays: number): string | null {
  const parsed = parseDateKey(dateKey)
  if (!parsed) {
    return null
  }

  parsed.setUTCDate(parsed.getUTCDate() + offsetDays)
  return toDateKey(parsed)
}

export function getDaysBetweenDateKeys(olderDateKey: string, newerDateKey: string): number | null {
  const older = parseDateKey(olderDateKey)
  const newer = parseDateKey(newerDateKey)

  if (!older || !newer) {
    return null
  }

  return Math.floor((newer.getTime() - older.getTime()) / 86_400_000)
}

export function pickDailyWord(words: string[], date: Date = new Date()): string {
  if (words.length === 0) {
    throw new Error('Cannot pick a daily word from an empty list.')
  }

  const todayUtcMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const elapsedDays = Math.floor((todayUtcMs - REFERENCE_DATE_UTC_MS) / 86_400_000)
  const safeIndex = ((elapsedDays % words.length) + words.length) % words.length

  return words[safeIndex]
}

export function pickRandomWord(words: string[], previousWord?: string): string {
  if (words.length === 0) {
    throw new Error('Cannot pick a random word from an empty list.')
  }

  if (words.length === 1) {
    return words[0]
  }

  let randomWord = words[Math.floor(Math.random() * words.length)]

  if (previousWord && randomWord === previousWord) {
    const fallbackIndex = words.indexOf(previousWord)
    randomWord = words[(fallbackIndex + 1) % words.length]
  }

  return randomWord
}

export function isWordAccepted(
  word: string,
  acceptedWords: ReadonlySet<string>,
  solutionWords: ReadonlySet<string>,
): boolean {
  return acceptedWords.has(word) || solutionWords.has(word)
}
