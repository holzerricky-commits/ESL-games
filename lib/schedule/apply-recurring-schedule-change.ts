import {
  rescheduleSingleClassOccurrence,
  updateWeeklySlotAssignment,
  validateWeeklySlotUpdate,
} from '@/lib/students/selectors'
import type { RecurringChangeScope, PendingRecurringScheduleChange } from '@/lib/schedule/recurring-change-types'

export function applyRecurringScheduleChange(
  change: PendingRecurringScheduleChange,
  scope: RecurringChangeScope,
): { ok: true } | { ok: false; error: string } {
  if (scope === 'occurrence') {
    return rescheduleSingleClassOccurrence(
      change.studentId,
      change.sessionId,
      change.targetDate,
      change.startMinute,
      change.durationMinutes,
    )
  }

  const validated = validateWeeklySlotUpdate(change.slotId, {
    dayOfWeek: change.dayOfWeek,
    startMinute: change.startMinute,
    durationMinutes: change.durationMinutes,
    studentId: change.studentId,
  })
  if (!validated.ok) return validated

  return updateWeeklySlotAssignment(change.slotId, {
    dayOfWeek: change.dayOfWeek,
    startMinute: change.startMinute,
    durationMinutes: change.durationMinutes,
    studentId: change.studentId,
  })
}
