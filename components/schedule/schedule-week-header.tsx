'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, MoreHorizontal, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatMonthLabel } from '@/lib/schedule/month-view-layout'
import { formatWeekRangeLabel, SESSION_STATUS_LEGEND } from '@/lib/schedule/week-view-layout'
import { cn } from '@/lib/utils'

export type ScheduleViewMode = 'week' | 'month'

interface ScheduleWeekHeaderProps {
  viewMode: ScheduleViewMode
  onViewModeChange: (mode: ScheduleViewMode) => void
  periodLabel: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onOpenHours: () => void
  onClearWeek?: () => void
  onResetCalendar?: () => void
  highlightStudentId?: string | null
  highlightStudentName?: string | null
}

export function ScheduleWeekHeader({
  viewMode,
  onViewModeChange,
  periodLabel,
  onPrev,
  onNext,
  onToday,
  onOpenHours,
  onClearWeek,
  onResetCalendar,
  highlightStudentId,
  highlightStudentName,
}: ScheduleWeekHeaderProps) {
  const prevLabel = viewMode === 'week' ? 'Previous week' : 'Previous month'
  const nextLabel = viewMode === 'week' ? 'Next week' : 'Next month'
  const showToolsMenu =
    Boolean(onOpenHours) ||
    (viewMode === 'week' && Boolean(onClearWeek)) ||
    Boolean(onResetCalendar)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              <span className="sr-only">{prevLabel}</span>
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
              <ChevronRight className="h-4 w-4" aria-hidden />
              <span className="sr-only">{nextLabel}</span>
            </Button>
          </div>
          <h3 className="text-sm font-semibold text-foreground sm:text-base">{periodLabel}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-lg border border-[var(--border)] p-0.5"
            role="radiogroup"
            aria-label="Calendar view"
          >
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'week'}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors sm:text-sm ${
                viewMode === 'week'
                  ? 'bg-[var(--surface-2)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onViewModeChange('week')}
            >
              Week
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'month'}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors sm:text-sm ${
                viewMode === 'month'
                  ? 'bg-[var(--surface-2)] text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onViewModeChange('month')}
            >
              Month
            </button>
          </div>

          {showToolsMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" aria-label="Calendar tools">
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                  <span className="ml-1.5 hidden sm:inline">Tools</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                <DropdownMenuItem onSelect={() => onOpenHours()}>
                  <Settings2 className="mr-2 h-4 w-4" aria-hidden />
                  Working hours
                </DropdownMenuItem>
                {viewMode === 'week' && onClearWeek ? (
                  <DropdownMenuItem onSelect={() => onClearWeek()}>Clear this week…</DropdownMenuItem>
                ) : null}
                {onResetCalendar ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onResetCalendar()}>
                      Reset calendar…
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {highlightStudentId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/50 bg-amber-100/60 px-3 py-2 text-sm text-foreground dark:border-amber-500/40 dark:bg-amber-500/15">
          <span>
            Booking for{' '}
            <span className="font-semibold">{highlightStudentName ?? 'this student'}</span>
            <span className="text-muted-foreground">
              {' '}
              — click an empty time to schedule them. Their other classes stay highlighted.
            </span>
          </span>
          <Link href="/schedule" className="text-xs font-semibold text-[var(--brand-blue)] hover:underline">
            Show all students
          </Link>
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground"
        aria-label="Class status colors"
      >
        {SESSION_STATUS_LEGEND.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block h-2.5 w-2.5 shrink-0 rounded-sm border',
                item.colors.bg,
                item.colors.border,
              )}
              aria-hidden
            />
            {item.label}
          </span>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Keyboard: T today · W week · M month · ← → navigate · Tab to classes · arrows move · Enter save
      </p>
    </div>
  )
}

export { formatMonthLabel, formatWeekRangeLabel }
