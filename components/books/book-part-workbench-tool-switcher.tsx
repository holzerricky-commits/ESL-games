'use client'

import { Check, FileText, ListChecks, ScrollText, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BookPartWorkbenchToolId = 'pages' | 'text' | 'checks'

type ToolReady = boolean

interface BookPartWorkbenchToolSwitcherProps {
  active: BookPartWorkbenchToolId
  onChange: (tool: BookPartWorkbenchToolId) => void
  textReady?: ToolReady
  checksReady?: ToolReady
  className?: string
}

const TOOLS: {
  id: BookPartWorkbenchToolId
  label: string
  icon: LucideIcon
}[] = [
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'text', label: 'Text', icon: ScrollText },
  { id: 'checks', label: 'Checks', icon: ListChecks },
]

/**
 * Compact bottom rail for the part workbench — matches outline-wizard density.
 */
export function BookPartWorkbenchToolSwitcher({
  active,
  onChange,
  textReady = false,
  checksReady = false,
  className,
}: BookPartWorkbenchToolSwitcherProps) {
  return (
    <div
      className={cn('flex gap-1 rounded-xl bg-[var(--surface-3)] p-1', className)}
      role="tablist"
      aria-label="Prep tools"
    >
      {TOOLS.map(({ id, label, icon: Icon }) => {
        const selected = active === id
        const ready = id === 'text' ? textReady : id === 'checks' ? checksReady : true
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1.5 py-2 text-[11px] font-medium tracking-tight transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35',
              selected
                ? 'bg-[var(--surface-2)] text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="relative inline-flex">
              <Icon className="h-4 w-4" strokeWidth={selected ? 2 : 1.75} aria-hidden />
              {id !== 'pages' && ready ? (
                <span
                  className="absolute -right-1.5 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--brand-blue)] text-white"
                  aria-hidden
                >
                  <Check className="h-2 w-2 stroke-[3]" />
                </span>
              ) : null}
            </span>
            <span className="truncate">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
