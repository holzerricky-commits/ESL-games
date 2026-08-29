import { describe, expect, it } from 'vitest'
import {
  buildClassroomHomeReview,
  classroomHomeReviewHasExtras,
  formatClassroomHomeAnswers,
  formatClassroomHomeDuration,
} from '@/lib/students/classroom-home-review'

describe('formatClassroomHomeDuration', () => {
  it('rounds live start/end to minutes', () => {
    expect(
      formatClassroomHomeDuration({
        startedAt: '2026-08-19T10:00:00.000Z',
        endedAt: '2026-08-19T10:32:00.000Z',
      }),
    ).toBe('32 min')
    expect(
      formatClassroomHomeDuration({
        startedAt: '2026-08-19T10:00:00.000Z',
        endedAt: '2026-08-19T11:05:00.000Z',
      }),
    ).toBe('1 hr 5 min')
  })

  it('falls back to planned length when times are missing', () => {
    expect(formatClassroomHomeDuration({ durationMin: 30 })).toBe('30 min')
    expect(formatClassroomHomeDuration({})).toBeNull()
  })
})

describe('formatClassroomHomeAnswers', () => {
  it('hides when nothing was marked and keeps scores compact', () => {
    expect(formatClassroomHomeAnswers({ attempted: 0, correct: 0, incorrect: 0, skip: 0 })).toBeNull()
    expect(
      formatClassroomHomeAnswers({ attempted: 10, correct: 8, incorrect: 2, skip: 0 }),
    ).toBe('8 right · 2 miss')
  })
})

describe('buildClassroomHomeReview', () => {
  it('keeps empty extras hidden and honest', () => {
    const empty = buildClassroomHomeReview({})
    expect(classroomHomeReviewHasExtras(empty)).toBe(false)
    const full = buildClassroomHomeReview({
      startedAt: '2026-08-19T10:00:00.000Z',
      endedAt: '2026-08-19T10:25:00.000Z',
      contextLine: 'Workshop · Unit 3',
      practiced: [{ kind: 'speaking', label: 'Speaking', text: 'favourite food' }],
      learnedWords: ['apple', 'bread'],
      answers: { attempted: 4, correct: 4, incorrect: 0, skip: 0 },
      reviewWords: ['rice'],
    })
    expect(full.durationLabel).toBe('25 min')
    expect(full.answersLabel).toBe('4 right')
    expect(full.learnedWords).toEqual(['apple', 'bread'])
    expect(classroomHomeReviewHasExtras(full)).toBe(true)
  })
})
