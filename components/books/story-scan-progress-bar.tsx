'use client'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { StoryScanProgress } from '@/lib/books/story-text-scan-client'
import { cn } from '@/lib/utils'

export interface StoryScanProgressBarProps {
  progress: StoryScanProgress
  onCancel?: () => void
  className?: string
}

/**
 * Live fill bar + per-page chips for story text scanning.
 */
export function StoryScanProgressBar({
  progress,
  onCancel,
  className,
}: StoryScanProgressBarProps) {
  const { pages, percent, doneCount, totalCount, activeLabel, message } = progress

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border border-border bg-muted/30 p-3',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy={doneCount < totalCount}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">
          {activeLabel ? `Reading p. ${activeLabel}` : 'Scanning story'}
          <span className="ml-1.5 font-normal text-muted-foreground">
            {doneCount}/{totalCount}
          </span>
        </p>
        <span className="tabular-nums text-xs font-semibold text-foreground">{percent}%</span>
      </div>

      <Progress value={percent} className="h-2.5" />

      {pages.length > 0 ? (
        <div className="flex flex-wrap gap-1" aria-hidden>
          {pages.map((page) => (
            <span
              key={page.pdfPage}
              title={`Page ${page.label}`}
              className={cn(
                'inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums transition-colors',
                page.status === 'done' && 'bg-emerald-600 text-white',
                page.status === 'active' &&
                  'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300/80 animate-pulse',
                page.status === 'pending' && 'bg-muted text-muted-foreground',
                page.status === 'failed' && 'bg-rose-600 text-white',
              )}
            >
              {page.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">{message}</p>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={onCancel}>
            Stop
          </Button>
        ) : null}
      </div>
    </div>
  )
}
