import type { TeacherWeeklyScheduleConfig } from '@/lib/types'
import type { TodaysClassSessionRow } from '@/lib/students/selectors'
import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import { snapDurationMinutes as snapToClassDurationPreset } from '@/lib/schedule/class-duration'

export const PX_PER_MINUTE = 1.2
export const SNAP_MINUTES = 30
export const WEEK_STARTS_ON = 1 as const // Monday

export type SessionStatusColor = {
  bg: string
  border: string
  accent: string
}

const UPCOMING_STATUS_COLORS: SessionStatusColor = {
  bg: 'bg-blue-500/15',
  border: 'border-blue-500/45',
  accent: 'bg-blue-500',
}

export const SESSION_STATUS_COLORS: Record<string, SessionStatusColor> = {
  planned: UPCOMING_STATUS_COLORS,
  prepared: UPCOMING_STATUS_COLORS,
  in_progress: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/55',
    accent: 'bg-amber-500',
  },
  completed: {
    bg: 'bg-slate-500/12',
    border: 'border-slate-400/40',
    accent: 'bg-slate-400',
  },
  cancelled: {
    bg: 'bg-slate-500/10',
    border: 'border-rose-400/35',
    accent: 'bg-slate-400',
  },
  missed: {
    bg: 'bg-rose-500/18',
    border: 'border-rose-500/50',
    accent: 'bg-rose-500',
  },
}

export function getSessionStatusColors(status: string): SessionStatusColor {
  return SESSION_STATUS_COLORS[status] ?? UPCOMING_STATUS_COLORS
}

export const SESSION_STATUS_LEGEND: ReadonlyArray<{
  key: string
  label: string
  colors: SessionStatusColor
}> = [
  { key: 'upcoming', label: 'Upcoming', colors: UPCOMING_STATUS_COLORS },
  { key: 'live', label: 'Live', colors: SESSION_STATUS_COLORS.in_progress },
  { key: 'completed', label: 'Completed', colors: SESSION_STATUS_COLORS.completed },
  { key: 'cancelled', label: 'Cancelled', colors: SESSION_STATUS_COLORS.cancelled },
  { key: 'missed', label: 'Missed', colors: SESSION_STATUS_COLORS.missed },
]

export function getWeekStart(date: Date, weekStartsOn: 0 | 1 = WEEK_STARTS_ON): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  const diff = (day - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return d
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + index)
    return d
  })
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
  const startFmt: Intl.DateTimeFormatOptions = sameMonth
    ? { month: 'long', day: 'numeric' }
    : { month: 'short', day: 'numeric' }
  const endFmt: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
  const start = weekStart.toLocaleDateString('en-US', startFmt)
  const end = weekEnd.toLocaleDateString('en-US', endFmt)
  return `${start} – ${end}`
}

export function formatDayColumnHeader(date: Date): { weekday: string; dayNum: string; isToday: boolean } {
  const today = new Date()
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: String(date.getDate()),
    isToday: isSameLocalDay(date, today),
  }
}

export interface ScheduleEventBlockLayout {
  row: TodaysClassSessionRow
  topPx: number
  heightPx: number
  dayIndex: number
  /** 0-based column within overlapping peers (default 0). */
  laneIndex: number
  /** How many lanes the overlap cluster uses (default 1 = full width). */
  laneCount: number
}

export function sessionToBlockLayout(
  row: TodaysClassSessionRow,
  weekDays: Date[],
  config: TeacherWeeklyScheduleConfig,
  pxPerMinute: number = PX_PER_MINUTE,
): ScheduleEventBlockLayout | null {
  const sessionDate = new Date(row.session.scheduledFor)
  if (!Number.isFinite(sessionDate.getTime())) return null
  const dayIndex = weekDays.findIndex((day) => isSameLocalDay(day, sessionDate))
  if (dayIndex < 0) return null
  const sessionStartMinute = sessionDate.getHours() * 60 + sessionDate.getMinutes()
  const topPx = (sessionStartMinute - config.startMinute) * pxPerMinute
  const heightPx = Math.max(row.session.durationMin * pxPerMinute, 24)
  return { row, topPx, heightPx, dayIndex, laneIndex: 0, laneCount: 1 }
}

function rangesOverlapPx(aTop: number, aBottom: number, bTop: number, bBottom: number): boolean {
  return aTop < bBottom && bTop < aBottom
}

/**
 * Pack overlapping blocks into side-by-side lanes per day so stacked classes stay clickable.
 */
