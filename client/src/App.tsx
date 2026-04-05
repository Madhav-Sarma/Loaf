import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { GuessMe } from './games/guess-me/GuessMe'
import { Battleship } from './games/battleship/Battleship'
import { Wordle } from './games/wordle/Wordle'
import { ThemeToggle } from './components/ThemeToggle'
import { MusicInitializer } from './components/MusicInitializer'
import { MusicProvider } from './contexts/MusicContext'

export function App() {
  return (
    <MusicProvider>
      <>
        <MusicInitializer />
        <ThemeToggle />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games/wordle" element={<Wordle />} />
          <Route path="/games/guess-me" element={<GuessMe />} />
          <Route path="/games/battleship" element={<Battleship />} />
        </Routes>
      </>
    </MusicProvider>
  )
}
