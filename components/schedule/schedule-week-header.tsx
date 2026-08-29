'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, MoreHorizontal, Settings2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatMonthLabel } from '@/lib/schedule/month-view-layout'
import { formatWeekRangeLabel, SESSION_STATUS_LEGEND } from '@/lib/schedule/week-view-layout'
import { scheduleMenuContentClass } from '@/components/schedule/schedule-sheet-chrome'
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
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onToday}
            className="chrome-nav-pill px-3.5 py-1.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35"
          >
            Today
          </button>
          <div className="flex items-center">
            <button
              type="button"
              className="chrome-icon-btn h-9 w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35"
              onClick={onPrev}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{prevLabel}</span>
            </button>
            <button
              type="button"
              className="chrome-icon-btn h-9 w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35"
              onClick={onNext}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{nextLabel}</span>
            </button>
          </div>
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-foreground sm:text-[22px]">
            {periodLabel}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center" role="radiogroup" aria-label="Calendar view">
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'week'}
              data-active={viewMode === 'week'}
              className="chrome-nav-pill px-3.5 py-1.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35"
              onClick={() => onViewModeChange('week')}
            >
              Week
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === 'month'}
              data-active={viewMode === 'month'}
              className="chrome-nav-pill px-3.5 py-1.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35"
              onClick={() => onViewModeChange('month')}
            >
              Month
            </button>
          </div>

          {showToolsMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="chrome-icon-btn h-9 w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]/35"
                  aria-label="Calendar tools"
                >
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={cn('min-w-[12rem]', scheduleMenuContentClass)}>
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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-[color-mix(in_srgb,var(--brand-yellow)_16%,var(--surface-2))] px-3.5 py-2.5 text-[13px] text-foreground">
          <span>
            Booking for{' '}
            <span className="font-semibold tracking-tight">{highlightStudentName ?? 'this student'}</span>
            <span className="text-muted-foreground"> · click an empty time to add them</span>
          </span>
          <Link
            href="/schedule"
            className="chrome-nav-pill px-3 py-1 text-[12px] font-medium"
          >
            Show all
          </Link>
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] text-muted-foreground"
        aria-label="Class status colors"
      >
        {SESSION_STATUS_LEGEND.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', item.colors.accent)} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export { formatMonthLabel, formatWeekRangeLabel }