export function assignOverlapLanes(layouts: ScheduleEventBlockLayout[]): ScheduleEventBlockLayout[] {
  if (layouts.length === 0) return layouts

  const byDay = new Map<number, ScheduleEventBlockLayout[]>()
  for (const layout of layouts) {
    const list = byDay.get(layout.dayIndex) ?? []
    list.push(layout)
    byDay.set(layout.dayIndex, list)
  }

  const out: ScheduleEventBlockLayout[] = []

  for (const dayLayouts of byDay.values()) {
    const sorted = [...dayLayouts].sort(
      (a, b) => a.topPx - b.topPx || b.heightPx - a.heightPx || a.row.session.id.localeCompare(b.row.session.id),
    )

    const laneEnds: number[] = []
    const withLanes = sorted.map((layout) => {
      const start = layout.topPx
      const end = layout.topPx + layout.heightPx
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start + 0.01)
      if (lane < 0) {
        lane = laneEnds.length
        laneEnds.push(end)
      } else {
        laneEnds[lane] = end
      }
      return { ...layout, laneIndex: lane, laneCount: 1 }
    })

    // Connected components by overlap → laneCount = max lane in component + 1
    const n = withLanes.length
    const parent = Array.from({ length: n }, (_, i) => i)
    const find = (i: number): number => {
      let root = i
      while (parent[root] !== root) root = parent[root]
      let cur = i
      while (parent[cur] !== root) {
        const next = parent[cur]
        parent[cur] = root
        cur = next
      }
      return root
    }
    const union = (a: number, b: number) => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent[rb] = ra
    }

    for (let i = 0; i < n; i += 1) {
      const a = withLanes[i]
      const aBottom = a.topPx + a.heightPx
      for (let j = i + 1; j < n; j += 1) {
        const b = withLanes[j]
        if (b.topPx >= aBottom) break
        if (rangesOverlapPx(a.topPx, aBottom, b.topPx, b.topPx + b.heightPx)) {
          union(i, j)
        }
      }
    }

    const clusterMaxLane = new Map<number, number>()
    for (let i = 0; i < n; i += 1) {
      const root = find(i)
      const prev = clusterMaxLane.get(root) ?? 0
      clusterMaxLane.set(root, Math.max(prev, withLanes[i].laneIndex))
    }

    for (let i = 0; i < n; i += 1) {
      const root = find(i)
      const laneCount = (clusterMaxLane.get(root) ?? 0) + 1
      out.push({ ...withLanes[i], laneCount })
    }
  }

  return out
}

export function snapMinuteFromClick(
  offsetY: number,
  pxPerMinute: number,
  startMinute: number,
  endMinute: number,
  durationMinutes: number = SNAP_MINUTES,
): number {
  const raw = startMinute + offsetY / pxPerMinute
  // Half-open cells: [T, T+30) maps to T. Tiny epsilon so exact line clicks land on that line.
  const snapped = Math.floor((raw + 1e-6) / SNAP_MINUTES) * SNAP_MINUTES
  const maxStart = endMinute - durationMinutes
  return Math.max(startMinute, Math.min(maxStart, snapped))
}

/** True when [aStart, aEnd) overlaps [bStart, bEnd). */
export function rangesOverlapMinutes(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Whether a half-hour (or other) empty-grid slot already has any class overlapping it.
 * Used to suppress empty-slot hover/create on taken times.
 */
export function isScheduleGridSlotOccupied(
  dayIndex: number,
  slotStartMinute: number,
  blocks: ScheduleEventBlockLayout[],
  slotDurationMinutes: number = SNAP_MINUTES,
): boolean {
  const slotEnd = slotStartMinute + slotDurationMinutes
  for (const block of blocks) {
    if (block.dayIndex !== dayIndex) continue
    const when = new Date(block.row.session.scheduledFor)
    if (!Number.isFinite(when.getTime())) continue
    const status = block.row.session.status
    if (status === 'cancelled' || status === 'missed') continue
    const start = when.getHours() * 60 + when.getMinutes()
    const end = start + Math.max(0, block.row.session.durationMin)
    if (rangesOverlapMinutes(slotStartMinute, slotEnd, start, end)) return true
  }
  return false
}

export function snapDurationMinutes(minutes: number): number {
  return snapToClassDurationPreset(minutes)
}

export function snapDurationFromHeightPx(
  heightPx: number,
  pxPerMinute: number = PX_PER_MINUTE,
): number {
  return snapDurationMinutes(heightPx / pxPerMinute)
}

export function minuteToTopPx(minute: number, configStartMinute: number, pxPerMinute: number = PX_PER_MINUTE): number {
  return (minute - configStartMinute) * pxPerMinute
}

export function durationToHeightPx(durationMin: number, pxPerMinute: number = PX_PER_MINUTE): number {
  return Math.max(durationMin * pxPerMinute, 24)
}

export function gridHeightPx(config: TeacherWeeklyScheduleConfig, pxPerMinute: number = PX_PER_MINUTE): number {
  return (config.endMinute - config.startMinute) * pxPerMinute
}

export function hourLabelsForRange(startMinute: number, endMinute: number): Array<{ minute: number; label: string }> {
  const out: Array<{ minute: number; label: string }> = []
  for (let minute = startMinute; minute < endMinute; minute += 60) {
    out.push({ minute, label: fmtScheduleMinute(minute) })
  }
  return out
}

export function recurringLabel(dayOfWeek: number, startMinute: number): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = dayNames[dayOfWeek] ?? 'Day'
  return `Repeats every ${dayName} at ${fmtScheduleMinute(startMinute)}`
}

export function dateInWeekForDayOfWeek(anchor: Date, dayOfWeek: number, weekStartsOn: 0 | 1 = WEEK_STARTS_ON): Date {
  const weekStart = getWeekStart(anchor, weekStartsOn)
  const days = getWeekDays(weekStart)
  return days.find((day) => day.getDay() === dayOfWeek) ?? anchor
}

export function sessionStartMinute(sessionDate: Date): number {
  return sessionDate.getHours() * 60 + sessionDate.getMinutes()
}

export function isSessionToday(sessionIso: string): boolean {
  const d = new Date(sessionIso)
  return Number.isFinite(d.getTime()) && isSameLocalDay(d, new Date())
}

export function nowLineTopPx(config: TeacherWeeklyScheduleConfig, pxPerMinute: number = PX_PER_MINUTE): number | null {
  const now = new Date()
  const minute = now.getHours() * 60 + now.getMinutes()
  if (minute < config.startMinute || minute >= config.endMinute) return null
  return (minute - config.startMinute) * pxPerMinute
}
