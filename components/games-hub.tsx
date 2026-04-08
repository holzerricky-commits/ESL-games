'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Settings, Zap, Sparkles, ArrowRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SettingsModal } from '@/components/settings-modal'
import { GAMES, gameHref } from '@/lib/games'

export function GamesHub() {
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-2)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-blue)] shadow-[0_0_16px_rgba(59,130,246,0.4)]">
              <Zap size={18} className="text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none text-foreground tracking-tight">ESL Classroom Games</h1>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">Teacher Ricky</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-muted-foreground hover:bg-[var(--surface-3)] hover:text-foreground hover:border-[var(--brand-blue)] transition-all"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 max-w-2xl">
          <div className="flex items-center gap-2 text-[var(--brand-blue-bright)] mb-2">
            <Sparkles size={18} />
            <span className="text-sm font-semibold uppercase tracking-wider">Choose a game</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Pick something to play with your class</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            More activities are on the way. Timed Challenge is ready now; other games open their own dashboard when they
            go live.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {GAMES.map((game) => (
            <article
              key={game.slug}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all duration-300 hover:border-[var(--brand-blue)] hover:shadow-[0_0_24px_rgba(59,130,246,0.15)]"
            >
              <div className="relative aspect-[3/2] w-full overflow-hidden bg-[var(--surface-3)]">
                <Image
                  src={game.coverImage}
                  alt=""
                  width={1200}
                  height={800}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  priority={game.slug === 'timed-challenge'}
                />
                <div className="absolute right-3 top-3">
                  <Badge
                    variant="outline"
                    className={
                      game.available
                        ? 'border-[var(--brand-green)] bg-[var(--surface-2)]/95 text-[var(--brand-green)] backdrop-blur-sm'
                        : 'border-[var(--border)] bg-[var(--surface-2)]/95 text-muted-foreground backdrop-blur-sm'
                    }
                  >
                    {game.badge}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground leading-tight">{game.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{game.shortDescription}</p>
                </div>

                <div className="mt-auto pt-2">
                  {game.available ? (
                    <Button
                      asChild
                      className="w-full bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white font-bold gap-2 shadow-[0_0_16px_rgba(59,130,246,0.25)]"
                    >
                      <Link href={gameHref(game.slug)}>
                        Open game
                        <ArrowRight size={16} />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full cursor-not-allowed gap-2 border-[var(--border)] text-muted-foreground opacity-80"
                    >
                      <Lock size={14} />
                      Coming soon
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
