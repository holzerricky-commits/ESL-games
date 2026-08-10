'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  PX_PER_MINUTE,
  SNAP_MINUTES,
  assignOverlapLanes,
  durationToHeightPx,
  formatDayColumnHeader,
  gridHeightPx,
  hourLabelsForRange,
  isScheduleGridSlotOccupied,
  minuteToTopPx,
  nowLineTopPx,
  sessionToBlockLayout,
  snapMinuteFromClick,
  isSameLocalDay,
  type ScheduleEventBlockLayout,
} from '@/lib/schedule/week-view-layout'
import {
  ScheduleEventBlock,
  ScheduleEventGhost,
} from '@/components/schedule/schedule-event-block'
import {
  canDragScheduleEvent,
  useScheduleEventDrag,
  type OneOffScheduleReschedule,
} from '@/components/schedule/use-schedule-event-drag'
import { formatClassSessionAriaLabel, formatDayColumnAriaLabel } from '@/lib/schedule/schedule-a11y-labels'
import {
  keyboardMoveChanged,
  nudgeKeyboardMove,
  type KeyboardMoveState,
} from '@/lib/schedule/schedule-keyboard-move'
import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import {
  updateOneOffClassSession,
  validateSingleOccurrenceReschedule,
} from '@/lib/students/selectors'
import { normalizeClassDurationMinutes } from '@/lib/schedule/class-duration'
import type { TeacherWeeklyScheduleConfig } from '@/lib/types'
import type { TodaysClassSessionRow } from '@/lib/students/selectors'

interface ScheduleTimeGridProps {
  weekDays: Date[]
  config: TeacherWeeklyScheduleConfig
  sessions: TodaysClassSessionRow[]
  onEmptyClick: (date: Date, startMinute: number) => void
  onEventClick: (row: TodaysClassSessionRow) => void
  onPendingRecurringChange: (change: import('@/lib/schedule/recurring-change-types').PendingRecurringScheduleChange) => void
  onAnnounce?: (message: string) => void
  highlightStudentId?: string | null
  focusedDay?: Date | null
  onClearFocusedDay?: () => void
}

function sessionDurationMinutes(durationMin: number): number {
  return normalizeClassDurationMinutes(durationMin, 30)
}

function canKeyboardMoveEvent(layout: ScheduleEventBlockLayout): boolean {
  if (layout.row.session.status === 'in_progress') return false
  if (layout.row.session.status === 'completed' || layout.row.session.status === 'cancelled') {
    return false
  }
  return true
}

function originForLayout(layout: ScheduleEventBlockLayout): {
  dayIndex: number
  startMinute: number
  durationMinutes: number
} {
  const when = new Date(layout.row.session.scheduledFor)
  const startMinute = Number.isFinite(when.getTime())
    ? when.getHours() * 60 + when.getMinutes()
    : layout.topPx / PX_PER_MINUTE + 0
  return {
    dayIndex: layout.dayIndex,
    startMinute,
    durationMinutes: sessionDurationMinutes(layout.row.session.durationMin),
  }
}

