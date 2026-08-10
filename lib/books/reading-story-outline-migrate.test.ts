import { describe, expect, it } from 'vitest'
import {
  bookRecordFromOutlineDrafts,
  buildDefaultReconcileDecisions,
  matchManualStoriesToOutline,
  pageRangeOverlap,
  suggestUnitIdForManualPages,
  titleSimilarity,
} from '@/lib/books/reading-story-outline-migrate'
import type { ReadingStoryMap, ReadingStoryRangeOverride } from '@/lib/books/reading-story-map'
import type { BookLessonRecord } from '@/lib/books/types'

describe('reading-story-outline-migrate', () => {
  it('scores similar titles', () => {
    expect(titleSimilarity('My Light', 'My Light')).toBe(1)
    expect(titleSimilarity('My Light', 'The Power of Water')).toBeLessThan(0.3)
    expect(titleSimilarity('The Boy Who Cried Wolf', 'Boy Who Cried Wolf')).toBeGreaterThan(0.7)
  })

  it('computes page overlap', () => {
    expect(pageRangeOverlap(514, 532, 514, 532)).toBe(19)
    expect(pageRangeOverlap(514, 532, 534, 537)).toBe(0)
    expect(pageRangeOverlap(520, 540, 530, 550)).toBe(11)
  })

  it('matches manuals to outline stories by title and pages', () => {
    const drafts = [
      {
        id: 'unit-6',
        title: 'How on Earth?',
        needsReview: false,
        startPageHint: 400,
        endPageHint: 560,
        filePath: 'book-library/lit/g2.pdf',
      },
    ]
    const lessons: BookLessonRecord[][] = [
      [
        {
          id: 'week-2',
          title: 'Week 2: Pedal Power',
          startPageHint: 514,
          endPageHint: 537,
          parts: [
            {
              id: 'part-main',
              title: 'My Light',
              structureTag: 'main_story',
              startPageHint: 514,
              endPageHint: 532,
            },
            {
              id: 'part-paired',
              title: 'The Power of Water',
              structureTag: 'paired_story',
              startPageHint: 534,
              endPageHint: 537,
            },
          ],
        },
      ],
    ]
    const book = bookRecordFromOutlineDrafts(
      { id: 'literature-anthology-g2', title: 'Literature G2' },
      drafts,
      lessons,
      'book-library/lit/g2.pdf',
    )

    const manuals: ReadingStoryMap[] = [
      {
        id: 'manual::literature-anthology-g2::old-unit::a',
        bookId: 'literature-anthology-g2',
        unitId: 'old-unit',
        lessonId: null,
        partId: null,
        title: 'My Light',
        kind: 'manual',
      },
      {
        id: 'manual::literature-anthology-g2::old-unit::b',
        bookId: 'literature-anthology-g2',
        unitId: 'old-unit',
        lessonId: null,
        partId: null,
        title: 'The Power of Water',
        kind: 'manual',
      },
    ]
    const overridesById: Record<string, ReadingStoryRangeOverride> = {
      [manuals[0]!.id]: {
        storyId: manuals[0]!.id,
        startPage: 514,
        endPage: 532,
        rangeConfirmed: true,
        updatedAt: '2026-08-04T00:00:00.000Z',
        title: 'My Light',
        bookId: 'literature-anthology-g2',
        unitId: 'old-unit',
      },
      [manuals[1]!.id]: {
        storyId: manuals[1]!.id,
        startPage: 534,
        endPage: 537,
        rangeConfirmed: true,
        updatedAt: '2026-08-04T00:00:00.000Z',
        title: 'The Power of Water',
        bookId: 'literature-anthology-g2',
        unitId: 'old-unit',
      },
    }

    const matches = matchManualStoriesToOutline({ book, manuals, overridesById })
    expect(matches).toHaveLength(2)
    expect(matches[0]?.outline?.title).toBe('My Light')
    expect(matches[0]?.confidence).toBe('high')
    expect(matches[1]?.outline?.title).toBe('The Power of Water')
    expect(matches[1]?.confidence).toBe('high')
    expect(matches[0]?.outline?.id).not.toBe(matches[1]?.outline?.id)

    const defaults = buildDefaultReconcileDecisions(matches)
    expect(defaults.every((d) => d.action === 'merge')).toBe(true)
  })

  it('suggests a unit that covers the page mid-point', () => {
    const book = bookRecordFromOutlineDrafts(
      { id: 'b', title: 'B' },
      [
        { id: 'u1', title: 'U1', needsReview: false, startPageHint: 1, endPageHint: 100 },
        { id: 'u6', title: 'U6', needsReview: false, startPageHint: 400, endPageHint: 560 },
      ],
      [[], []],
      'x.pdf',
    )
    expect(suggestUnitIdForManualPages(book, 514, 532)).toBe('u6')
  })
})
