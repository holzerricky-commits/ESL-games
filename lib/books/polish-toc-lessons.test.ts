import { describe, expect, it } from 'vitest'
import {
  isGenericLessonChunkTitle,
  mergeAdjacentDuplicateLessons,
  polishTocLessonsForUnit,
} from '@/lib/books/polish-toc-lessons'
import type { BookLessonRecord } from '@/lib/books/types'

function lesson(
  title: string,
  opts?: { start?: number; parts?: Array<{ title: string; start: number }> },
): BookLessonRecord {
  const parts = (opts?.parts ?? []).map((p, i) => ({
    id: `part-${i}`,
    title: p.title,
    startPageHint: p.start,
    structureTag: 'unspecified' as const,
    anchorSource: 'toc' as const,
    anchorConfidence: 'high' as const,
  }))
  return {
    id: `lesson-${title}`,
    title,
    ...(opts?.start != null ? { startPageHint: opts.start } : {}),
    ...(parts.length ? { parts } : {}),
    anchorSource: 'toc',
    anchorConfidence: 'high',
  }
}

describe('isGenericLessonChunkTitle', () => {
  it('flags Contents / Section N / bare Lesson N / unit echo', () => {
    expect(isGenericLessonChunkTitle('Contents', 'Amazing Animals')).toBe(true)
    expect(isGenericLessonChunkTitle('Section 1', 'Amazing Animals')).toBe(true)
    expect(isGenericLessonChunkTitle('Lesson 1', 'Amazing Animals')).toBe(true)
    expect(isGenericLessonChunkTitle('Amazing Animals', 'Amazing Animals')).toBe(true)
    expect(isGenericLessonChunkTitle('The Incredible Dolphin', 'Amazing Animals')).toBe(false)
  })
})

describe('mergeAdjacentDuplicateLessons', () => {
  it('merges same-titled neighbors and dedupes parts', () => {
    const merged = mergeAdjacentDuplicateLessons([
      lesson('Reading A', {
        start: 8,
        parts: [
          { title: 'Before You Read', start: 8 },
          { title: 'Story', start: 10 },
        ],
      }),
      lesson('Reading A', {
        start: 8,
        parts: [
          { title: 'Story', start: 10 },
          { title: 'Skill', start: 14 },
        ],
      }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.parts?.map((p) => p.title)).toEqual(['Before You Read', 'Story', 'Skill'])
  })
})

describe('polishTocLessonsForUnit', () => {
  it('renames a flat generic wrapper when it is the only chunk', () => {
    const polished = polishTocLessonsForUnit(
      'Amazing Animals',
      [
        lesson('Contents', {
          start: 7,
          parts: [
            { title: 'Before You Read', start: 7 },
            { title: 'The Incredible Dolphin', start: 8 },
          ],
        }),
      ],
      'generic',
    )
    expect(polished).toHaveLength(1)
    expect(polished[0]?.title).toBe('Amazing Animals')
    expect(polished[0]?.parts).toHaveLength(2)
  })

  it('keeps a titled lesson with neither page nor parts', () => {
    const polished = polishTocLessonsForUnit(
      'Amazing Animals',
      [lesson('Reading A')],
      'generic',
    )
    expect(polished).toHaveLength(1)
    expect(polished[0]?.title).toBe('Reading A')
    expect(polished[0]?.startPageHint).toBeUndefined()
  })

  it('drops lessons with blank titles and no content', () => {
    const polished = polishTocLessonsForUnit(
      'Amazing Animals',
      [{ id: 'blank', title: '   ' }],
      'generic',
    )
    expect(polished).toHaveLength(0)
  })

  it('keeps Journeys Lesson N titles when profile is journeys', () => {
    const polished = polishTocLessonsForUnit(
      'Good Citizens',
      [
        lesson('Lesson 1', {
          start: 10,
          parts: [{ title: 'Vocabulary in Context', start: 10 }],
        }),
      ],
      'journeys',
    )
    expect(polished[0]?.title).toBe('Lesson 1')
  })

  it('does not collapse multiple real lesson chunks', () => {
    const polished = polishTocLessonsForUnit(
      'Amazing Animals',
      [
        lesson('Reading A', {
          start: 7,
          parts: [{ title: 'Dolphin', start: 8 }],
        }),
        lesson('Reading B', {
          start: 15,
          parts: [{ title: 'Chameleon', start: 16 }],
        }),
      ],
      'generic',
    )
    expect(polished.map((l) => l.title)).toEqual(['Reading A', 'Reading B'])
  })
})
