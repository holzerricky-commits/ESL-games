import { describe, expect, it } from 'vitest'
import {
  extractUnitNumberFromTitle,
  mergeExtractedStructureBatches,
  mergeLessonLists,
  normalizeUnitTitleForMerge,
  unitMergeKey,
} from '@/lib/books/merge-toc-extract-batches'
import type { BookLessonRecord } from '@/lib/books/types'
import type { TocUnitDraft } from '@/lib/books/toc-import'

function draft(partial: Partial<TocUnitDraft> & { title: string }): TocUnitDraft {
  return {
    id: partial.id ?? `unit-${partial.title}`,
    title: partial.title,
    needsReview: false,
    ...partial,
  }
}

function lesson(title: string, startPageHint: number): BookLessonRecord {
  return {
    id: `lesson-${title}-${startPageHint}`,
    title,
    startPageHint,
    anchorSource: 'toc',
    anchorConfidence: 'high',
  }
}

describe('normalizeUnitTitleForMerge / extractUnitNumberFromTitle', () => {
  it('normalizes titles', () => {
    expect(normalizeUnitTitleForMerge('Unit 1: Amazing Animals')).toBe('unit 1 amazing animals')
  })

  it('extracts unit numbers', () => {
    expect(extractUnitNumberFromTitle('Unit 1: Amazing Animals')).toBe(1)
    expect(extractUnitNumberFromTitle('Chapter 12 Travel')).toBe(12)
    expect(extractUnitNumberFromTitle('Contents')).toBeNull()
  })

  it('keys by unit number when present', () => {
    expect(unitMergeKey(draft({ title: 'Unit 1' }))).toBe('n:1')
    expect(unitMergeKey(draft({ title: 'Unit 1: Amazing Animals' }))).toBe('n:1')
  })
})

describe('mergeLessonLists', () => {
  it('dedupes same title and start page', () => {
    const merged = mergeLessonLists(
      [lesson('Reading A', 8), lesson('Reading B', 14)],
      [lesson('Reading A', 8), lesson('Skill', 20)],
    )
    expect(merged.map((l) => l.title)).toEqual(['Reading A', 'Reading B', 'Skill'])
  })
})

describe('mergeExtractedStructureBatches', () => {
  it('merges Unit 1 across batches when titles differ slightly', () => {
    const merged = mergeExtractedStructureBatches([
      {
        drafts: [draft({ title: 'Unit 1', startPageHint: 7 })],
        lessonsByUnit: [[lesson('Intro', 7)]],
      },
      {
        drafts: [draft({ title: 'Unit 1: Amazing Animals', startPageHint: 7 })],
        lessonsByUnit: [[lesson('Story', 10)]],
      },
    ])
    expect(merged.drafts).toHaveLength(1)
    expect(merged.drafts[0]?.title).toBe('Unit 1: Amazing Animals')
    expect(merged.lessonsByUnit[0]?.map((l) => l.title)).toEqual(['Intro', 'Story'])
  })

  it('continues a unit that is not the previous draft in the merge list', () => {
    const merged = mergeExtractedStructureBatches([
      {
        drafts: [
          draft({ title: 'Unit 1: Animals', startPageHint: 7 }),
          draft({ title: 'Unit 2: Travel', startPageHint: 21 }),
        ],
        lessonsByUnit: [[lesson('A', 7)], [lesson('B', 21)]],
      },
      {
        drafts: [draft({ title: 'Unit 1 Amazing Animals', startPageHint: 7 })],
        lessonsByUnit: [[lesson('C', 14)]],
      },
    ])
    expect(merged.drafts.map((d) => extractUnitNumberFromTitle(d.title))).toEqual([1, 2])
    expect(merged.lessonsByUnit[0]?.map((l) => l.title)).toEqual(['A', 'C'])
    expect(merged.lessonsByUnit[1]?.map((l) => l.title)).toEqual(['B'])
  })

  it('drops empty Contents / Scope shells', () => {
    const merged = mergeExtractedStructureBatches([
      {
        drafts: [
          draft({ title: 'Contents' }),
          draft({ title: 'Scope and Sequence' }),
          draft({ title: 'Unit 1', startPageHint: 7 }),
        ],
        lessonsByUnit: [[], [], [lesson('Story', 7)]],
      },
    ])
    expect(merged.drafts.map((d) => d.title)).toEqual(['Unit 1'])
  })

  it('still merges exact previous-title batches (legacy behavior)', () => {
    const merged = mergeExtractedStructureBatches([
      {
        drafts: [draft({ title: 'Good Citizens', startPageHint: 10 })],
        lessonsByUnit: [[lesson('Lesson 1', 10)]],
      },
      {
        drafts: [draft({ title: 'Good Citizens', startPageHint: 10 })],
        lessonsByUnit: [[lesson('Lesson 2', 24)]],
      },
    ])
    expect(merged.drafts).toHaveLength(1)
    expect(merged.lessonsByUnit[0]?.map((l) => l.title)).toEqual(['Lesson 1', 'Lesson 2'])
  })
})
