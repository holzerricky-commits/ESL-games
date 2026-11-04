import { describe, expect, it } from 'vitest'
import {
  lessonAutoPrepKey,
  pickLessonsToAutoPrep,
  type LessonAutoPrepCandidate,
} from '@/lib/books/lesson-auto-prep'

const NOW = Date.parse('2026-10-10T12:00:00.000Z')
const HOUR = 60 * 60 * 1000

function candidate(overrides: Partial<LessonAutoPrepCandidate> = {}): LessonAutoPrepCandidate {
  return {
    sessionId: 's1',
    studentName: 'Anna',
    scheduledFor: new Date(NOW + 3 * HOUR).toISOString(),
    status: 'planned',
    bookId: 'b',
    unitId: 'u',
    lessonId: 'l1',
    ...overrides,
  }
}

describe('pickLessonsToAutoPrep', () => {
  it('picks planned and prepared classes inside the window, soonest first', () => {
    const picked = pickLessonsToAutoPrep(
      [
        candidate({ sessionId: 'later', lessonId: 'l2', scheduledFor: new Date(NOW + 20 * HOUR).toISOString() }),
        candidate({ sessionId: 'soon', lessonId: 'l1', status: 'prepared' }),
      ],
      NOW,
      {},
    )
    expect(picked.map((t) => t.lessonId)).toEqual(['l1', 'l2'])
  })

  it('skips past, far-off, live, and finished classes', () => {
    const picked = pickLessonsToAutoPrep(
      [
        candidate({ scheduledFor: new Date(NOW - HOUR).toISOString() }),
        candidate({ scheduledFor: new Date(NOW + 30 * HOUR).toISOString() }),
        candidate({ status: 'in_progress' }),
        candidate({ status: 'completed' }),
        candidate({ status: 'cancelled' }),
      ],
      NOW,
      {},
    )
    expect(picked).toEqual([])
  })

  it('keeps one entry per lesson, from the soonest class', () => {
    const picked = pickLessonsToAutoPrep(
      [
        candidate({ sessionId: 'b', studentName: 'Ben', scheduledFor: new Date(NOW + 5 * HOUR).toISOString() }),
        candidate({ sessionId: 'a', studentName: 'Anna', scheduledFor: new Date(NOW + 2 * HOUR).toISOString() }),
      ],
      NOW,
      {},
    )
    expect(picked).toHaveLength(1)
    expect(picked[0]?.studentName).toBe('Anna')
  })

  it('waits before retrying a lesson tried recently', () => {
    const key = lessonAutoPrepKey('b', 'u', 'l1')
    expect(pickLessonsToAutoPrep([candidate()], NOW, { [key]: NOW - HOUR })).toEqual([])
    expect(pickLessonsToAutoPrep([candidate()], NOW, { [key]: NOW - 7 * HOUR })).toHaveLength(1)
  })
})
