import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { GuessMe } from './games/guess-me/GuessMe'
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
          <Route path="/games/guess-me" element={<GuessMe />} />
        </Routes>
      </>
    </MusicProvider>
  )
}
