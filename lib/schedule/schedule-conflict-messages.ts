import { DAY_LABELS, fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'

export type ScheduleConflict =
  | { kind: 'session'; studentName: string; scheduledFor: string; durationMin: number }
  | {
      kind: 'weekly_slot'
      studentName: string
      dayOfWeek: number
      startMinute: number
      durationMinutes: number
      onDate?: string
    }

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export function formatScheduleConflictError(conflict: ScheduleConflict): string {
  if (conflict.kind === 'session') {
    const when = new Date(conflict.scheduledFor)
    const datePart = Number.isFinite(when.getTime())
      ? when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'that day'
    const timePart = Number.isFinite(when.getTime())
      ? fmtScheduleMinute(when.getHours() * 60 + when.getMinutes())
      : ''
    return `Overlaps with ${conflict.studentName}'s class on ${datePart} at ${timePart} (${conflict.durationMin} min).`
  }

  const dayName = DAY_NAMES[conflict.dayOfWeek] ?? DAY_LABELS[conflict.dayOfWeek] ?? 'that day'
  const timePart = fmtScheduleMinute(conflict.startMinute)

  if (conflict.onDate) {
    const parsed = new Date(`${conflict.onDate}T12:00:00`)
    const datePart = Number.isFinite(parsed.getTime())
      ? parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : conflict.onDate
    return `Overlaps with ${conflict.studentName}'s class on ${datePart} at ${timePart} (${conflict.durationMinutes} min, repeats weekly).`
  }

  return `Overlaps with ${conflict.studentName}'s weekly class every ${dayName} at ${timePart}.`
}
