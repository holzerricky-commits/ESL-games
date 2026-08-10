'use client'

import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PX_PER_MINUTE,
  getSessionStatusColors,
  type ScheduleEventBlockLayout,
} from '@/lib/schedule/week-view-layout'
import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import type { TodaysClassSessionRow } from '@/lib/students/selectors'

interface ScheduleEventBlockProps {
  layout: ScheduleEventBlockLayout
  onClick: (row: TodaysClassSessionRow) => void
  ariaLabel: string
  dimmed?: boolean
  highlighted?: boolean
  draggable?: boolean
  isDraggingSource?: boolean
  isKeyboardAdjusted?: boolean
  keyboardHint?: string | null
  onPointerDownMove?: (event: React.PointerEvent<HTMLDivElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>, row: TodaysClassSessionRow) => void
}

export function ScheduleEventBlock({
  layout,
  onClick,
  ariaLabel,
  dimmed = false,
  highlighted = false,
  draggable = false,
  isDraggingSource = false,
  isKeyboardAdjusted = false,
  keyboardHint = null,
  onPointerDownMove,
  onKeyDown,
}: ScheduleEventBlockProps) {
  const { row, topPx, heightPx, laneIndex = 0, laneCount = 1 } = layout
  const colors = getSessionStatusColors(row.session.status)
  const start = new Date(row.session.scheduledFor)
  const timeLabel = Number.isFinite(start.getTime())
    ? fmtScheduleMinute(start.getHours() * 60 + start.getMinutes())
    : ''
  const durationLabel =
    typeof row.session.durationMin === 'number' ? `${row.session.durationMin}m` : null
  const isLive = row.session.status === 'in_progress'
  const isCancelled = row.session.status === 'cancelled'
  const isCompact = heightPx < 42
  const safeLaneCount = Math.max(1, laneCount)
  const safeLaneIndex = Math.min(Math.max(0, laneIndex), safeLaneCount - 1)
  const widthPct = 100 / safeLaneCount
  const leftPct = safeLaneIndex * widthPct

  return (
    <div
      data-schedule-event-block
      className={cn(
        'group absolute overflow-hidden rounded-lg border shadow-sm transition-[opacity,box-shadow,filter]',
        colors.bg,
        colors.border,
        isLive && 'ring-2 ring-amber-400',
        highlighted && 'ring-2 ring-amber-400 ring-offset-1',
        isKeyboardAdjusted && 'ring-2 ring-[var(--brand-blue)] ring-offset-1',
        dimmed && 'opacity-40',
        isDraggingSource && 'opacity-35',
        'hover:z-30 hover:shadow-md focus-within:z-30',
      )}
      style={{
        top: topPx,
        height: heightPx,
        minHeight: 24,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        zIndex: isDraggingSource ? 5 : 10 + safeLaneIndex,
      }}
    >
      <div className={cn('absolute inset-y-0 left-0 w-1', colors.accent)} aria-hidden />

      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape"
        className={cn(
          'relative flex h-full min-w-0 flex-col justify-center pl-2.5 pr-2 text-left',
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          'hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-blue)]',
        )}
        onClick={(e) => {
          e.stopPropagation()
          onClick(row)
        }}
        onKeyDown={(e) => {
          if (onKeyDown) {
            onKeyDown(e, row)
            if (e.defaultPrevented) return
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick(row)
          }
        }}
        onPointerDown={(e) => {
          if (!draggable || !onPointerDownMove) return
          if (e.button !== 0) return
          onPointerDownMove(e)
        }}
      >
        {draggable ? (
          <span
            className="pointer-events-none absolute left-1.5 top-0.5 opacity-0 transition-opacity group-hover:opacity-50 group-focus-within:opacity-50"
            aria-hidden
          >
            <GripVertical className="h-2.5 w-2.5 text-foreground" />
          </span>
        ) : null}

        {isCompact ? (
          <p className="truncate text-[11px] font-semibold leading-none text-foreground">
            <span className={cn(isCancelled && 'line-through decoration-slate-500/70')}>
              {row.studentName}
            </span>
            {timeLabel ? (
              <span className="font-normal text-muted-foreground"> · {timeLabel}</span>
            ) : null}
            {isLive ? <span className="font-medium text-amber-700"> · Live</span> : null}
          </p>
        ) : (
          <div className="min-w-0 leading-tight">
            <p
              className={cn(
                'truncate text-xs font-semibold text-foreground',
                isCancelled && 'line-through decoration-slate-500/70',
              )}
            >
              {row.studentName}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {timeLabel}
              {durationLabel ? ` · ${durationLabel}` : null}
              {isLive ? ' · Live' : null}
            </p>
            {keyboardHint ? (
              <p className="mt-0.5 truncate text-[10px] font-medium text-[var(--brand-blue)]">
                {keyboardHint}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

interface ScheduleEventGhostProps {
  studentName: string
  status: string
  topPx: number
  heightPx: number
  valid: boolean
  label?: string
}

export function ScheduleEventGhost({
  studentName,
  status,
  topPx,
  heightPx,
  valid,
  label,
}: ScheduleEventGhostProps) {
  const colors = getSessionStatusColors(status)
  const isCompact = heightPx < 42
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-1 right-1 z-30 overflow-hidden rounded-lg border-2 border-dashed shadow-md',
        valid ? cn(colors.bg, colors.border) : 'border-[var(--brand-red)] bg-[var(--brand-red)]/10',
      )}
      style={{ top: topPx, height: heightPx, minHeight: 24 }}
      aria-hidden
    >
      <div className={cn('absolute inset-y-0 left-0 w-1', valid ? colors.accent : 'bg-[var(--brand-red)]')} />
      <div className="flex h-full flex-col justify-center pl-2.5 pr-2 leading-tight">
        <p
          className={cn(
            'truncate font-semibold text-foreground',
            isCompact ? 'text-[11px] leading-none' : 'text-xs',
          )}
        >
          {studentName}
        </p>
        {!isCompact ? (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {label ?? (valid ? 'Drop to update weekly time' : 'Time not available')}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { PX_PER_MINUTE }
