import { describe, expect, it } from 'vitest'
import type { StudentClassSession } from '@/lib/types'
import {
  classroomHomeCompletedStreak,
  classroomHomeLastTime,
  classroomHomeShouldShowStreak,
} from '@/lib/students/classroom-home-continuity'

function session(
  overrides: Pick<StudentClassSession, 'id' | 'status'> & Partial<StudentClassSession>,
): StudentClassSession {
  return {
    title: overrides.id,
    scheduledFor: overrides.scheduledFor ?? '2026-08-01T10:00:00.000Z',
    durationMin: 30,
    goals: [],
    activities: [],
    plannedVocabulary: [],
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('classroomHomeCompletedStreak', () => {
  it('counts consecutive completed classes from the newest result', () => {
    expect(
      classroomHomeCompletedStreak([
        session({ id: 'a', status: 'completed', scheduledFor: '2026-08-01T10:00:00.000Z' }),
        session({ id: 'b', status: 'completed', scheduledFor: '2026-08-03T10:00:00.000Z' }),
        session({ id: 'c', status: 'completed', scheduledFor: '2026-08-05T10:00:00.000Z' }),
      ]),
    ).toBe(3)
  })

  it('breaks on missed or cancelled and ignores planned classes', () => {
    expect(
      classroomHomeCompletedStreak([
        session({ id: 'a', status: 'completed', scheduledFor: '2026-08-01T10:00:00.000Z' }),
        session({ id: 'miss', status: 'missed', scheduledFor: '2026-08-03T10:00:00.000Z' }),
        session({ id: 'b', status: 'completed', scheduledFor: '2026-08-05T10:00:00.000Z' }),
        session({ id: 'next', status: 'planned', scheduledFor: '2026-08-07T10:00:00.000Z' }),
      ]),
    ).toBe(1)
    expect(
      classroomHomeCompletedStreak([
        session({ id: 'a', status: 'completed', scheduledFor: '2026-08-01T10:00:00.000Z' }),
        session({ id: 'x', status: 'cancelled', scheduledFor: '2026-08-03T10:00:00.000Z' }),
      ]),
    ).toBe(0)
  })

  it('hides the chip until two completed classes', () => {
    expect(classroomHomeShouldShowStreak(0)).toBe(false)
    expect(classroomHomeShouldShowStreak(1)).toBe(false)
    expect(classroomHomeShouldShowStreak(2)).toBe(true)
  })
})

describe('classroomHomeLastTime', () => {
  it('uses the previous completed recap, not the current class, and caps review words', () => {
    expect(
      classroomHomeLastTime({
        currentSessionId: 'today',
        needsPracticeWords: ['apple', 'bread', 'rice', 'soup'],
        sessions: [
          session({
            id: 'old',
            status: 'completed',
            scheduledFor: '2026-08-01T10:00:00.000Z',
            classEndNote: 'We practiced food words.',
          }),
          session({
            id: 'today',
            status: 'planned',
            scheduledFor: '2026-08-08T10:00:00.000Z',
          }),
        ],
      }),
    ).toEqual({
      recap: 'We practiced food words.',
      reviewWords: ['apple', 'bread', 'rice'],
    })
  })

  it('hides when there is no recap and no review words', () => {
    expect(
      classroomHomeLastTime({
        sessions: [session({ id: 'old', status: 'completed' })],
        needsPracticeWords: [],
      }),
    ).toBeNull()
  })

  it('does not use the teacher session log as a student recap', () => {
    expect(
      classroomHomeLastTime({
        sessions: [
          session({
            id: 'old',
            status: 'completed',
            sessionNote: 'Parent wants more homework.',
          }),
        ],
      }),
    ).toBeNull()
  })
})
