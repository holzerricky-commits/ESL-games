import { describe, expect, it } from 'vitest'
import {
  chunkTocImagesWithOverlap,
  extractChunkNumberFromLessonTitle,
  extractUnitNumberFromTitle,
  looksLikeUnitContinuation,
  mergeExtractedStructureBatches,
  mergeLessonLists,
  normalizeUnitTitleForMerge,
  openUnitContinuationHint,
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
    expect(unitMergeKey(draft({ title: 'Figure It Out', unitNumber: 5 }))).toBe('n:5')
  })

  it('extracts week/lesson numbers from chunk titles', () => {
    expect(extractChunkNumberFromLessonTitle('Week 3: Great Inventions')).toBe(3)
    expect(extractChunkNumberFromLessonTitle('Lesson 2 Vocabulary')).toBe(2)
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

describe('looksLikeUnitContinuation', () => {
  it('detects Week 3+ continuing after Week 1–2', () => {
    expect(
      looksLikeUnitContinuation(
        [lesson('Week 1: Friends', 10), lesson('Week 2: Teamwork', 20)],
        draft({ title: 'Great Inventions' }),
        [lesson('Week 3: Great Inventions', 30), lesson('Week 4: Build', 40)],
      ),
    ).toBe(true)
  })

  it('rejects when next draft already has a unit number', () => {
    expect(
      looksLikeUnitContinuation(
        [lesson('Week 1: A', 10), lesson('Week 2: B', 20)],
        draft({ title: 'Next Unit', unitNumber: 6 }),
        [lesson('Week 3: C', 30)],
      ),
    ).toBe(false)
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

  it('merges by draft.unitNumber when titles are theme-only', () => {
    const merged = mergeExtractedStructureBatches([
      {
        drafts: [draft({ title: 'Figure It Out', unitNumber: 5, startPageHint: 100 })],
        lessonsByUnit: [[lesson('Week 1: Friends', 100), lesson('Week 2: Teamwork', 110)]],
      },
      {
        drafts: [draft({ title: 'Great Inventions', unitNumber: 5, startPageHint: 120 })],
        lessonsByUnit: [
          [
            lesson('Week 3: Great Inventions', 120),
            lesson('Week 4: Problem Solvers', 130),
            lesson('Week 5: Creative Ideas', 140),
          ],
        ],
      },
    ])
    expect(merged.drafts).toHaveLength(1)
    expect(merged.drafts[0]?.title).toBe('Figure It Out')
    expect(merged.drafts[0]?.unitNumber).toBe(5)
    expect(merged.lessonsByUnit[0]?.map((l) => l.title)).toEqual([
      'Week 1: Friends',
      'Week 2: Teamwork',
      'Week 3: Great Inventions',
      'Week 4: Problem Solvers',
      'Week 5: Creative Ideas',
    ])
  })

  it('stitches mistitled week-theme unit onto the previous open unit', () => {
    const merged = mergeExtractedStructureBatches([
      {
        drafts: [
          draft({ title: 'Animals Everywhere', unitNumber: 4, startPageHint: 80 }),
          draft({ title: 'Figure It Out', unitNumber: 5, startPageHint: 100 }),
        ],
        lessonsByUnit: [
          [lesson('Week 1: A', 80), lesson('Week 5: E', 95)],
          [lesson('Week 1: Friends', 100), lesson('Week 2: Teamwork', 110)],
        ],
      },
      {
        drafts: [
          draft({ title: 'Great Inventions', startPageHint: 120 }),
          draft({ title: 'Together We Can!', unitNumber: 6, startPageHint: 150 }),
        ],
        lessonsByUnit: [
          [
            lesson('Week 3: Great Inventions', 120),
            lesson('Week 4: Problem Solvers', 130),
            lesson('Week 5: Creative Ideas', 140),
          ],
          [lesson('Week 1: Community', 150)],
        ],
      },
    ])
    expect(merged.drafts.map((d) => d.title)).toEqual([
      'Animals Everywhere',
      'Figure It Out',
      'Together We Can!',
    ])
    expect(merged.lessonsByUnit[1]?.map((l) => l.title)).toEqual([
      'Week 1: Friends',
      'Week 2: Teamwork',
      'Week 3: Great Inventions',
      'Week 4: Problem Solvers',
      'Week 5: Creative Ideas',
    ])
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

describe('chunkTocImagesWithOverlap', () => {
  it('overlaps consecutive batches by one page', () => {
    expect(chunkTocImagesWithOverlap([12, 13, 14, 15, 16, 17], 3, 1)).toEqual([
      [12, 13, 14],
      [14, 15, 16],
      [16, 17],
    ])
  })
})

describe('openUnitContinuationHint', () => {
  it('reports the last open unit and highest week number', () => {
    const hint = openUnitContinuationHint({
      drafts: [draft({ title: 'Figure It Out', unitNumber: 5 })],
      lessonsByUnit: [[lesson('Week 1: Friends', 100), lesson('Week 2: Teamwork', 110)]],
    })
    expect(hint).toEqual({
      unitNumber: 5,
      title: 'Figure It Out',
      lastLessonNumber: 2,
    })
  })
})
