/**
 * Soft auto-start and shared schedule-lifecycle knobs (grace / extend / later Missed).
 */

import type { StudentClassSession } from '@/lib/types'
import { computeClassEffectiveEndMs } from '@/lib/students/class-session-timer'

/** Minutes after effective end before Missed / hard auto-end (Phase 3–5). */
export const CLASS_SCHEDULE_GRACE_MINUTES = 5

/** Max minutes past original scheduled end (`scheduledFor + durationMin`). */
export const CLASS_MAX_OVERTIME_MINUTES = 15

export const CLASS_EXTEND_CHIP_MINUTES = [2, 5, 10] as const

export type ClassExtendChipMinutes = (typeof CLASS_EXTEND_CHIP_MINUTES)[number]

export type ClassLiveClockPhase = 'active' | 'grace' | 'must_end'

export type ClassSessionAutoStartFields = Pick<
  StudentClassSession,
  'id' | 'status' | 'scheduledFor' | 'durationMin'
> & {
  extendedMinutesTotal?: number
}

export function sanitizeExtendedMinutesTotal(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  const n = Math.floor(raw)
  if (n <= 0) return undefined
  return Math.min(CLASS_MAX_OVERTIME_MINUTES, n)
}

export function remainingClassExtendBudgetMinutes(extendedMinutesTotal: number = 0): number {
  const used =
    Number.isFinite(extendedMinutesTotal) && extendedMinutesTotal > 0
      ? Math.floor(extendedMinutesTotal)
      : 0
  return Math.max(0, CLASS_MAX_OVERTIME_MINUTES - used)
}

export function canExtendClassBy(
  extendedMinutesTotal: number | undefined,
  addMinutes: number,
): boolean {
  if (!Number.isFinite(addMinutes) || addMinutes <= 0) return false
  return addMinutes <= remainingClassExtendBudgetMinutes(extendedMinutesTotal ?? 0)
}

/**
 * Live clock band relative to effective end (includes extends) and grace.
 * `must_end` is informational in Phase 3 — hard auto-end is Phase 4.
 */
export function computeClassLiveClockPhase(
  scheduledFor: string | null | undefined,
  durationMin: number,
  nowMs: number,
  extendedMinutesTotal: number = 0,
  graceMinutes: number = CLASS_SCHEDULE_GRACE_MINUTES,
): ClassLiveClockPhase | 'muted' {
  const endMs = computeClassEffectiveEndMs(scheduledFor, durationMin, extendedMinutesTotal)
  if (endMs == null) return 'muted'
  if (nowMs < endMs) return 'active'
  const graceMs = Math.max(0, graceMinutes) * 60_000
  if (nowMs < endMs + graceMs) return 'grace'
  return 'must_end'
}

/** Live session past effective end + grace → hard auto-end (Phase 4). */
export function isSessionDueForHardAutoEnd(
  session: ClassSessionAutoStartFields & { status: string },
  nowMs: number,
  graceMinutes: number = CLASS_SCHEDULE_GRACE_MINUTES,
): boolean {
  if (session.status !== 'in_progress') return false
  return (
    computeClassLiveClockPhase(
      session.scheduledFor,
      session.durationMin,
      nowMs,
      session.extendedMinutesTotal ?? 0,
      graceMinutes,
    ) === 'must_end'
  )
}

/** Planned/prepared past end+grace → Missed (Phase 5). */
export function isSessionDueForMissed(
  session: ClassSessionAutoStartFields & { status: string },
  nowMs: number,
  graceMinutes: number = CLASS_SCHEDULE_GRACE_MINUTES,
): boolean {
  if (session.status !== 'planned' && session.status !== 'prepared') return false
  const endMs = computeClassEffectiveEndMs(
    session.scheduledFor,
    session.durationMin,
    session.extendedMinutesTotal ?? 0,
  )
  if (endMs == null) return false
  return nowMs >= endMs + Math.max(0, graceMinutes) * 60_000
}

export function isSessionEligibleForSoftAutoStart(
  session: ClassSessionAutoStartFields,
  nowMs: number,
  graceMinutes: number = CLASS_SCHEDULE_GRACE_MINUTES,
): boolean {
  if (session.status !== 'planned' && session.status !== 'prepared') return false
  const startMs = new Date(session.scheduledFor).getTime()
  if (!Number.isFinite(startMs) || nowMs < startMs) return false
  const endMs = computeClassEffectiveEndMs(
    session.scheduledFor,
    session.durationMin,
    session.extendedMinutesTotal ?? 0,
  )
  if (endMs == null) return false
  const graceMs = Math.max(0, graceMinutes) * 60_000
  return nowMs < endMs + graceMs
}

/** Same window as the floating “starting soon” reminder (Phase 6). Enter replaces Prepare. */
export const CLASS_STARTING_SOON_MINUTES = 20

/** Show “In Xh Ymin” under the row action when start is within this window. */
export const CLASS_COUNTDOWN_WITHIN_HOURS = 24

/** Warn during grace when the next student starts within this many minutes. */
export const CLASS_NEXT_STUDENT_SOON_MINUTES = 15

export type TodayClassTeachingState =
  | 'upcoming'
  | 'starting'
  | 'live'
  | 'grace'
  | 'ending'
  | 'done'
  | 'missed'
  | 'cancelled'

export type TodayClassPrimaryAction = 'start' | 'continue' | 'reschedule' | 'mark_taught' | 'none'

/** ClassIn-style door on lesson lists: Prepare vs Enter (live = Continue). */
export type ClassEntryAction = 'prepare' | 'enter' | 'continue' | 'reschedule' | 'none'