export function ScheduleTimeGrid({
  weekDays,
  config,
  sessions,
  onEmptyClick,
  onEventClick,
  onPendingRecurringChange,
  onAnnounce,
  highlightStudentId,
  focusedDay = null,
  onClearFocusedDay,
}: ScheduleTimeGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const heightPx = gridHeightPx(config, PX_PER_MINUTE)
  const hourLabels = hourLabelsForRange(config.startMinute, config.endMinute)
  const nowTop = nowLineTopPx(config, PX_PER_MINUTE)
  const todayIndex = weekDays.findIndex((day) => formatDayColumnHeader(day).isToday)
  const [keyboardMove, setKeyboardMove] = useState<KeyboardMoveState | null>(null)
  const [emptyHover, setEmptyHover] = useState<{ dayIndex: number; startMinute: number } | null>(
    null,
  )

  const handleOneOffReschedule = useCallback(
    (change: OneOffScheduleReschedule) => {
      const result = updateOneOffClassSession(
        change.studentId,
        change.sessionId,
        change.targetDate,
        change.startMinute,
        change.durationMinutes,
      )
      if (!result.ok) {
        toast.error(result.error)
        onAnnounce?.(result.error)
        return
      }
      onAnnounce?.(`${change.studentName} moved.`)
    },
    [onAnnounce],
  )

  const {
    columnsAreaRef,
    setColumnRef,
    preview,
    beginDrag,
    shouldSuppressClick,
    isDragging,
  } = useScheduleEventDrag({
    weekDays,
    config,
    onPendingRecurringChange,
    onOneOffReschedule: handleOneOffReschedule,
  })

  useEffect(() => {
    if (isDragging) setEmptyHover(null)
  }, [isDragging])

  useEffect(() => {
    if (!focusedDay) return
    const column = columnsAreaRef.current?.querySelector('[data-schedule-day-focused="true"]')
    column?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [focusedDay, weekDays])

  const blocks = useMemo(() => {
    const layouts: ScheduleEventBlockLayout[] = []
    for (const row of sessions) {
      const layout = sessionToBlockLayout(row, weekDays, config, PX_PER_MINUTE)
      if (layout) layouts.push(layout)
    }
    return assignOverlapLanes(layouts)
  }, [sessions, weekDays, config])

  const blockBySessionId = useMemo(() => {
    const map = new Map<string, ScheduleEventBlockLayout>()
    for (const block of blocks) {
      map.set(block.row.session.id, block)
    }
    return map
  }, [blocks])

  const displayLayoutForBlock = useCallback(
    (block: ScheduleEventBlockLayout): ScheduleEventBlockLayout => {
      if (!keyboardMove || keyboardMove.sessionId !== block.row.session.id) return block
      return {
        ...block,
        dayIndex: keyboardMove.dayIndex,
        topPx: minuteToTopPx(keyboardMove.startMinute, config.startMinute, PX_PER_MINUTE),
        heightPx: durationToHeightPx(keyboardMove.durationMinutes, PX_PER_MINUTE),
      }
    },
    [keyboardMove, config.startMinute],
  )

  const keyboardPreviewValid = useMemo(() => {
    if (!keyboardMove) return true
    const block = blockBySessionId.get(keyboardMove.sessionId)
    if (!block) return true
    const targetDate = weekDays[keyboardMove.dayIndex]
    if (!targetDate) return false
    return validateSingleOccurrenceReschedule(
      block.row.studentId,
      block.row.session.id,
      targetDate,
      keyboardMove.startMinute,
      keyboardMove.durationMinutes,
    ).ok
  }, [keyboardMove, blockBySessionId, weekDays])

  function isWorkingDay(date: Date): boolean {
    return config.workingDays.includes(date.getDay())
  }

  function handleColumnClick(date: Date, event: React.MouseEvent<HTMLDivElement>) {
    if (shouldSuppressClick()) return
    if (isDragging) return
    if ((event.target as HTMLElement).closest('[data-schedule-event-block]')) return
    if (!isWorkingDay(date)) {
      toast.message('Unavailable that day')
      onAnnounce?.(
        `${date.toLocaleDateString('en-US', { weekday: 'long' })} is unavailable. Open Working hours to change days.`,
      )
      return
    }
    const column = event.currentTarget
    const rect = column.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const startMinute = snapMinuteFromClick(offsetY, PX_PER_MINUTE, config.startMinute, config.endMinute)
    const dayIndex = weekDays.findIndex((day) => isSameLocalDay(day, date))
    if (
      dayIndex >= 0 &&
      isScheduleGridSlotOccupied(dayIndex, startMinute, blocks, SNAP_MINUTES)
    ) {
      toast.message('That time is already booked')
      onAnnounce?.('That time already has a class.')
      return
    }
    onEmptyClick(date, startMinute)
  }

  function handleColumnMouseMove(dayIndex: number, date: Date, event: React.MouseEvent<HTMLDivElement>) {
    if (isDragging) return
    if (!isWorkingDay(date)) {
      setEmptyHover(null)
      return
    }
    if ((event.target as HTMLElement).closest('[data-schedule-event-block]')) {
      setEmptyHover(null)
      return
    }
    const column = event.currentTarget
    const rect = column.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const startMinute = snapMinuteFromClick(offsetY, PX_PER_MINUTE, config.startMinute, config.endMinute)
    if (isScheduleGridSlotOccupied(dayIndex, startMinute, blocks, SNAP_MINUTES)) {
      setEmptyHover(null)
      return
    }
    setEmptyHover((prev) => {
      if (prev && prev.dayIndex === dayIndex && prev.startMinute === startMinute) return prev
      return { dayIndex, startMinute }
    })
  }

  function handleColumnMouseLeave() {
    setEmptyHover(null)
  }

  function handleColumnKeyDown(date: Date, event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (!isWorkingDay(date)) {
      toast.message('Unavailable that day')
      onAnnounce?.(
        `${date.toLocaleDateString('en-US', { weekday: 'long' })} is unavailable. Open Working hours to change days.`,
      )
      return
    }
    const dayIndex = weekDays.findIndex((day) => isSameLocalDay(day, date))
    if (
      dayIndex >= 0 &&
      isScheduleGridSlotOccupied(dayIndex, config.startMinute, blocks, SNAP_MINUTES)
    ) {
      toast.message('That time is already booked')
      onAnnounce?.('That time already has a class.')
      return
    }
    onEmptyClick(date, config.startMinute)
  }

  function handleEventClick(row: TodaysClassSessionRow) {
    if (shouldSuppressClick()) return
    onEventClick(row)
  }

  function commitKeyboardMove(row: TodaysClassSessionRow, move: KeyboardMoveState) {
    const targetDate = weekDays[move.dayIndex]
    if (!targetDate) {
      onAnnounce?.('Could not save move.')
      return
    }

    const validated = validateSingleOccurrenceReschedule(
      row.studentId,
      row.session.id,
      targetDate,
      move.startMinute,
      move.durationMinutes,
    )
    if (!validated.ok) {
      toast.error(validated.error)
      onAnnounce?.(validated.error)
      return
    }

    const slotId = row.session.sourceSlotId?.trim()
    if (slotId) {
      onPendingRecurringChange({
        studentId: row.studentId,
        studentName: row.studentName,
        sessionId: row.session.id,
        slotId,
        targetDate,
        startMinute: move.startMinute,
        durationMinutes: move.durationMinutes,
        dayOfWeek: targetDate.getDay(),
      })
      setKeyboardMove(null)
      onAnnounce?.('Choose whether to update only this class or every week.')
      return
    }

    const result = updateOneOffClassSession(
      row.studentId,
      row.session.id,
      targetDate,
      move.startMinute,
      move.durationMinutes,
    )
    if (!result.ok) {
      toast.error(result.error)
      onAnnounce?.(result.error)
      return
    }
    setKeyboardMove(null)
    onAnnounce?.('Class updated.')
  }

  function handleEventKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
    row: TodaysClassSessionRow,
  ) {
    const block = blockBySessionId.get(row.session.id)
    if (!block) return
    const origin = originForLayout(block)
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const

    if (event.key === 'Escape') {
      if (keyboardMove?.sessionId === row.session.id) {
        event.preventDefault()
        setKeyboardMove(null)
        onAnnounce?.('Move cancelled.')
      }
      return
    }

    if (event.key === 'Enter') {
      const move =
        keyboardMove?.sessionId === row.session.id
          ? keyboardMove
          : null
      if (move && keyboardMoveChanged(move, origin)) {
        event.preventDefault()
        if (!keyboardPreviewValid) {
          onAnnounce?.('That time is not available.')
          return
        }
        commitKeyboardMove(row, move)
      }
      return
    }

    if (!arrowKeys.includes(event.key as (typeof arrowKeys)[number])) return
    if (!canKeyboardMoveEvent(block)) return

    event.preventDefault()
    onClearFocusedDay?.()
    setKeyboardMove((prev) => {
      const base =
        prev?.sessionId === row.session.id
          ? prev
          : {
              sessionId: row.session.id,
              dayIndex: origin.dayIndex,
              startMinute: origin.startMinute,
              durationMinutes: origin.durationMinutes,
            }
      const next = nudgeKeyboardMove(base, event.key as (typeof arrowKeys)[number], {
        minDayIndex: 0,
        maxDayIndex: weekDays.length - 1,
        startMinute: config.startMinute,
        endMinute: config.endMinute,
      })
      const targetDate = weekDays[next.dayIndex]
      if (targetDate) {
        const validated = validateSingleOccurrenceReschedule(
          row.studentId,
          row.session.id,
          targetDate,
          next.startMinute,
          next.durationMinutes,
        )
        onAnnounce?.(
          validated.ok
            ? `${row.studentName} moved to ${targetDate.toLocaleDateString('en-US', { weekday: 'long' })} at ${fmtScheduleMinute(next.startMinute)}. Press Enter to save.`
            : validated.error,
        )
      }
      return next
    })
  }

  function startDrag(
    layout: ScheduleEventBlockLayout,
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    setKeyboardMove(null)
    const started = beginDrag({
      layout,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      blockTopPx: layout.topPx,
    })
    if (started) {
      onClearFocusedDay?.()
      // Don't preventDefault — that blocks the click that opens edit on a short press.
      event.stopPropagation()
    }
  }

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]"
      aria-label="Weekly schedule"
    >
      <div className="min-w-[760px]">
        <div className="grid border-b border-[var(--border)]" style={{ gridTemplateColumns: '4rem repeat(7, 1fr)' }}>
          <div className="border-r border-[var(--border)] bg-[var(--surface-2)]" aria-hidden />
          {weekDays.map((day) => {
            const header = formatDayColumnHeader(day)
            const working = isWorkingDay(day)
            const isFocused = focusedDay != null && isSameLocalDay(day, focusedDay)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'border-r border-[var(--border)] px-2 py-2 text-center last:border-r-0',
                  working && (header.isToday ? 'bg-[var(--brand-blue)]/10' : 'bg-[var(--surface-2)]'),
                  !working && 'bg-muted/50',
                  isFocused && working && !header.isToday && 'bg-violet-500/10 ring-2 ring-inset ring-violet-400/60',
                )}
              >
                <p
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wide',
                    working ? 'text-muted-foreground' : 'text-muted-foreground/70',
                  )}
                >
                  {header.weekday}
                </p>
                <p
                  className={cn(
                    'mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                    working && header.isToday && 'bg-[var(--brand-blue)] text-white',
                    working && isFocused && !header.isToday && 'bg-violet-500/20 font-bold text-foreground',
                    !working && 'text-muted-foreground/70',
                  )}
                >
                  {header.dayNum}
                </p>
              </div>
            )
          })}
        </div>

        <div ref={gridRef} className="relative flex" style={{ minHeight: Math.max(heightPx, 480) }}>
          <div className="relative w-16 shrink-0 border-r border-[var(--border)] bg-[var(--surface-2)]" aria-hidden>
            {hourLabels.map(({ minute, label }) => (
              <div
                key={minute}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground"
                style={{ top: (minute - config.startMinute) * PX_PER_MINUTE }}
              >
                {label}
              </div>
            ))}
          </div>

          <div
            ref={columnsAreaRef}
            className="relative grid flex-1"
            style={{ gridTemplateColumns: 'repeat(7, 1fr)', height: heightPx }}
            role="grid"
            aria-label="Class times by day"
          >
            {weekDays.map((day, dayIndex) => {
              const header = formatDayColumnHeader(day)
              const working = isWorkingDay(day)
              const isFocused = focusedDay != null && isSameLocalDay(day, focusedDay)
              return (
              <div
                key={`col-${day.toISOString()}`}
                ref={(node) => setColumnRef(dayIndex, node)}
                data-schedule-day-column
                data-schedule-day-focused={isFocused ? 'true' : undefined}
                data-schedule-day-off={working ? undefined : 'true'}
                role="gridcell"
                tabIndex={0}
                aria-label={formatDayColumnAriaLabel(day, config.startMinute, config.endMinute, {
                  isWorkingDay: working,
                })}
                className={cn(
                  'relative border-r border-[var(--border)] last:border-r-0',
                  working && header.isToday && 'bg-[var(--brand-blue)]/[0.03]',
                  working && isFocused && !header.isToday && 'bg-violet-500/[0.06] ring-2 ring-inset ring-violet-400/50',
                  !working && 'bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(0,0,0,0.035)_6px,rgba(0,0,0,0.035)_12px)] bg-muted/30',
                  isDragging ? 'cursor-grabbing' : working ? 'cursor-pointer' : 'cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-blue)]',
                )}
                onClick={(e) => handleColumnClick(day, e)}
                onMouseMove={(e) => handleColumnMouseMove(dayIndex, day, e)}
                onMouseLeave={handleColumnMouseLeave}
                onKeyDown={(e) => handleColumnKeyDown(day, e)}
              >
                {working
                  ? hourLabels.map(({ minute }) => (
                      <div
                        key={`line-${minute}`}
                        className="pointer-events-none absolute inset-x-0 border-t border-[var(--border)]/60"
                        style={{ top: (minute - config.startMinute) * PX_PER_MINUTE }}
                      />
                    ))
                  : null}
                {working
                  ? hourLabels.map(({ minute }) => (
                      <div
                        key={`half-${minute}`}
                        className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--border)]/30"
                        style={{ top: (minute - config.startMinute + 30) * PX_PER_MINUTE }}
                      />
                    ))
                  : null}

                {emptyHover && emptyHover.dayIndex === dayIndex && !isDragging ? (
                  <div
                    className="pointer-events-none absolute inset-x-0.5 z-[1] flex items-start rounded-sm bg-[var(--brand-blue)]/12 px-1.5 py-0.5 ring-1 ring-inset ring-[var(--brand-blue)]/25"
                    style={{
                      top: minuteToTopPx(emptyHover.startMinute, config.startMinute, PX_PER_MINUTE),
                      height: SNAP_MINUTES * PX_PER_MINUTE,
                    }}
                    aria-hidden
                  >
                    <span className="truncate text-[10px] font-medium text-[var(--brand-blue)]/80">
                      {fmtScheduleMinute(emptyHover.startMinute)}
                    </span>
                  </div>
                ) : null}

                {todayIndex === dayIndex && nowTop != null ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: nowTop }}
                    aria-hidden
                  >
                    <div className="h-2 w-2 -translate-x-1 rounded-full bg-[var(--brand-red)]" />
                    <div className="h-0.5 flex-1 bg-[var(--brand-red)]" />
                  </div>
                ) : null}

                {blocks
                  .map((block) => displayLayoutForBlock(block))
                  .filter((block) => block.dayIndex === dayIndex)
                  .map((block) => {
                    const draggable = canDragScheduleEvent(block)
                    const isDraggingSource =
                      preview != null && block.row.session.id === preview.sessionId
                    const original = blockBySessionId.get(block.row.session.id)
                    const isKeyboardAdjusted =
                      keyboardMove?.sessionId === block.row.session.id &&
                      original != null &&
                      keyboardMoveChanged(keyboardMove, originForLayout(original))
                    const keyboardHint =
                      isKeyboardAdjusted && keyboardMove
                        ? keyboardPreviewValid
                          ? 'Enter to save'
                          : 'Time not available'
                        : null

                    return (
                      <ScheduleEventBlock
                        key={block.row.session.id}
                        layout={block}
                        ariaLabel={formatClassSessionAriaLabel(block.row)}
                        onClick={handleEventClick}
                        dimmed={
                          highlightStudentId != null && block.row.studentId !== highlightStudentId
                        }
                        highlighted={
                          highlightStudentId != null && block.row.studentId === highlightStudentId
                        }
                        draggable={draggable}
                        isDraggingSource={isDraggingSource}
                        isKeyboardAdjusted={isKeyboardAdjusted}
                        keyboardHint={keyboardHint}
                        onPointerDownMove={(e) => startDrag(block, e)}
                        onKeyDown={handleEventKeyDown}
                      />
                    )
                  })}

                {preview && preview.dayIndex === dayIndex ? (
                  <ScheduleEventGhost
                    studentName={preview.studentName}
                    status={preview.status}
                    topPx={minuteToTopPx(preview.startMinute, config.startMinute, PX_PER_MINUTE)}
                    heightPx={durationToHeightPx(preview.durationMinutes, PX_PER_MINUTE)}
                    valid={preview.valid}
                    label={
                      preview.valid
                        ? preview.slotId
                          ? 'Drop to update weekly time'
                          : 'Drop to move class'
                        : 'Time not available'
                    }
                  />
                ) : null}
              </div>
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}
