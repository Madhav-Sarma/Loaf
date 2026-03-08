import { Link } from 'react-router-dom'
import { Dice1, Users, Sparkles } from 'lucide-react'

import { GameCard, PhaseHeader, PhaseShell } from '@/games/guess-me/components/GameUi'
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt'

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
    <div className="phase-bg min-h-screen pb-10">
      <header className="px-4 pt-12 text-center sm:pt-16">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-300/60 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700 backdrop-blur-sm">
          <Sparkles className="size-4 animate-pulse" />
          Multiplayer Party Platform
        </p>
        <h1 className="text-6xl font-black tracking-tight text-orange-600 sm:text-7xl">Loaf</h1>
        <p className="mx-auto mt-2 max-w-md text-base text-slate-700 sm:text-lg">
          Quick social games, bold visuals, and just enough chaos.
        </p>
        <PwaInstallPrompt />
      </header>

      <main className="mx-auto mt-8 max-w-md px-4 pb-24">
        <PhaseShell className="gap-4 px-0">
          <PhaseHeader
            title="Pick A Game"
            subtitle="Mobile-first rounds with smooth transitions, fast joins, and playful reveals."
            icon={<Dice1 className="size-7 text-cyan-500 transition-transform duration-200 hover:rotate-12" />}
          />

          {games.map((game) => (
            <Link
              key={game.id}
              to={game.path}
              className="group block"
            >
              <GameCard className="touch-card border-orange-200/40 transition-all duration-300 group-hover:scale-[1.01] group-hover:border-orange-300/70">
                <div className="flex items-center gap-4">
                  <span className="text-4xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{game.emoji}</span>
                  <div className="space-y-1">
                    <h3 className="text-xl font-extrabold text-slate-900">{game.name}</h3>
                    <p className="text-sm text-slate-600">{game.description}</p>
                    <span className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-700">
                      <Users className="size-3.5" />
                      {game.players} players
                    </span>
                  </div>
                </div>
                <div className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-fuchsia-500 via-orange-400 to-cyan-400 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25 transition-all duration-200 group-hover:scale-[1.01]">
                  <Sparkles className="size-4" />
                  Play {game.name}
                </div>
              </GameCard>
            </Link>
          ))}
        </PhaseShell>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-amber-700">
            music incoming(this part is being cooked please wait)
          </p>
        </section>
      </main>
    </div>
  )
}
