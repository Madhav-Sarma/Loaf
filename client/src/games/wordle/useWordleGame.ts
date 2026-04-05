import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ACCEPTED_WORDS } from './data/acceptedWords'
import { SOLUTION_WORDS } from './data/solutionWords'
import type { GameMode, GameStatus, LetterState, StoredWordleGameState } from './types'
import {
  DEFAULT_WORD_LENGTH,
  WORDLE_STORAGE_KEY,
  clampWordLength,
  computeMaxAttempts,
  evaluateGuess,
  getDateKeyOffset,
  getDaysBetweenDateKeys,
  isWordAccepted,
  normalizeGuess,
  pickDailyWord,
  pickRandomWord,
  toDateKey,
} from './word-utils'

const STORAGE_VERSION = 3
const DAILY_RANDOM_LIMIT = 3
const acceptedWordSet = new Set(ACCEPTED_WORDS)
const solutionWordSet = new Set(SOLUTION_WORDS)

interface RuntimeGameState {
  mode: GameMode
  dateKey: string
  wordLength: number
  solutionWord: string
  guesses: string[]
  currentGuess: string
  status: GameStatus
  streak: number
  lastSolvedDateKey: string | null
  randomUsageDateKey: string
  randomUsageCount: number
}

export interface WordleGameModel {
  mode: GameMode
  status: GameStatus
  feedback: string
  dailyStreak: number
  dailyRandomLimit: number
  dailyRandomsUsed: number
  dailyRandomsRemaining: number
  canStartRandomPuzzle: boolean
  currentGuess: string
  wordLength: number
  maxAttempts: number
  attemptsUsed: number
  attemptsRemaining: number
  rows: string[]
  evaluations: LetterState[][]
  canType: boolean
  revealRowIndex: number | null
  invalidRowIndex: number | null
  solutionWord: string
  onLetter: (letter: string) => void
  onDelete: () => void
  setCurrentGuess: (rawGuess: string) => void
  onSubmit: () => void
  onVirtualKey: (key: string) => void
  startDailyPuzzle: () => void
  startRandomPuzzle: () => void
}

function deriveGameStatus(guesses: string[], solutionWord: string, maxAttempts: number): GameStatus {
  if (guesses.some((guess) => guess === solutionWord)) {
    return 'won'
  }

  if (guesses.length >= maxAttempts) {
    return 'lost'
  }

  return 'playing'
}

function createFreshGame(
  mode: GameMode,
  wordLength: number,
  now: Date,
  previousSolutionWord?: string,
  streak: number = 0,
  lastSolvedDateKey: string | null = null,
  randomUsageDateKey: string = toDateKey(now),
  randomUsageCount: number = 0,
): RuntimeGameState {
  const solutionWord =
    mode === 'daily'
      ? pickDailyWord(SOLUTION_WORDS, now)
      : pickRandomWord(SOLUTION_WORDS, previousSolutionWord)

  return {
    mode,
    dateKey: toDateKey(now),
    wordLength,
    solutionWord,
    guesses: [],
    currentGuess: '',
    status: 'playing',
    streak,
    lastSolvedDateKey,
    randomUsageDateKey,
    randomUsageCount,
  }
}

