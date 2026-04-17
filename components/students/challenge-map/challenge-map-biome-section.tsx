'use client'

import type { ReactNode } from 'react'
import type { ChallengeMapBiomeSection } from '@/lib/students/challenge-map'

interface ChallengeMapBiomeSectionCardProps {
  section: ChallengeMapBiomeSection
  children: ReactNode
}

export function ChallengeMapBiomeSectionCard({ section, children }: ChallengeMapBiomeSectionCardProps) {
  return (
    <section
      aria-label={`${section.biomeRouteName} biome section`}
      className={`overflow-hidden rounded-2xl border border-[var(--border)] ${section.biomeTintClassName}`}
    >
      <div className="border-b border-[var(--border)]/70 bg-[var(--card)]/60 px-4 py-2.5 backdrop-blur-[1px]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {section.biomeIcon} · {section.biomeLabel}
        </p>
        <h3 className="text-sm font-semibold text-foreground">{section.biomeRouteName}</h3>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  )
}
