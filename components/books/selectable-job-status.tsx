'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { SearchablePdfProgress } from '@/lib/books/searchable-pdf-client'
import { cn } from '@/lib/utils'

/** Show elapsed time once one page has been in flight this long. */
const SLOW_PAGE_MS = 5000

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

export interface SelectableJobStatusProps {
  progress: SearchablePdfProgress
  onStop?: () => void
  className?: string
}

/**
 * Live fill bar + per-page chips for Make pages selectable / Redo.
 */
export function SelectableJobStatus({ progress, onStop, className }: SelectableJobStatusProps) {
  const { pages, percent, doneCount, totalCount, activeLabel, activeStartedAt, message } = progress
  const now = useNow(activeStartedAt != null)
  const elapsedMs = activeStartedAt != null ? now - activeStartedAt : 0
  const planned = totalCount > 0

  const headline = activeLabel ? message : planned ? 'Making pages selectable' : message
  const detail = activeLabel
    ? elapsedMs >= SLOW_PAGE_MS
      ? `Still working on this page · ${formatElapsed(elapsedMs)}`
      : 'Reading the words on this page'
    : planned
      ? message
      : null

  return (
    <div
      className={cn('w-full space-y-2 rounded-lg border border-border bg-muted/30 p-3', className)}
      role="status"
      aria-live="polite"
      aria-busy
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs font-medium text-foreground">
          {headline}
          {planned ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {doneCount}/{totalCount}
            </span>
          ) : null}
        </p>
        {planned ? (
          <span className="tabular-nums text-xs font-semibold text-foreground">{percent}%</span>
        ) : null}
      </div>

      <Progress value={planned ? percent : 0} className="h-2.5" />

      {pages.length > 0 ? (
        <div className="flex flex-wrap gap-1" aria-hidden>
          {pages.map((page) => (
            <span
              key={page.pdfPage}
              title={
                page.status === 'skipped'
                  ? `Page ${page.pdfPage} already has text`
                  : `Page ${page.pdfPage}`
              }
              className={cn(
                'inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-[10px] font-medium tabular-nums transition-colors',
                page.status === 'done' && 'bg-emerald-600 text-white',
                page.status === 'skipped' && 'bg-emerald-600/20 text-emerald-900 dark:text-emerald-100',
                page.status === 'active' &&
                  'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300/80 animate-pulse',
                page.status === 'pending' && 'bg-muted text-muted-foreground',
                page.status === 'failed' && 'bg-rose-600 text-white',
              )}
            >
              {page.pdfPage}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">{detail}</p>
        {onStop ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={onStop}>
            Stop
          </Button>
        ) : null}
      </div>
    </div>
  )
}
