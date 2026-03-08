import { Link } from 'react-router-dom'

const games = [
  {
    id: 'guess-me',
    name: 'Guess Me',
    description: 'Pick a number, perform a prompt, and try to guess what others chose!',
    emoji: '🎭',
    path: '/games/guess-me',
    players: '3–10',
  },
]

export function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100">
      <header className="text-center pt-12 pb-8 px-4">
        <h1 className="text-5xl font-bold text-amber-800">🍞 Loaf</h1>
        <p className="text-amber-600 mt-2 text-lg">Party games for friends</p>
      </header>

      <main className="max-w-md mx-auto px-4 pb-12">
        <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-4">
          Games
        </h2>
        <div className="space-y-4">
          {games.map((game) => (
            <Link
              key={game.id}
              to={game.path}
              className="block rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all"
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl">{game.emoji}</span>
                <div>
                  <h3 className="text-lg font-bold text-amber-800">{game.name}</h3>
                  <p className="text-sm text-amber-600">{game.description}</p>
                  <span className="text-xs text-amber-500 mt-1 inline-block">
                    {game.players} players
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