/**
 * Primary list action from schedule proximity (not soft-auto-start).
 * Enter within ~20 min of start (or past start while still open); Prepare otherwise.
 */
export function resolveClassEntryAction(
  session: ClassSessionAutoStartFields & { status: string },
  nowMs: number = Date.now(),
): ClassEntryAction {
  if (session.status === 'cancelled') return 'none'
  if (session.status === 'completed') return 'none'
  if (session.status === 'missed') return 'reschedule'
  if (session.status === 'in_progress') return 'continue'
  if (session.status !== 'planned' && session.status !== 'prepared') return 'none'

  const startMs = new Date(session.scheduledFor).getTime()
  if (!Number.isFinite(startMs)) return 'prepare'
  const enterFromMs = startMs - CLASS_STARTING_SOON_MINUTES * 60_000
  if (nowMs >= enterFromMs) return 'enter'
  return 'prepare'
}

export function classEntryActionLabel(action: ClassEntryAction): string {
  switch (action) {
    case 'prepare':
      return 'Prepare'
    case 'enter':
      return 'Enter'
    case 'continue':
      return 'Enter'
    case 'reschedule':
      return 'Reschedule'
    case 'none':
      return ''
  }
}

/**
 * ClassIn-style countdown under the action (“In 12min” / “In 25h 27min”).
 * Null when start is more than 24h away, already past, or invalid.
 */
export function formatClassCountdown(
  scheduledFor: string | null | undefined,
  nowMs: number = Date.now(),
  withinHours: number = CLASS_COUNTDOWN_WITHIN_HOURS,
): string | null {
  if (!scheduledFor) return null
  const startMs = new Date(scheduledFor).getTime()
  if (!Number.isFinite(startMs)) return null
  const delta = startMs - nowMs
  if (delta <= 0) return null
  const maxMs = Math.max(0, withinHours) * 3_600_000
  if (delta > maxMs) return null

  const totalMin = Math.max(1, Math.ceil(delta / 60_000))
  if (totalMin < 60) return `In ${totalMin}min`
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (mins === 0) return `In ${hours}h`
  return `In ${hours}h ${mins}min`
}

export function resolveTodayClassTeachingState(
  session: ClassSessionAutoStartFields & { status: string },
  nowMs: number = Date.now(),
): TodayClassTeachingState {
  if (session.status === 'cancelled') return 'cancelled'
  if (session.status === 'completed') return 'done'
  if (session.status === 'missed') return 'missed'
  if (session.status === 'in_progress') {
    const phase = computeClassLiveClockPhase(
      session.scheduledFor,
      session.durationMin,
      nowMs,
      session.extendedMinutesTotal ?? 0,
    )
    if (phase === 'must_end') return 'ending'
    if (phase === 'grace') return 'grace'
    return 'live'
  }
  if (session.status !== 'planned' && session.status !== 'prepared') return 'upcoming'

  const startMs = new Date(session.scheduledFor).getTime()
  if (!Number.isFinite(startMs)) return 'upcoming'
  if (nowMs >= startMs) {
    // Past start but not yet missed (still in slot / grace) — treat as starting so Start is obvious.
    return 'starting'
  }
  const soonMs = CLASS_STARTING_SOON_MINUTES * 60_000
  if (nowMs >= startMs - soonMs) return 'starting'
  return 'upcoming'
}

export function todayClassStateLabel(state: TodayClassTeachingState): string {
  switch (state) {
    case 'upcoming':
      return 'Upcoming'
    case 'starting':
      return 'Starting'
    case 'live':
      return 'Live'
    case 'grace':
      return 'Grace'
    case 'ending':
      return 'Ending'
    case 'done':
      return 'Done'
    case 'missed':
      return 'Missed'
    case 'cancelled':
      return 'Cancelled'
  }
}

export function todayClassPrimaryAction(state: TodayClassTeachingState): TodayClassPrimaryAction {
  switch (state) {
    case 'upcoming':
    case 'starting':
      return 'start'
    case 'live':
    case 'grace':
    case 'ending':
      return 'continue'
    case 'missed':
      return 'reschedule'
    case 'done':
    case 'cancelled':
      return 'none'
  }
}

export type NextStudentSoonInfo = {
  studentName: string
  minutesUntilStart: number
  sessionId: string
}

/**
 * While live/grace, find the next other student's class starting soon.
 */
export function findNextStudentSoon(
  rows: Array<{ studentId: string; studentName: string; session: ClassSessionAutoStartFields & { status: string } }>,
  liveSessionId: string,
  nowMs: number = Date.now(),
  withinMinutes: number = CLASS_NEXT_STUDENT_SOON_MINUTES,
): NextStudentSoonInfo | null {
  const live = rows.find((row) => row.session.id === liveSessionId)
  if (!live) return null

  let best: NextStudentSoonInfo | null = null
  let bestStartMs = Number.POSITIVE_INFINITY
  for (const row of rows) {
    if (row.session.id === liveSessionId) continue
    if (row.session.status !== 'planned' && row.session.status !== 'prepared') continue
    const startMs = new Date(row.session.scheduledFor).getTime()
    if (!Number.isFinite(startMs)) continue
    const delta = startMs - nowMs
    if (delta < 0 || delta > withinMinutes * 60_000) continue
    if (startMs >= bestStartMs) continue
    bestStartMs = startMs
    best = {
      studentName: row.studentName,
      minutesUntilStart: Math.max(1, Math.ceil(delta / 60_000)),
      sessionId: row.session.id,
    }
  }
  return best
}
