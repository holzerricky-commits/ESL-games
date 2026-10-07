import { describe, expect, it } from 'vitest'
import type { BookRecord } from '@/lib/books/types'
import {
  bookHasLessonOutline,
  isPlaceAtLessonEnd,
  listBookLessonSpans,
  resolveOpenTargetForPlace,
  resolveUpNextBookId,
  sanitizeStudentBookPlaces,
} from '@/lib/students/book-places'

const workshop: BookRecord = {
  id: 'workshop',
  title: 'Workshop',
  units: [
    {
      id: 'w-u1',
      title: 'Unit 1',
      filePath: '/w1.pdf',
      lessons: [
        { id: 'w-l1', title: 'Lesson 1', startPageHint: 10, endPageHint: 20 },
        { id: 'w-l2', title: 'Lesson 2', startPageHint: 21 },
      ],
      endPageHint: 30,
    },
    {
      id: 'w-u2',
      title: 'Unit 2',
      filePath: '/w2.pdf',
      lessons: [{ id: 'w-l3', title: 'Lesson 3', parts: [{ id: 'p', title: 'P', startPageHint: 5, endPageHint: 9 }] }],
    },
  ],
}

const literature: BookRecord = {
  id: 'literature',
  title: 'Literature',
  units: [{ id: 'l-u1', title: 'Unit 1', filePath: '/l1.pdf', lessons: [{ id: 'l-l1', title: 'Story', startPageHint: 4, endPageHint: 12 }] }],
}

const noOutline: BookRecord = {
  id: 'plain',
  title: 'Plain',
  units: [{ id: 'p-u1', title: 'Unit 1', filePath: '/p1.pdf' }],
}

const booksById = new Map([workshop, literature, noOutline].map((b) => [b.id, b]))
const at = (unitId: string, pdfPage: number, updatedAt = '2026-09-01T10:00:00.000Z') => ({ unitId, pdfPage, updatedAt })

describe('lesson spans', () => {
  it('derives ends from next lesson, unit end, and parts', () => {
    expect(listBookLessonSpans(workshop)).toEqual([
      { unitId: 'w-u1', lessonId: 'w-l1', startPdf: 10, endPdf: 20 },
      { unitId: 'w-u1', lessonId: 'w-l2', startPdf: 21, endPdf: 30 },
      { unitId: 'w-u2', lessonId: 'w-l3', startPdf: 5, endPdf: 9 },
    ])
  })

  it('treats a book without page ranges as having no outline', () => {
    expect(bookHasLessonOutline(noOutline)).toBe(false)
    expect(bookHasLessonOutline(workshop)).toBe(true)
  })
})

describe('isPlaceAtLessonEnd', () => {
  it('is true when the spread shows the last page (left or right)', () => {
    expect(isPlaceAtLessonEnd(workshop, at('w-u1', 19))).toBe(true)
    expect(isPlaceAtLessonEnd(workshop, at('w-u1', 20))).toBe(true)
  })

  it('is false earlier in the lesson and for books without an outline', () => {
    expect(isPlaceAtLessonEnd(workshop, at('w-u1', 17))).toBe(false)
    expect(isPlaceAtLessonEnd(noOutline, at('p-u1', 99))).toBe(false)
  })
})

describe('resolveOpenTargetForPlace', () => {
  it('keeps the place mid-lesson', () => {
    expect(resolveOpenTargetForPlace(workshop, at('w-u1', 14))).toEqual({ unitId: 'w-u1', pdfPage: 14 })
  })

  it('moves to the next lesson start once the lesson was finished, across units', () => {
    expect(resolveOpenTargetForPlace(workshop, at('w-u1', 19))).toEqual({ unitId: 'w-u1', pdfPage: 21 })
    expect(resolveOpenTargetForPlace(workshop, at('w-u1', 29))).toEqual({ unitId: 'w-u2', pdfPage: 5 })
  })

  it('stays put at the very last lesson', () => {
    expect(resolveOpenTargetForPlace(workshop, at('w-u2', 8))).toEqual({ unitId: 'w-u2', pdfPage: 8 })
  })
})

describe('resolveUpNextBookId', () => {
  const assigned = ['workshop', 'literature']

  it('returns null until a book has a place', () => {
    expect(resolveUpNextBookId({ assignedBookIds: assigned, places: {}, booksById })).toBeNull()
  })

  it('stays on the taught book mid-lesson', () => {
    expect(
      resolveUpNextBookId({
        assignedBookIds: assigned,
        places: { workshop: at('w-u1', 14) },
        lastTaughtBookId: 'workshop',
        booksById,
      }),
    ).toBe('workshop')
  })

  it('switches to the next book when the lesson end was reached, and wraps', () => {
    expect(
      resolveUpNextBookId({
        assignedBookIds: assigned,
        places: { workshop: at('w-u1', 19) },
        lastTaughtBookId: 'workshop',
        booksById,
      }),
    ).toBe('literature')
    expect(
      resolveUpNextBookId({
        assignedBookIds: assigned,
        places: { workshop: at('w-u1', 19), literature: at('l-u1', 12) },
        lastTaughtBookId: 'literature',
        booksById,
      }),
    ).toBe('workshop')
  })

  it('turning back from the last page undoes the switch', () => {
    expect(
      resolveUpNextBookId({
        assignedBookIds: assigned,
        places: { workshop: at('w-u1', 16) },
        lastTaughtBookId: 'workshop',
        booksById,
      }),
    ).toBe('workshop')
  })

  it('never switches away from a book without an outline', () => {
    expect(
      resolveUpNextBookId({
        assignedBookIds: ['plain', 'literature'],
        places: { plain: at('p-u1', 200) },
        lastTaughtBookId: 'plain',
        booksById,
      }),
    ).toBe('plain')
  })

  it('with one assigned book stays on it', () => {
    expect(
      resolveUpNextBookId({
        assignedBookIds: ['workshop'],
        places: { workshop: at('w-u1', 19) },
        lastTaughtBookId: 'workshop',
        booksById,
      }),
    ).toBe('workshop')
  })

  it('without a taught book, uses the most recently moved place', () => {
    expect(
      resolveUpNextBookId({
        assignedBookIds: assigned,
        places: {
          workshop: at('w-u1', 14, '2026-09-01T10:00:00.000Z'),
          literature: at('l-u1', 6, '2026-09-02T10:00:00.000Z'),
        },
        booksById,
      }),
    ).toBe('literature')
  })
})

describe('sanitizeStudentBookPlaces', () => {
  it('drops invalid entries', () => {
    expect(
      sanitizeStudentBookPlaces({
        a: { unitId: 'u', pdfPage: 3.7, updatedAt: '2026-09-01T10:00:00.000Z' },
        b: { unitId: '', pdfPage: 3 },
        c: { unitId: 'u', pdfPage: 0 },
      }),
    ).toEqual({ a: { unitId: 'u', pdfPage: 3, updatedAt: '2026-09-01T10:00:00.000Z' } })
  })
})
