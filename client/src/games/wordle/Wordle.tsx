import { ArrowLeft, CalendarDays, Shuffle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GameBoard } from './components/GameBoard'
import { WORDLE_GAME_VERSION } from './metadata'
import { useWordleGame } from './useWordleGame'
import './wordle.css'

export function Wordle() {
  const {
    mode,
    status,
    feedback,
    dailyStreak,
    dailyRandomLimit,
    dailyRandomsUsed,
    dailyRandomsRemaining,
    canStartRandomPuzzle,
    currentGuess,
    wordLength,
    maxAttempts,
    attemptsUsed,
    attemptsRemaining,
    rows,
    evaluations,
    canType,
    revealRowIndex,
    invalidRowIndex,
    solutionWord,
    onLetter,
    onDelete,
    onSubmit,
    startDailyPuzzle,
    startRandomPuzzle,
  } = useWordleGame()

  return (
    <div className="wordle-page min-h-screen px-3 py-4 sm:px-6 sm:py-8">
      <main className="wordle-shell mx-auto w-full max-w-md">
        <header className="wordle-header">
          <Link to="/" className="wordle-back-link">
            <ArrowLeft size={16} />
            Home
          </Link>

          <h1 className="wordle-title">Loaf Wordle</h1>
          <p className="wordle-subtitle">
            {wordLength}-letter puzzle, {maxAttempts} tries
          </p>
          <p className="wordle-rule">Try rule: word length + 1</p>
          <p className="wordle-rule">Minimum supported word length: 3</p>
          <p className="wordle-rule">Daily random limit: {dailyRandomLimit}</p>
          <p className="wordle-rule">Version {WORDLE_GAME_VERSION}</p>
        </header>

        <div className="wordle-mode-switch" role="group" aria-label="Puzzle mode">
          <button
            type="button"
            className={`wordle-mode-btn ${mode === 'daily' ? 'is-active' : ''}`}
            onClick={startDailyPuzzle}
          >
            <CalendarDays size={16} />
            Daily
          </button>
          <button
            type="button"
            className={`wordle-mode-btn ${mode === 'random' ? 'is-active' : ''}`}
            onClick={startRandomPuzzle}
            disabled={!canStartRandomPuzzle}
          >
            <Shuffle size={16} />
            Random
          </button>
        </div>

        <p
          className={`wordle-notice wordle-notice--${status}`}
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>

        <GameBoard
          rows={rows}
          evaluations={evaluations}
          currentGuess={currentGuess}
          canType={canType}
          wordLength={wordLength}
          revealRowIndex={revealRowIndex}
          invalidRowIndex={invalidRowIndex}
          onLetter={onLetter}
          onDelete={onDelete}
          onSubmit={onSubmit}
        />

        <footer className="wordle-footer">
          <p className="wordle-meta">
            {attemptsUsed}/{maxAttempts} used, {attemptsRemaining} left
          </p>
          <p className="wordle-meta">Daily streak: {dailyStreak}</p>
          <p className="wordle-meta">
            Randoms today: {dailyRandomsUsed}/{dailyRandomLimit} used ({dailyRandomsRemaining} left)
          </p>

          <div className="wordle-actions">
            <button
              type="button"
              className="wordle-action-btn"
              onClick={startRandomPuzzle}
              disabled={!canStartRandomPuzzle}
            >
              <Shuffle size={16} />
              {canStartRandomPuzzle ? 'New Random' : 'Random Limit Reached'}
            </button>
          </div>
        </footer>

        {status !== 'playing' ? (
          <p className="wordle-answer" aria-live="polite">
            Answer: {solutionWord.toUpperCase()}
          </p>
        ) : null}
      </main>
    </div>
  )
}
