'use client'

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
        'group absolute overflow-hidden rounded-xl chrome-motion',
        colors.bg,
        isLive && 'bg-amber-500/30',
        highlighted && 'brightness-[1.06]',
        isKeyboardAdjusted && 'ring-1 ring-inset ring-[var(--brand-blue)]/45',
        dimmed && 'opacity-40',
        isDraggingSource && 'opacity-35',
        'hover:z-30 hover:brightness-[0.97] focus-within:z-30',
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
      <div className={cn('absolute inset-y-0.5 left-0.5 w-[3px] rounded-full', colors.accent)} aria-hidden />

      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape"
        className={cn(
          'relative flex h-full min-w-0 flex-col justify-center py-0.5 pl-2.5 pr-2 text-left',
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-blue)]/50',
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
        {isCompact ? (
          <p className="truncate text-[12px] font-semibold leading-none tracking-tight text-foreground">
            <span className={cn(isCancelled && 'line-through decoration-slate-500/70')}>
              {row.studentName}
            </span>
            {timeLabel ? (
              <span className="font-medium text-muted-foreground"> · {timeLabel}</span>
            ) : null}
            {isLive ? (
              <span className="font-semibold text-[color-mix(in_srgb,var(--brand-yellow)_80%,#1a1a18)]">
                {' '}
                · Live
              </span>
            ) : null}
          </p>
        ) : (
          <div className="min-w-0 leading-tight">
            <p
              className={cn(
                'truncate text-[13px] font-semibold tracking-tight text-foreground',
                isCancelled && 'line-through decoration-slate-500/70',
              )}
            >
              {row.studentName}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium tabular-nums text-muted-foreground">
              {timeLabel}
              {durationLabel ? ` · ${durationLabel}` : null}
              {isLive ? (
                <span className="font-semibold text-[color-mix(in_srgb,var(--brand-yellow)_80%,#1a1a18)]">
                  {' '}
                  · Live
                </span>
              ) : null}
            </p>
            {keyboardHint ? (
              <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--chrome-pill-active-fg)]">
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
        'pointer-events-none absolute left-1 right-1 z-30 overflow-hidden rounded-xl border border-dashed',
        valid ? cn(colors.bg, colors.border) : 'border-[var(--brand-red)]/50 bg-[var(--brand-red)]/10',
      )}
      style={{ top: topPx, height: heightPx, minHeight: 24 }}
      aria-hidden
    >
      <div className={cn('absolute inset-y-0.5 left-0.5 w-[3px] rounded-full', valid ? colors.accent : 'bg-[var(--brand-red)]')} />
      <div className="flex h-full flex-col justify-center py-0.5 pl-2.5 pr-2 leading-tight">
        <p
          className={cn(
            'truncate font-semibold tracking-tight text-foreground',
            isCompact ? 'text-[12px] leading-none' : 'text-[13px]',
          )}
        >
          {studentName}
        </p>
        {!isCompact ? (
          <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
            {label ?? (valid ? 'Drop to update weekly time' : 'Time not available')}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { PX_PER_MINUTE }
