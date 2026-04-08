import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GAMES, gameHref } from '@/lib/games'

export function GamesGrid() {
  return (
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
  )
}
