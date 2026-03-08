import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { GuessMe } from './games/guess-me/GuessMe'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/games/guess-me" element={<GuessMe />} />
      
    </Routes>
  )
}
