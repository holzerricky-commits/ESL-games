import { describe, expect, it } from 'vitest'
import {
  classroomHomeCoverAction,
  classroomHomeCoverMeta,
  classroomHomeLessonLabel,
  splitClassroomHomeCovers,
} from '@/lib/students/classroom-home-covers'

describe('classroomHomeCoverAction', () => {
  it('uses Continue for today’s plan or a saved page', () => {
    expect(classroomHomeCoverAction({ isTodayPlan: true })).toBe('Continue')
    expect(classroomHomeCoverAction({ lastStopLabel: 'p. 42' })).toBe('Continue')
  })

  it('uses Open when there is no resume hint', () => {
    expect(classroomHomeCoverAction({})).toBe('Open')
  })
})

describe('classroomHomeCoverMeta', () => {
  it('joins unit, lesson, and page without duplicates', () => {
    expect(
      classroomHomeCoverMeta({
        unitLabel: 'Unit 3',
        lessonLabel: 'Vocabulary',
        lastStopLabel: 'p. 42',
      }),
    ).toBe('Unit 3 · Vocabulary · p. 42')
    expect(
      classroomHomeCoverMeta({
        unitLabel: 'Unit 3',
        lessonLabel: 'Unit 3',
        lastStopLabel: 'p. 12',
      }),
    ).toBe('Unit 3 · p. 12')
  })

  it('returns null when nothing is known', () => {
    expect(classroomHomeCoverMeta({})).toBeNull()
  })
})

describe('classroomHomeLessonLabel', () => {
  it('prefers lesson, then part, then title, skipping the unit name', () => {
    expect(
      classroomHomeLessonLabel({
        unitLabel: 'Unit 3',
        lessonTitle: 'Week 1',
        partTitle: 'Vocabulary',
        title: 'Unit 3',
      }),
    ).toBe('Week 1')
    expect(
      classroomHomeLessonLabel({
        unitLabel: 'Unit 3',
        title: 'Unit 3',
      }),
    ).toBeUndefined()
    expect(
      classroomHomeLessonLabel({
        unitLabel: 'Unit 3',
        partTitle: 'Vocabulary in Context',
      }),
    ).toBe('Vocabulary in Context')
  })
})

describe('splitClassroomHomeCovers', () => {
  const workshop = { bookId: 'w', bookTitle: 'Workshop' }
  const literature = { bookId: 'l', bookTitle: 'Literature', isTodayPlan: true }

  it('features today’s book beside the others', () => {
    const split = splitClassroomHomeCovers([workshop, literature])
    expect(split.featured?.bookId).toBe('l')
    expect(split.others.map((c) => c.bookId)).toEqual(['w'])
  })

  it('features the only book even without a today mark', () => {
    const split = splitClassroomHomeCovers([workshop])
    expect(split.featured?.bookId).toBe('w')
    expect(split.others).toEqual([])
  })

  it('keeps an equal row when several books and none is today', () => {
    const split = splitClassroomHomeCovers([workshop, { bookId: 'l' }])
    expect(split.featured).toBeNull()
    expect(split.others.map((c) => c.bookId)).toEqual(['w', 'l'])
  })
})
