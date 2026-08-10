'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import {
  getMonthGridDays,
  groupSessionsByDay,
  isDateInMonth,
  isToday,
  localDayKey,
  MONTH_WEEKDAY_LABELS,
} from '@/lib/schedule/month-view-layout'
import { getSessionStatusColors } from '@/lib/schedule/week-view-layout'
import { formatClassSessionAriaLabel } from '@/lib/schedule/schedule-a11y-labels'
import type { TodaysClassSessionRow } from '@/lib/students/selectors'

const MAX_VISIBLE_EVENTS = 3

interface ScheduleMonthGridProps {
  monthAnchor: Date
  sessions: TodaysClassSessionRow[]
  onDayZoom: (date: Date) => void
  onEventClick: (row: TodaysClassSessionRow) => void
  highlightStudentId?: string | null
  workingDays?: number[]
}

export function ScheduleMonthGrid({
  monthAnchor,
  sessions,
  onDayZoom,
  onEventClick,
  highlightStudentId,
  workingDays,
}: ScheduleMonthGridProps) {
  const gridDays = useMemo(() => getMonthGridDays(monthAnchor), [monthAnchor])
  const sessionsByDay = useMemo(() => groupSessionsByDay(sessions), [sessions])
  const rowCount = gridDays.length / 7
  const teachDays = workingDays && workingDays.length > 0 ? workingDays : [1, 2, 3, 4, 5]

  function dayLabel(day: Date): string {
    return day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-background"
      role="grid"
      aria-label="Monthly schedule"
    >
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
        {MONTH_WEEKDAY_LABELS.map((label, index) => {
          const dayOfWeek = (index + 1) % 7
          const isOff = !teachDays.includes(dayOfWeek)
          return (
            <div
              key={label}
              className={cn(
                'px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide',
                isOff ? 'text-muted-foreground/55' : 'text-muted-foreground',
              )}
            >
              {label}
            </div>
          )
        })}
      </div>

      <div
        className="grid grid-cols-7"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(6.5rem, 1fr))` }}
      >
        {gridDays.map((day) => {
          const key = localDayKey(day)
          const dayEvents = sessionsByDay.get(key) ?? []
          const inMonth = isDateInMonth(day, monthAnchor)
          const today = isToday(day)
          const working = teachDays.includes(day.getDay())
          const visible = dayEvents
          const hiddenCount = Math.max(0, visible.length - MAX_VISIBLE_EVENTS)

          return (
            <div
              key={key}
              role="gridcell"
              className={cn(
                'flex min-h-[6.5rem] flex-col border-b border-r border-[var(--border)] p-1.5 last:border-r-0',
                !inMonth && 'bg-muted/20',
                inMonth && !working && 'bg-muted/35',
              )}
            >
              <button
                type="button"
                className={cn(
                  'mb-1 inline-flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full text-sm font-medium transition-colors',
                  today && 'bg-[var(--brand-blue)] text-white',
                  !today && inMonth && working && 'text-foreground hover:bg-[var(--surface-2)]',
                  !today && inMonth && !working && 'text-muted-foreground/70 hover:bg-muted/50',
                  !today && !inMonth && 'text-muted-foreground hover:bg-muted/40',
                )}
                onClick={() => onDayZoom(day)}
                aria-label={`Open week view for ${dayLabel(day)}`}
              >
                {day.getDate()}
              </button>

              <div
                role="button"
                tabIndex={0}
                aria-label={`Open week view for ${dayLabel(day)}`}
                className="flex min-h-0 flex-1 cursor-pointer flex-col gap-0.5 overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-blue)]"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('[data-month-event]')) return
                  onDayZoom(day)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  if ((event.target as HTMLElement).closest('[data-month-event]')) return
                  event.preventDefault()
                  onDayZoom(day)
                }}
              >
                {visible.slice(0, MAX_VISIBLE_EVENTS).map((row) => {
                  const start = new Date(row.session.scheduledFor)
                  const startMinute = start.getHours() * 60 + start.getMinutes()
                  const colors = getSessionStatusColors(row.session.status)
                  const isLive = row.session.status === 'in_progress'
                  const isCancelled = row.session.status === 'cancelled'
                  const dimmed = Boolean(highlightStudentId && row.studentId !== highlightStudentId)
                  const highlighted = Boolean(highlightStudentId && row.studentId === highlightStudentId)

                  return (
                    <button
                      key={row.session.id}
                      type="button"
                      data-month-event
                      aria-label={formatClassSessionAriaLabel(row)}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight',
                        colors.bg,
                        colors.border,
                        'border hover:brightness-95',
                        isLive && 'ring-1 ring-amber-400',
                        highlighted && 'ring-1 ring-amber-400',
                        dimmed && 'opacity-40',
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        onEventClick(row)
                      }}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', colors.accent)}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'truncate font-medium',
                          isCancelled && 'line-through decoration-slate-500/70',
                        )}
                      >
                        {fmtScheduleMinute(startMinute)} {row.studentName}
                      </span>
                    </button>
                  )
                })}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    className="truncate px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDayZoom(day)
                    }}
                  >
                    +{hiddenCount} more
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
