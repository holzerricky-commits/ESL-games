/** Pure helpers for the Move class flow (chips + urgency). */

import { normalizeClassDurationMinutes } from '@/lib/schedule/class-duration'

export const MOVE_CLASS_URGENT_WITHIN_MINUTES = 15
export const MOVE_CLASS_PLUS_MINUTES = 30

export type MoveClassTarget = {
  targetDay: Date
  startMinute: number
  durationMinutes: number
}

export function normalizeMoveDuration(durationMin: number): number {
  return normalizeClassDurationMinutes(durationMin, 30)
}

export function snapScheduleStartMinute(startMinute: number): number {
  const n = Math.floor(Number(startMinute))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(23 * 60 + 30, Math.floor(n / 30) * 30))
}

export function startMinuteFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function dateFromLocalDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const date = new Date(y, mo - 1, d)
  if (!Number.isFinite(date.getTime())) return null
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

export function canMoveClassSessionStatus(status: string): boolean {
  return status === 'planned' || status === 'prepared' || status === 'in_progress' || status === 'missed'
}

/** Live sessions always emphasize chips; otherwise within the pre-start window. */
export function isMoveClassUrgent(
  scheduledForIso: string,
  nowMs: number = Date.now(),
  windowMinutes: number = MOVE_CLASS_URGENT_WITHIN_MINUTES,
  status?: string,
): boolean {
  if (status === 'in_progress') return true
  const startMs = new Date(scheduledForIso).getTime()
  if (!Number.isFinite(startMs)) return false
  const delta = startMs - nowMs
  return delta <= windowMinutes * 60_000
}

function parseScheduledStart(scheduledForIso: string): Date | null {
  const d = new Date(scheduledForIso)
  return Number.isFinite(d.getTime()) ? d : null
}

export function computePlusMinutesMoveTarget(args: {
  scheduledForIso: string
  durationMin: number
  addMinutes?: number
}): { ok: true; target: MoveClassTarget } | { ok: false; error: string } {
  const start = parseScheduledStart(args.scheduledForIso)
  if (!start) return { ok: false, error: 'Invalid class time.' }
  const add = args.addMinutes ?? MOVE_CLASS_PLUS_MINUTES
  if (!Number.isFinite(add) || add <= 0) return { ok: false, error: 'Invalid delay.' }

  const shifted = new Date(start.getTime() + add * 60_000)
  const startMinute = snapScheduleStartMinute(startMinuteFromDate(shifted))
  const targetDay = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate())

  return {
    ok: true,
    target: {
      targetDay,
      startMinute,
      durationMinutes: normalizeMoveDuration(args.durationMin),
    },
  }
}

export function computeTomorrowSameTimeMoveTarget(args: {
  scheduledForIso: string
  durationMin: number
}): { ok: true; target: MoveClassTarget } | { ok: false; error: string } {
  const start = parseScheduledStart(args.scheduledForIso)
  if (!start) return { ok: false, error: 'Invalid class time.' }

  const targetDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  const startMinute = snapScheduleStartMinute(startMinuteFromDate(start))

  return {
    ok: true,
    target: {
      targetDay,
      startMinute,
      durationMinutes: normalizeMoveDuration(args.durationMin),
    },
  }
}
