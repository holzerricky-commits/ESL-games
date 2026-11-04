'use client'

import type { StoryScope } from '@/lib/lesson-vault/story-scope'
import { cn } from '@/lib/utils'

const CHIP =
  'inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors motion-reduce:transition-none'

type StoryScopeChipsProps = {
  scopes: readonly StoryScope[]
  selectedPartId: string | null
  onSelect: (partId: string | null) => void
  /** Total words when All is selected. */
  allCount: number
  className?: string
}

/** Horizontal chips: All + each story that has words. */
export function StoryScopeChips({
  scopes,
  selectedPartId,
  onSelect,
  allCount,
  className,
}: StoryScopeChipsProps) {
  if (scopes.length <= 1) return null
  return (
    <div
      className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}
      role="tablist"
      aria-label="Words by story"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedPartId == null}
        className={cn(
          CHIP,
          selectedPartId == null
            ? 'bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/40'
            : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80',
        )}
        onClick={() => onSelect(null)}
      >
        All
        <span className="tabular-nums text-white/45">{allCount}</span>
      </button>
      {scopes.map((scope) => {
        const selected = selectedPartId === scope.partId
        return (
          <button
            key={scope.partId}
            type="button"
            role="tab"
            aria-selected={selected}
            title={scope.label}
            className={cn(
              CHIP,
              'max-w-[11rem]',
              selected
                ? 'bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/40'
                : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80',
            )}
            onClick={() => onSelect(scope.partId)}
          >
            <span className="truncate">{scope.label}</span>
            <span className="shrink-0 tabular-nums text-white/45">{scope.count}</span>
          </button>
        )
      })}
    </div>
  )
}
