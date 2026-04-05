export type LetterState = 'empty' | 'correct' | 'present' | 'absent'

export type GameStatus = 'playing' | 'won' | 'lost'

export type GameMode = 'daily' | 'random'

export type KeyboardState = Record<string, LetterState>

export interface StoredWordleGameState {
  version: number
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
