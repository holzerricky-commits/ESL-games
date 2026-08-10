import { fmtScheduleMinute } from '@/lib/schedule/schedule-time-labels'
import type { TodaysClassSessionRow } from '@/lib/students/selectors'

const STATUS_LABELS: Record<string, string> = {
  planned: 'planned',
  prepared: 'prepared',
  in_progress: 'live now',
  completed: 'completed',
  cancelled: 'cancelled',
  missed: 'missed',
}

export function formatClassSessionAriaLabel(row: TodaysClassSessionRow): string {
  const when = new Date(row.session.scheduledFor)
  const weekday = Number.isFinite(when.getTime())
    ? when.toLocaleDateString('en-US', { weekday: 'long' })
    : 'Unknown day'
  const datePart = Number.isFinite(when.getTime())
    ? when.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : ''
  const timePart = Number.isFinite(when.getTime())
    ? fmtScheduleMinute(when.getHours() * 60 + when.getMinutes())
    : ''
  const status = STATUS_LABELS[row.session.status] ?? row.session.status
  const recurring = row.session.sourceSlotId?.trim() ? 'repeats weekly' : 'one-time class'
  return `${row.studentName}, ${weekday} ${datePart}, ${timePart}, ${row.session.durationMin} minutes, ${status}, ${recurring}`
}

export function formatDayColumnAriaLabel(
  date: Date,
  startMinute: number,
  endMinute: number,
  options?: { isWorkingDay?: boolean },
): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  if (options?.isWorkingDay === false) {
    return `${day} is a day off. Open Working hours to teach on this day.`
  }
  return `Add class on ${day} between ${fmtScheduleMinute(startMinute)} and ${fmtScheduleMinute(endMinute)}`
}
