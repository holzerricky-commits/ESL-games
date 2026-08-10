import { describe, expect, it } from 'vitest'
import { formatClassSessionAriaLabel, formatDayColumnAriaLabel } from '@/lib/schedule/schedule-a11y-labels'

describe('schedule a11y labels', () => {
  it('formatClassSessionAriaLabel includes student, time, status, and recurrence', () => {
    const label = formatClassSessionAriaLabel({
      studentId: 's1',
      studentName: 'Lina',
      session: {
        id: 'c1',
        title: 'Lina class',
        scheduledFor: new Date(2026, 6, 7, 15, 0, 0, 0).toISOString(),
        durationMin: 60,
        status: 'planned',
        sourceSlotId: 'slot-1',
        goals: [],
        activities: [],
        plannedVocabulary: [],
        introducedWords: [],
        practicedWords: [],
        reviewedWords: [],
        learnedWords: [],
        createdAt: '',
        updatedAt: '',
      },
    })
    expect(label).toContain('Lina')
    expect(label).toContain('60 minutes')
    expect(label).toContain('planned')
    expect(label).toContain('repeats weekly')
  })

  it('formatDayColumnAriaLabel marks off days', () => {
    const day = new Date(2026, 6, 5)
    const off = formatDayColumnAriaLabel(day, 9 * 60, 17 * 60, { isWorkingDay: false })
    expect(off).toContain('day off')
    const on = formatDayColumnAriaLabel(day, 9 * 60, 17 * 60, { isWorkingDay: true })
    expect(on).toContain('Add class')
  })
})
