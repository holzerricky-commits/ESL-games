import { describe, expect, it } from 'vitest'
import { buildAutoBookmarkAtEnd } from '@/lib/students/class-bookmark-at-end'
import type { StudentClassSessionView } from '@/lib/students/types'

function sessionWithSection(): StudentClassSessionView {
  return {
    id: 'class-1',
    title: 'Live class',
    scheduledFor: '2026-07-07T11:00:00.000Z',
    durationMin: 30,
    status: 'in_progress',
    goals: [],
    activities: [],
    plannedVocabulary: [],
    introducedWords: [],
    practicedWords: [],
    reviewedWords: [],
    learnedWords: [],
    createdAt: '2026-07-07T10:00:00.000Z',
    updatedAt: '2026-07-07T10:00:00.000Z',
    selectedSection: {
      id: 'part-1',
      type: 'part',
      bookId: 'book-a',
      bookTitle: 'Book A',
      unitId: 'unit-1',
      unitTitle: 'Unit 1',
      title: 'Planned part',
      startPageHint: 10,
      endPageHint: 14,
    },
  }
}

describe('buildAutoBookmarkAtEnd', () => {
  it('uses the visible reader page instead of the planned section hint', () => {
    expect(
      buildAutoBookmarkAtEnd(sessionWithSection(), ['book-a'], {
        bookId: 'book-a',
        unitId: 'unit-1',
        pdfPage: 28.9,
      }),
    ).toEqual({ bookId: 'book-a', unitId: 'unit-1', pdfPage: 28 })
  })

  it('falls back to the planned section when the reader has not reported a page', () => {
    expect(buildAutoBookmarkAtEnd(sessionWithSection(), ['book-a'], null)).toEqual({
      bookId: 'book-a',
      unitId: 'unit-1',
      pdfPage: 14,
    })
  })
})
