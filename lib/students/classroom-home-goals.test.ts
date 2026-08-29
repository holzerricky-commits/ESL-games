import { describe, expect, it } from 'vitest'
import {
  buildClassroomHomeLessonLines,
  classroomHomeContextLine,
  classroomHomeLessonHasContent,
  sanitizeClassroomHomeGoals,
} from '@/lib/students/classroom-home-goals'

describe('sanitizeClassroomHomeGoals', () => {
  it('keeps filled lines and drops blanks', () => {
    expect(
      sanitizeClassroomHomeGoals({
        vocabulary: '  8 food words  ',
        grammar: '',
        speaking: 'favourite food',
        extra: 'nope',
      }),
    ).toEqual({ vocabulary: '8 food words', speaking: 'favourite food' })
  })

  it('returns undefined when nothing is filled', () => {
    expect(sanitizeClassroomHomeGoals({ vocabulary: '  ' })).toBeUndefined()
    expect(sanitizeClassroomHomeGoals(null)).toBeUndefined()
  })
})

describe('classroomHomeContextLine', () => {
  it('joins unique book / unit / lesson', () => {
    expect(classroomHomeContextLine(['Workshop', 'Unit 3', 'Unit 3', 'Vocabulary'])).toBe(
      'Workshop · Unit 3 · Vocabulary',
    )
    expect(classroomHomeContextLine(['', null, undefined])).toBeNull()
  })
})

describe('buildClassroomHomeLessonLines', () => {
  it('lists lesson parts and puts words under vocabulary', () => {
    expect(
      buildClassroomHomeLessonLines({
        parts: [
          { id: 'v', title: 'Words to Know', kindLabel: 'Vocabulary', tag: 'vocabulary_in_context' },
          { id: 's', title: 'The River', kindLabel: 'Story', tag: 'main_story' },
          { id: 'g', title: 'I like', kindLabel: 'Grammar', tag: 'grammar' },
        ],
        words: ['apple', 'bread', 'soup'],
        grammarTarget: 'I like / I don’t like',
      }),
    ).toEqual([
      {
        kind: 'vocabulary',
        label: 'Vocabulary',
        text: 'apple, bread, soup',
        detail: 'apple, bread, soup',
      },
      { label: 'Story', text: 'Story' },
      {
        kind: 'grammar',
        label: 'Grammar',
        text: 'I like / I don’t like',
        detail: 'I like / I don’t like',
      },
    ])
  })

  it('skips skipped parts and does not invent empty skill rows', () => {
    expect(
      buildClassroomHomeLessonLines({
        parts: [
          { id: 'v', kindLabel: 'Vocabulary', tag: 'vocabulary_in_context', skipped: true },
          { id: 's', kindLabel: 'Story', tag: 'main_story' },
        ],
        words: ['river'],
      }),
    ).toEqual([{ label: 'Story', text: 'Story' }])
  })

  it('falls back to outline time blocks when there are no lesson parts', () => {
    expect(
      buildClassroomHomeLessonLines({
        prepTimeBlocks: [
          { id: 'w', label: 'Warm-up', activityType: 'review' },
          { id: 'v', label: 'Vocabulary', activityType: 'practice', objective: 'Learn food words' },
          { id: 'g', label: 'Grammar', activityType: 'guided-practice', objective: 'I like / I don’t like' },
        ],
        words: ['apple', 'bread'],
      }),
    ).toEqual([
      { label: 'Warm-up', text: 'Warm-up' },
      {
        kind: 'vocabulary',
        label: 'Vocabulary',
        text: 'apple, bread',
        detail: 'apple, bread',
      },
      {
        kind: 'grammar',
        label: 'Grammar',
        text: 'I like / I don’t like',
        detail: 'I like / I don’t like',
      },
    ])
  })

  it('falls back to priorities, then session goals, when nothing is planned', () => {
    expect(buildClassroomHomeLessonLines({ prepPriorities: ['Warm up', 'Story'] })).toEqual([
      { text: 'Warm up' },
      { text: 'Story' },
    ])
    expect(buildClassroomHomeLessonLines({ sessionGoals: ['Read pages 10–12'] })).toEqual([
      { text: 'Read pages 10–12' },
    ])
  })
})

describe('classroomHomeLessonHasContent', () => {
  it('is true when context or lines exist', () => {
    expect(classroomHomeLessonHasContent({ contextLine: 'Unit 3', lines: [] })).toBe(true)
    expect(classroomHomeLessonHasContent({ contextLine: null, lines: [{ text: 'Warm up' }] })).toBe(true)
    expect(classroomHomeLessonHasContent({ contextLine: null, lines: [] })).toBe(false)
  })
})
