import { describe, expect, it } from 'vitest'
import {
  formatTodaysClassWhen,
  listTodaysClassLessonParts,
  todaysClassPartKindLabel,
  todaysClassPlaceLine,
} from '@/lib/students/todays-class-desk'

describe('todays-class-desk', () => {
  it('formatTodaysClassWhen joins time and length', () => {
    expect(formatTodaysClassWhen('2026-08-19T16:00:00.000Z', 50)).toMatch(/50 min/)
    expect(formatTodaysClassWhen(null, 30)).toBe('30 min')
    expect(formatTodaysClassWhen('not-a-date', null)).toBeNull()
  })

  it('todaysClassPlaceLine hides empty bits', () => {
    expect(todaysClassPlaceLine({ bookTitle: 'Journeys', unitLabel: 'Unit 3', lessonLabel: 'Jump!' })).toEqual({
      title: 'Journeys',
      meta: 'Unit 3 · Jump!',
    })
    expect(todaysClassPlaceLine({ bookTitle: '  ', unitLabel: null, lessonLabel: '' })).toEqual({
      title: null,
      meta: null,
    })
  })

  it('listTodaysClassLessonParts returns siblings in the same lesson', () => {
    const options = [
      { id: 'p1', bookId: 'b', unitId: 'u', lessonId: 'l1' },
      { id: 'p2', bookId: 'b', unitId: 'u', lessonId: 'l1' },
      { id: 'p3', bookId: 'b', unitId: 'u', lessonId: 'l2' },
    ]
    expect(listTodaysClassLessonParts(options, options[1]).map((row) => row.id)).toEqual(['p1', 'p2'])
  })

  it('listTodaysClassLessonParts is empty without a start piece', () => {
    expect(listTodaysClassLessonParts([{ id: 'p1', bookId: 'b', unitId: 'u', lessonId: 'l1' }], null)).toEqual([])
  })

  it('todaysClassPartKindLabel hides unspecified', () => {
    expect(todaysClassPartKindLabel('main_story')).toBe('Story')
    expect(todaysClassPartKindLabel('unspecified')).toBeNull()
  })
})
