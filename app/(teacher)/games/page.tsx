import { Sparkles } from 'lucide-react'
import { GamesGrid } from '@/components/games-grid'
import { PageHeader } from '@/components/page-header'

export default function GamesPage() {
  return (
    <section>
      <PageHeader
        title="Games"
        description="Pick a game and launch quickly while screen-sharing."
      />
      <div className="mb-6 flex items-center gap-2 text-[var(--brand-blue-bright)]">
        <Sparkles size={16} />
        <p className="text-sm font-semibold uppercase tracking-wider">Teacher launchpad</p>
      </div>
      <GamesGrid />
    </section>
  )
}
