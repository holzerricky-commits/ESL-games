import { describe, expect, it } from 'vitest'
import { formatScheduleConflictError } from '@/lib/schedule/schedule-conflict-messages'

describe('schedule conflict messages', () => {
  it('formats session conflicts with student, date, and time', () => {
    const message = formatScheduleConflictError({
      kind: 'session',
      studentName: 'Lina',
      scheduledFor: new Date(2026, 6, 8, 15, 0, 0, 0).toISOString(),
      durationMin: 60,
    })
    expect(message).toContain('Lina')
    expect(message).toContain('60 min')
  })

  it('formats weekly pattern conflicts without a specific date', () => {
    const message = formatScheduleConflictError({
      kind: 'weekly_slot',
      studentName: 'Alex',
      dayOfWeek: 1,
      startMinute: 10 * 60,
      durationMinutes: 30,
    })
    expect(message).toContain('Alex')
    expect(message).toContain('weekly')
    expect(message).toContain('Monday')
  })
})
