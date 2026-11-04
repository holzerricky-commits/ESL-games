import {
  CLASS_STARTING_SOON_MINUTES,
  resolveTodayClassTeachingState,
  type TodayClassTeachingState,
} from '@/lib/students/class-schedule-lifecycle'
import {
  assignOverlapLanes,
  isSameLocalDay,
  type ScheduleEventBlockLayout,
} from '@/lib/schedule/week-view-layout'
import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import type { DashboardDaySessionRow } from '@/lib/students/selectors'

/** ~2px/min so a 30-minute class is about 60px tall. */
export const DASHBOARD_DAY_PX_PER_MINUTE = 2

/** Pad the clock above the first start and below the last end. */
export const DASHBOARD_DAY_PAD_MINUTES = 30

/** Empty-day fallback window (9:00–17:00 local). */
export const DASHBOARD_DAY_EMPTY_START_MINUTE = 9 * 60
export const DASHBOARD_DAY_EMPTY_END_MINUTE = 17 * 60

export type DashboardDayWindow = {
  startMinute: number
  endMinute: number
}

export type DashboardDayBlockLayout = ScheduleEventBlockLayout

type SessionClockFields = {
  scheduledFor: string
  durationMin: number
  status: string
  extendedMinutesTotal?: number
}

function sessionStartMinuteOfDay(scheduledFor: string): number | null {
  const d = new Date(scheduledFor)
  if (!Number.isFinite(d.getTime())) return null
  return d.getHours() * 60 + d.getMinutes()
}

function sessionEndMinuteOfDay(session: SessionClockFields): number | null {
  const start = sessionStartMinuteOfDay(session.scheduledFor)
  if (start == null) return null
  const duration = Math.max(0, Number.isFinite(session.durationMin) ? session.durationMin : 0)
  const extend =
    Number.isFinite(session.extendedMinutesTotal) && (session.extendedMinutesTotal ?? 0) > 0
      ? Math.floor(session.extendedMinutesTotal as number)
      : 0
  return start + duration + extend
}

/**
 * Crop the day clock to the classes: 30 minutes before the first start through
 * 30 minutes after the last end. Empty day falls back to a calm daytime window.
 */
export function computeDashboardDayWindow(
  sessions: ReadonlyArray<SessionClockFields>,
  padMinutes: number = DASHBOARD_DAY_PAD_MINUTES,
): DashboardDayWindow {
  let earliest: number | null = null
  let latest: number | null = null
  for (const session of sessions) {
    const start = sessionStartMinuteOfDay(session.scheduledFor)
    const end = sessionEndMinuteOfDay(session)
    if (start == null || end == null) continue
    earliest = earliest == null ? start : Math.min(earliest, start)
    latest = latest == null ? end : Math.max(latest, end)
  }
  if (earliest == null || latest == null) {
    return {
      startMinute: DASHBOARD_DAY_EMPTY_START_MINUTE,
      endMinute: DASHBOARD_DAY_EMPTY_END_MINUTE,
    }
  }
  const pad = Math.max(0, padMinutes)
  const startMinute = Math.max(0, earliest - pad)
  const endMinute = Math.min(24 * 60, Math.max(latest + pad, startMinute + 60))
  return { startMinute, endMinute }
}

export function dashboardDayGridHeightPx(
  window: DashboardDayWindow,
  pxPerMinute: number = DASHBOARD_DAY_PX_PER_MINUTE,
): number {
  return Math.max(0, (window.endMinute - window.startMinute) * pxPerMinute)
}

export function dashboardDayHourLabels(
  window: DashboardDayWindow,
): Array<{ minute: number; label: string; topPx: number }> {
  const out: Array<{ minute: number; label: string; topPx: number }> = []
  const firstHour = Math.ceil(window.startMinute / 60) * 60
  for (let minute = firstHour; minute < window.endMinute; minute += 60) {
    out.push({
      minute,
      label: fmtScheduleMinute(minute),
      topPx: (minute - window.startMinute) * DASHBOARD_DAY_PX_PER_MINUTE,
    })
  }
  return out
}

export function dashboardNowLineTopPx(
  window: DashboardDayWindow,
  nowMs: number = Date.now(),
  pxPerMinute: number = DASHBOARD_DAY_PX_PER_MINUTE,
): number | null {
  const now = new Date(nowMs)
  const minute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  if (minute < window.startMinute || minute > window.endMinute) return null
  return (minute - window.startMinute) * pxPerMinute
}

