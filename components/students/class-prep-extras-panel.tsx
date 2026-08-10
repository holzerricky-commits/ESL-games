'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { hasPrepExtras, prepRevisitWordLabels } from '@/lib/students/class-prep-extras'
import type { StudentClassSessionView } from '@/lib/students/types'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface ClassPrepExtrasPanelProps {
  session: StudentClassSessionView
  className?: string
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-xs leading-snug text-foreground md:text-sm">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--brand-blue)]" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function PrepSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-[var(--border)] px-3 py-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function ClassPrepExtrasPanel({ session, className }: ClassPrepExtrasPanelProps) {
  if (!hasPrepExtras(session)) return null

  const words = session.prepWordsToRevisit ?? []

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prep highlights</p>

      {session.prepPriorities?.length ? (
        <PrepSection title="Priorities">
          <BulletList items={session.prepPriorities} />
        </PrepSection>
      ) : null}

      {words.length ? (
        <PrepSection title="Words to revisit">
          <ul className="space-y-2 text-xs md:text-sm">
            {words.map((row) => (
              <li key={row.word} className="rounded-md bg-[var(--surface-2)] px-2 py-1.5">
                <p className="font-medium text-foreground">{row.word}</p>
                {row.reason ? <p className="mt-0.5 text-muted-foreground">{row.reason}</p> : null}
              </li>
            ))}
          </ul>
        </PrepSection>
      ) : null}

      {session.prepCheckpointMoments?.length ? (
        <PrepSection title="Checkpoints">
          <BulletList items={session.prepCheckpointMoments} />
        </PrepSection>
      ) : null}

      {session.prepSuggestedActivities?.length ? (
        <PrepSection title="Activity ideas" defaultOpen={false}>
          <BulletList items={session.prepSuggestedActivities} />
        </PrepSection>
      ) : null}

      {session.prepDifferentiationTips?.length ? (
        <PrepSection title="Differentiation" defaultOpen={false}>
          <BulletList items={session.prepDifferentiationTips} />
        </PrepSection>
      ) : null}

      {session.prepCarryOver?.length ? (
        <PrepSection title="Carry over" defaultOpen={false}>
          <BulletList items={session.prepCarryOver} />
        </PrepSection>
      ) : null}
    </div>
  )
}

export function formatTargetWordsLine(session: StudentClassSessionView): string {
  const revisit = prepRevisitWordLabels(session)
  const words = revisit.length > 0 ? revisit : session.plannedVocabulary
  if (!words.length) return 'None yet'
  return `${words.length} total · ${words.slice(0, 3).join(', ')}${words.length > 3 ? '…' : ''}`
}
