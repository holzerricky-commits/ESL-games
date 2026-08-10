import { describe, expect, it } from 'vitest'
import {
  addMonths,
  formatMonthLabel,
  getMonthGridDays,
  getMonthStart,
  groupSessionsByDay,
  isDateInMonth,
  localDayKey,
} from '@/lib/schedule/month-view-layout'

describe('month view layout helpers', () => {
  it('getMonthGridDays includes padding days before and after the month', () => {
    const july2026 = new Date(2026, 6, 15)
    const days = getMonthGridDays(july2026)
    expect(days.length % 7).toBe(0)
    expect(days.length).toBeGreaterThanOrEqual(35)
    expect(isDateInMonth(days[0], july2026)).toBe(false)
    expect(days.some((day) => day.getDate() === 1 && day.getMonth() === 6)).toBe(true)
    expect(days.some((day) => day.getDate() === 31 && day.getMonth() === 6)).toBe(true)
  })

  it('formatMonthLabel and addMonths navigate calendar months', () => {
    const start = getMonthStart(new Date(2026, 6, 8))
    expect(formatMonthLabel(start)).toBe('July 2026')
    const next = addMonths(start, 1)
    expect(formatMonthLabel(next)).toBe('August 2026')
  })

  it('groupSessionsByDay buckets sessions by local date', () => {
    const day = new Date(2026, 6, 6, 10, 0, 0, 0)
    const map = groupSessionsByDay([
      {
        studentId: 's1',
        studentName: 'Alex',
        session: {
          id: 'c1',
          title: 'Alex class',
          scheduledFor: day.toISOString(),
          durationMin: 30,
          status: 'planned',
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
      },
    ])
    expect(map.get(localDayKey(day))?.length).toBe(1)
  })
})