function parseStoredGame(now: Date): RuntimeGameState {
  const fallback = createFreshGame('daily', DEFAULT_WORD_LENGTH, now)

  if (typeof window === 'undefined') {
    return fallback
  }

  const rawValue = window.localStorage.getItem(WORDLE_STORAGE_KEY)
  if (!rawValue) {
    return fallback
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredWordleGameState> | null
    if (!parsed || typeof parsed !== 'object') {
      return fallback
    }

    if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== STORAGE_VERSION) {
      return fallback
    }

    const mode: GameMode = parsed.mode === 'random' ? 'random' : 'daily'
    const wordLength = clampWordLength(parsed.wordLength ?? DEFAULT_WORD_LENGTH)
    const maxAttempts = computeMaxAttempts(wordLength)
    const todayDateKey = toDateKey(now)

    let streak =
      typeof parsed.streak === 'number' && Number.isFinite(parsed.streak)
        ? Math.max(0, Math.floor(parsed.streak))
        : 0

    let lastSolvedDateKey =
      typeof parsed.lastSolvedDateKey === 'string'
        ? parsed.lastSolvedDateKey
        : null

    let randomUsageDateKey =
      typeof parsed.randomUsageDateKey === 'string' ? parsed.randomUsageDateKey : todayDateKey

    let randomUsageCount =
      typeof parsed.randomUsageCount === 'number' && Number.isFinite(parsed.randomUsageCount)
        ? Math.max(0, Math.floor(parsed.randomUsageCount))
        : 0

    if (lastSolvedDateKey) {
      const daysSinceLastSolve = getDaysBetweenDateKeys(lastSolvedDateKey, todayDateKey)
      if (daysSinceLastSolve === null) {
        streak = 0
        lastSolvedDateKey = null
      } else if (daysSinceLastSolve > 1) {
        streak = 0
      }
    }

    if (randomUsageDateKey !== todayDateKey) {
      randomUsageDateKey = todayDateKey
      randomUsageCount = 0
    }

    const solutionWord =
      typeof parsed.solutionWord === 'string'
        ? normalizeGuess(parsed.solutionWord, wordLength)
        : ''

    if (solutionWord.length !== wordLength || !solutionWordSet.has(solutionWord)) {
      return createFreshGame(
        mode,
        wordLength,
        now,
        undefined,
        streak,
        lastSolvedDateKey,
        randomUsageDateKey,
        randomUsageCount,
      )
    }

    const guesses = Array.isArray(parsed.guesses)
      ? parsed.guesses
          .filter((guess): guess is string => typeof guess === 'string')
          .map((guess) => normalizeGuess(guess, wordLength))
          .filter((guess) => guess.length === wordLength && isWordAccepted(guess, acceptedWordSet, solutionWordSet))
          .slice(0, maxAttempts)
      : []

    let currentGuess =
      typeof parsed.currentGuess === 'string'
        ? normalizeGuess(parsed.currentGuess, wordLength)
        : ''

    let status = deriveGameStatus(guesses, solutionWord, maxAttempts)

    if (status !== 'playing') {
      currentGuess = ''
    }

    const storedDateKey = typeof parsed.dateKey === 'string' ? parsed.dateKey : todayDateKey
    if (mode === 'daily' && storedDateKey !== todayDateKey) {
      return createFreshGame(
        'daily',
        wordLength,
        now,
        solutionWord,
        streak,
        lastSolvedDateKey,
        randomUsageDateKey,
        randomUsageCount,
      )
    }

    return {
      mode,
      dateKey: storedDateKey,
      wordLength,
      solutionWord,
      guesses,
      currentGuess,
      status,
      streak,
      lastSolvedDateKey,
      randomUsageDateKey,
      randomUsageCount,
    }
  } catch {
    return fallback
  }
}