/**
 * Place each class by scheduled start on the day clock. Overlaps pack into lanes.
 */
export function layoutDashboardDayBlocks(
  rows: ReadonlyArray<DashboardDaySessionRow>,
  window: DashboardDayWindow,
  pxPerMinute: number = DASHBOARD_DAY_PX_PER_MINUTE,
): DashboardDayBlockLayout[] {
  const layouts: DashboardDayBlockLayout[] = []
  for (const row of rows) {
    const start = sessionStartMinuteOfDay(row.session.scheduledFor)
    if (start == null) continue
    const duration = Math.max(0, Number.isFinite(row.session.durationMin) ? row.session.durationMin : 0)
    const topPx = (start - window.startMinute) * pxPerMinute
    const heightPx = Math.max(duration * pxPerMinute, 28)
    layouts.push({
      row,
      topPx,
      heightPx,
      dayIndex: 0,
      laneIndex: 0,
      laneCount: 1,
    })
  }
  return assignOverlapLanes(layouts)
}

const LIVE_BAND: TodayClassTeachingState[] = ['ending', 'grace', 'live']

/**
 * Default selection for the day clock:
 * live → starting soon → next upcoming → last class of the day.
 * On a non-today day, first open class (else last).
 */
export function pickDashboardDaySelection(
  rows: ReadonlyArray<DashboardDaySessionRow>,
  selectedDay: Date,
  nowMs: number = Date.now(),
): DashboardDaySessionRow | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort(
    (a, b) => new Date(a.session.scheduledFor).getTime() - new Date(b.session.scheduledFor).getTime(),
  )
  const viewingToday = isSameLocalDay(selectedDay, new Date(nowMs))

  if (!viewingToday) {
    const open = sorted.find((row) => {
      const s = row.session.status
      return s === 'planned' || s === 'prepared' || s === 'in_progress' || s === 'missed'
    })
    return open ?? sorted[sorted.length - 1] ?? null
  }

  const withState = sorted.map((row) => ({
    row,
    state: resolveTodayClassTeachingState(row.session, nowMs),
    startMs: new Date(row.session.scheduledFor).getTime(),
  }))

  for (const state of LIVE_BAND) {
    const match = withState.find((item) => item.state === state)
    if (match) return match.row
  }

  const starting = withState
    .filter((item) => item.state === 'starting')
    .sort((a, b) => a.startMs - b.startMs)
  if (starting[0]) return starting[0].row

  const soonMs = CLASS_STARTING_SOON_MINUTES * 60_000
  const upcomingSoon = withState
    .filter(
      (item) =>
        item.state === 'upcoming' &&
        Number.isFinite(item.startMs) &&
        item.startMs >= nowMs &&
        item.startMs - nowMs <= soonMs,
    )
    .sort((a, b) => a.startMs - b.startMs)
  if (upcomingSoon[0]) return upcomingSoon[0].row

  const nextUpcoming = withState
    .filter(
      (item) =>
        (item.state === 'upcoming' || item.state === 'starting') &&
        Number.isFinite(item.startMs) &&
        item.startMs >= nowMs,
    )
    .sort((a, b) => a.startMs - b.startMs)
  if (nextUpcoming[0]) return nextUpcoming[0].row

  const openMissed = withState.find((item) => item.state === 'missed')
  if (openMissed) return openMissed.row

  return sorted[sorted.length - 1] ?? null
}

/** Next class after the selected day (for empty-day hint). */
export function findNextClassAfterDay(
  candidates: ReadonlyArray<DashboardDaySessionRow>,
  selectedDay: Date,
): DashboardDaySessionRow | null {
  const { endMs } = (() => {
    const start = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 0, 0, 0, 0)
    const end = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate() + 1, 0, 0, 0, 0)
    return { endMs: end.getTime(), startMs: start.getTime() }
  })()
  const upcoming = candidates
    .filter((row) => {
      const s = row.session.status
      if (s !== 'planned' && s !== 'prepared') return false
      const t = new Date(row.session.scheduledFor).getTime()
      return Number.isFinite(t) && t >= endMs
    })
    .sort((a, b) => new Date(a.session.scheduledFor).getTime() - new Date(b.session.scheduledFor).getTime())
  return upcoming[0] ?? null
}