export function useWordleGame(): WordleGameModel {
  const [game, setGame] = useState<RuntimeGameState>(() => parseStoredGame(new Date()))
  const [notice, setNotice] = useState('')
  const [invalidRowIndex, setInvalidRowIndex] = useState<number | null>(null)
  const [revealRowIndex, setRevealRowIndex] = useState<number | null>(null)
  const invalidRowTimerRef = useRef<number | null>(null)

  const maxAttempts = computeMaxAttempts(game.wordLength)
  const attemptsUsed = game.guesses.length
  const attemptsRemaining = Math.max(maxAttempts - attemptsUsed, 0)
  const canType = game.status === 'playing'
  const todayDateKey = toDateKey(new Date())
  const dailyRandomsUsed = game.randomUsageDateKey === todayDateKey ? game.randomUsageCount : 0
  const dailyRandomsRemaining = Math.max(DAILY_RANDOM_LIMIT - dailyRandomsUsed, 0)
  const canStartRandomPuzzle = dailyRandomsRemaining > 0

  const evaluations = useMemo(
    () => game.guesses.map((guess) => evaluateGuess(guess, game.solutionWord)),
    [game.guesses, game.solutionWord],
  )

  const rows = useMemo(() => {
    const boardRows: string[] = []

    for (let rowIndex = 0; rowIndex < maxAttempts; rowIndex += 1) {
      if (rowIndex < game.guesses.length) {
        boardRows.push(game.guesses[rowIndex])
        continue
      }

      if (rowIndex === game.guesses.length && game.status === 'playing') {
        boardRows.push(game.currentGuess)
        continue
      }

      boardRows.push('')
    }

    return boardRows
  }, [game.currentGuess, game.guesses, game.status, maxAttempts])

  const feedback = useMemo(() => {
    if (notice) {
      return notice
    }

    if (game.status === 'won') {
      return `You solved it in ${attemptsUsed} ${attemptsUsed === 1 ? 'try' : 'tries'}!`
    }

    if (game.status === 'lost') {
      return `Out of tries. The word was ${game.solutionWord.toUpperCase()}.`
    }

    return `${attemptsRemaining} ${attemptsRemaining === 1 ? 'try' : 'tries'} left.`
  }, [attemptsRemaining, attemptsUsed, game.solutionWord, game.status, notice])

  const flashInvalidRow = useCallback((rowIndex: number, message: string) => {
    setNotice(message)
    setInvalidRowIndex(rowIndex)

    if (invalidRowTimerRef.current !== null) {
      window.clearTimeout(invalidRowTimerRef.current)
    }

    invalidRowTimerRef.current = window.setTimeout(() => {
      setInvalidRowIndex(null)
      invalidRowTimerRef.current = null
    }, 420)
  }, [])

  const onLetter = useCallback((rawLetter: string) => {
    const letter = normalizeGuess(rawLetter, 1)
    if (!letter) {
      return
    }

    setGame((prev) => {
      if (prev.status !== 'playing' || prev.currentGuess.length >= prev.wordLength) {
        return prev
      }

      return {
        ...prev,
        currentGuess: prev.currentGuess + letter,
      }
    })

    setNotice('')
  }, [])

  const onDelete = useCallback(() => {
    setGame((prev) => {
      if (prev.status !== 'playing' || prev.currentGuess.length === 0) {
        return prev
      }

      return {
        ...prev,
        currentGuess: prev.currentGuess.slice(0, -1),
      }
    })

    setNotice('')
  }, [])

  const setCurrentGuess = useCallback((rawGuess: string) => {
    setGame((prev) => {
      if (prev.status !== 'playing') {
        return prev
      }

      const nextGuess = normalizeGuess(rawGuess, prev.wordLength)
      if (nextGuess === prev.currentGuess) {
        return prev
      }

      return {
        ...prev,
        currentGuess: nextGuess,
      }
    })

    setNotice('')
  }, [])

  const onSubmit = useCallback(() => {
    let invalidMessage = ''
    let invalidRow: number | null = null
    let newlyRevealedRow: number | null = null
    let completionMessage = ''

    setGame((prev) => {
      if (prev.status !== 'playing') {
        completionMessage =
          prev.status === 'won'
            ? 'Puzzle already solved.'
            : `Puzzle complete. The answer is ${prev.solutionWord.toUpperCase()}.`
        return prev
      }

      const attemptsLimit = computeMaxAttempts(prev.wordLength)

      if (prev.currentGuess.length !== prev.wordLength) {
        invalidMessage = `Word must be ${prev.wordLength} letters.`
        invalidRow = prev.guesses.length
        return prev
      }

      const guess = prev.currentGuess
      if (!isWordAccepted(guess, acceptedWordSet, solutionWordSet)) {
        invalidMessage = 'That word is not in the dictionary.'
        invalidRow = prev.guesses.length
        return prev
      }

      const guesses = [...prev.guesses, guess]
      const status = deriveGameStatus(guesses, prev.solutionWord, attemptsLimit)
      newlyRevealedRow = guesses.length - 1

      let streak = prev.streak
      let lastSolvedDateKey = prev.lastSolvedDateKey

      if (status === 'won' && prev.mode === 'daily' && prev.lastSolvedDateKey !== prev.dateKey) {
        const yesterdayDateKey = getDateKeyOffset(prev.dateKey, -1)
        if (prev.lastSolvedDateKey && yesterdayDateKey && prev.lastSolvedDateKey === yesterdayDateKey) {
          streak = prev.streak + 1
        } else {
          streak = 1
        }

        lastSolvedDateKey = prev.dateKey
      }

      if (status === 'won') {
        if (prev.mode === 'daily') {
          completionMessage = `You solved it in ${guesses.length} ${guesses.length === 1 ? 'try' : 'tries'}! Daily streak: ${streak}.`
        } else {
          completionMessage = `You solved it in ${guesses.length} ${guesses.length === 1 ? 'try' : 'tries'}!`
        }
      } else if (status === 'lost') {
        completionMessage = `Out of tries. The word was ${prev.solutionWord.toUpperCase()}.`
      }

      return {
        ...prev,
        guesses,
        currentGuess: '',
        status,
        streak,
        lastSolvedDateKey,
      }
    })

    if (invalidRow !== null) {
      flashInvalidRow(invalidRow, invalidMessage)
      return
    }

    if (newlyRevealedRow !== null) {
      setRevealRowIndex(newlyRevealedRow)
    }

    setNotice(completionMessage)
  }, [flashInvalidRow])

  const onVirtualKey = useCallback(
    (key: string) => {
      if (key === 'enter') {
        onSubmit()
        return
      }

      if (key === 'delete') {
        onDelete()
        return
      }

      onLetter(key)
    },
    [onDelete, onLetter, onSubmit],
  )

  const startDailyPuzzle = useCallback(() => {
    const now = new Date()
    const todayDateKey = toDateKey(now)

    setGame((prev) => {
      const randomUsageCount = prev.randomUsageDateKey === todayDateKey ? prev.randomUsageCount : 0

      return {
        ...prev,
        mode: 'daily',
        dateKey: todayDateKey,
        wordLength: prev.wordLength,
        solutionWord: pickDailyWord(SOLUTION_WORDS, now),
        guesses: [],
        currentGuess: '',
        status: 'playing',
        randomUsageDateKey: todayDateKey,
        randomUsageCount,
      }
    })

    setNotice('Daily puzzle loaded.')
    setRevealRowIndex(null)
    setInvalidRowIndex(null)
  }, [])

  const startRandomPuzzle = useCallback(() => {
    const now = new Date()
    const todayDateKey = toDateKey(now)

    if (!canStartRandomPuzzle) {
      setNotice(`Daily random limit reached (${DAILY_RANDOM_LIMIT}). Try again tomorrow.`)
      setRevealRowIndex(null)
      setInvalidRowIndex(null)
      return
    }

    setGame((prev) => {
      const randomUsageCount = prev.randomUsageDateKey === todayDateKey ? prev.randomUsageCount : 0

      if (randomUsageCount >= DAILY_RANDOM_LIMIT) {
        return prev
      }

      return {
        ...prev,
        mode: 'random',
        dateKey: todayDateKey,
        wordLength: prev.wordLength,
        solutionWord: pickRandomWord(SOLUTION_WORDS, prev.solutionWord),
        guesses: [],
        currentGuess: '',
        status: 'playing',
        randomUsageDateKey: todayDateKey,
        randomUsageCount: randomUsageCount + 1,
      }
    })

    const remainingRandomsAfterLoad = Math.max(dailyRandomsRemaining - 1, 0)

    setNotice(
      `Random puzzle loaded. ${remainingRandomsAfterLoad} ${
        remainingRandomsAfterLoad === 1 ? 'random game' : 'random games'
      } left today.`,
    )
    setRevealRowIndex(null)
    setInvalidRowIndex(null)
  }, [canStartRandomPuzzle, dailyRandomsRemaining])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedGame: StoredWordleGameState = {
      version: STORAGE_VERSION,
      mode: game.mode,
      dateKey: game.dateKey,
      wordLength: game.wordLength,
      solutionWord: game.solutionWord,
      guesses: game.guesses,
      currentGuess: game.currentGuess,
      status: game.status,
      streak: game.streak,
      lastSolvedDateKey: game.lastSolvedDateKey,
      randomUsageDateKey: game.randomUsageDateKey,
      randomUsageCount: game.randomUsageCount,
    }

    window.localStorage.setItem(WORDLE_STORAGE_KEY, JSON.stringify(storedGame))
  }, [game])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
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
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onDelete, onLetter, onSubmit])

  useEffect(
    () => () => {
      if (invalidRowTimerRef.current !== null) {
        window.clearTimeout(invalidRowTimerRef.current)
      }
    },
    [],
  )

  return {
    mode: game.mode,
    status: game.status,
    feedback,
    dailyStreak: game.streak,
    dailyRandomLimit: DAILY_RANDOM_LIMIT,
    dailyRandomsUsed,
    dailyRandomsRemaining,
    canStartRandomPuzzle,
    currentGuess: game.currentGuess,
    wordLength: game.wordLength,
    maxAttempts,
    attemptsUsed,
    attemptsRemaining,
    rows,
    evaluations,
    canType,
    revealRowIndex,
    invalidRowIndex,
    solutionWord: game.solutionWord,
    onLetter,
    onDelete,
    setCurrentGuess,
    onSubmit,
    onVirtualKey,
    startDailyPuzzle,
    startRandomPuzzle,
  }
}
