import { describe, expect, it } from 'vitest'
import {
  bookHasBrowsablePdf,
  bookNeedsLessonShelfOutline,
  buildBookLessonShelfRows,
  resolveLessonShelfCardPdfPage,
  resolveLessonShelfThumbPrintedStart,
  resolveUnitShelfThumbPrintedStart,
} from '@/lib/books/book-lesson-shelf'
import type { BookRecord } from '@/lib/books/types'

function baseBook(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: 'book-1',
    title: 'Test Book',
    units: [],
    ...overrides,
  }
}

describe('book-lesson-shelf', () => {
  it('bookHasBrowsablePdf is true when a unit has a file', () => {
    expect(bookHasBrowsablePdf(baseBook())).toBe(false)
    expect(
      bookHasBrowsablePdf(
        baseBook({
          units: [{ id: 'u1', title: 'Unit 1', filePath: 'a.pdf' }],
        }),
      ),
    ).toBe(true)
    expect(
      bookHasBrowsablePdf(
        baseBook({
          units: [{ id: 'u1', title: 'Unit 1', filePath: '  ' }],
        }),
      ),
    ).toBe(false)
  })

  it('bookNeedsLessonShelfOutline is true when a regular book has no lessons', () => {
    expect(bookNeedsLessonShelfOutline(baseBook())).toBe(true)
    expect(
      bookNeedsLessonShelfOutline(
        baseBook({
          units: [{ id: 'u1', title: 'Unit 1', filePath: 'a.pdf' }],
        }),
      ),
    ).toBe(true)
  })

  it('bookNeedsLessonShelfOutline is false when lessons exist', () => {
    expect(
      bookNeedsLessonShelfOutline(
        baseBook({
          units: [
            {
              id: 'u1',
              title: 'Unit 1',
              filePath: 'a.pdf',
              lessons: [{ id: 'l1', title: 'Lesson 1', startPageHint: 10 }],
            },
          ],
        }),
      ),
    ).toBe(false)
  })

  it('bookNeedsLessonShelfOutline is false when distinct unit files exist without lessons', () => {
    expect(
      bookNeedsLessonShelfOutline(
        baseBook({
          units: [
            { id: 'u1', title: 'Unit 1', filePath: 'book-library/a/unit-01.pdf' },
            { id: 'u2', title: 'Unit 2', filePath: 'book-library/a/unit-02.pdf' },
          ],
        }),
      ),
    ).toBe(false)
  })

  it('presentation with no units needs outline; with units does not', () => {
    expect(bookNeedsLessonShelfOutline(baseBook({ contentFormat: 'presentation' }))).toBe(true)
    expect(
      bookNeedsLessonShelfOutline(
        baseBook({
          contentFormat: 'presentation',
          units: [{ id: 'u1', title: 'Deck', filePath: 'deck.pdf' }],
        }),
      ),
    ).toBe(false)
  })

  it('buildBookLessonShelfRows emits one unit card per outlined unit', () => {
    const rows = buildBookLessonShelfRows(
      baseBook({
        units: [
          {
            id: 'u1',
            title: 'Unit 1',
            filePath: 'a.pdf',
            startPageHint: 1,
            lessons: [
              { id: 'l1', title: 'First', startPageHint: 2 },
              { id: 'l2', title: 'Second', startPageHint: 8 },
            ],
          },
          {
            id: 'u2',
            title: 'Unit 2',
            filePath: 'a.pdf',
            startPageHint: 20,
            lessons: [{ id: 'l3', title: 'Third', startPageHint: 20 }],
          },
          {
            id: 'u-empty',
            title: 'Empty',
            filePath: 'a.pdf',
          },
        ],
      }),
    )
    expect(rows).toHaveLength(3)
    expect(rows[0]!.unit.id).toBe('u1')
    expect(rows[0]!.cards).toHaveLength(1)
    expect(rows[0]!.cards[0]).toEqual(
      expect.objectContaining({
        kind: 'unit',
        id: 'u1',
        indexLabel: 'U1',
        lessonId: 'l1',
        printedStart: 1,
      }),
    )
    expect(rows[1]!.cards).toHaveLength(1)
    expect(rows[1]!.cards[0]).toEqual(
      expect.objectContaining({
        kind: 'unit',
        id: 'u2',
        lessonId: 'l3',
        printedStart: 20,
      }),
    )
    expect(rows[2]!.cards[0]).toEqual(
      expect.objectContaining({ kind: 'unit', id: 'u-empty' }),
    )
  })

  it('buildBookLessonShelfRows returns empty when there is no outline', () => {
    expect(
      buildBookLessonShelfRows(
        baseBook({
          units: [{ id: 'u1', title: 'Unit 1', filePath: 'a.pdf' }],
        }),
      ),
    ).toEqual([])
  })

  it('buildBookLessonShelfRows shows unit cards for multi-file books without lessons', () => {
    const rows = buildBookLessonShelfRows(
      baseBook({
        units: [
          { id: 'u1', title: 'Unit 1', filePath: 'book-library/a/unit-01.pdf' },
          { id: 'u2', title: 'Unit 2', filePath: 'book-library/a/unit-02.pdf' },
        ],
      }),
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.cards).toEqual([
      expect.objectContaining({ kind: 'unit', id: 'u1', indexLabel: 'U1' }),
    ])
    expect(rows[1]!.cards[0]!.id).toBe('u2')
  })

  it('buildBookLessonShelfRows returns empty when there is nothing to open', () => {
    expect(buildBookLessonShelfRows(baseBook())).toEqual([])
  })

  it('presentation books get unit cards', () => {
    const rows = buildBookLessonShelfRows(
      baseBook({
        contentFormat: 'presentation',
        units: [
          { id: 'u1', title: 'Deck A', filePath: 'a.pdf' },
          { id: 'u2', title: 'Deck B', filePath: 'b.pdf' },
        ],
      }),
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.cards[0]!.kind).toBe('unit')
    expect(rows[0]!.cards[0]!.indexLabel).toBe('U1')
    expect(rows[1]!.cards[0]!.title).toBe('Deck B')
  })

  it('unit cover uses the first page of the unit, not the first story', () => {
    const unit = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'a.pdf',
      startPageHint: 5,
      lessons: [
        {
          id: 'l1',
          title: 'Lesson 1',
          startPageHint: 10,
          parts: [
            { id: 'p-vocab', title: 'Vocab', startPageHint: 10, structureTag: 'vocabulary_in_context' as const },
            { id: 'p-story', title: 'Jump!', startPageHint: 18, structureTag: 'main_story' as const },
            { id: 'p-paired', title: 'Paired', startPageHint: 30, structureTag: 'paired_story' as const },
          ],
        },
      ],
    }
    const book = baseBook({ units: [unit] })
    const rows = buildBookLessonShelfRows(book)
    expect(rows[0]!.cards).toHaveLength(1)
    expect(rows[0]!.cards[0]!.kind).toBe('unit')
    expect(rows[0]!.cards[0]!.printedStart).toBe(5)
    expect(rows[0]!.cards[0]!.lessonId).toBe('l1')
    expect(resolveUnitShelfThumbPrintedStart(unit)).toBe(5)
    expect(resolveLessonShelfThumbPrintedStart(unit, unit.lessons[0]!, 0)).toBe(18)
    expect(resolveLessonShelfCardPdfPage(book, unit, rows[0]!.cards[0]!, 100)).toBe(5)
  })

  it('unit cover stays on unit start across lessons with stories', () => {
    const unit = {
      id: 'u1',
      title: 'Good Citizens',
      filePath: 'a.pdf',
      startPageHint: 11,
      lessons: [
        {
          id: 'l1',
          title: 'Lesson 1',
          startPageHint: 10,
          parts: [
            { id: 'p-vocab', title: 'Vocabulary in Context', startPageHint: 10 },
            { id: 'p-comp', title: 'Comprehension', startPageHint: 13 },
            { id: 'p-story', title: 'A Fine, Fine School', startPageHint: 14 },
          ],
        },
        {
          id: 'l2',
          title: 'Lesson 2',
          startPageHint: 42,
          parts: [
            { id: 'p2-vocab', title: 'Vocabulary in Context', startPageHint: 42 },
            { id: 'p2-comp', title: 'Comprehension', startPageHint: 45 },
            { id: 'p2-story', title: 'The Trial of Cardigan Jones', startPageHint: 46 },
          ],
        },
      ],
    }
    const book = baseBook({
      id: 'journeys-g3-book-1',
      title: 'Journeys Grade 3',
      units: [unit],
    })
    const rows = buildBookLessonShelfRows(book)
    expect(rows[0]!.cards).toHaveLength(1)
    expect(rows[0]!.cards[0]!.printedStart).toBe(11)
    expect(rows[0]!.cards[0]!.lessonId).toBe('l1')
    expect(resolveUnitShelfThumbPrintedStart(unit, 'journeys')).toBe(11)
  })

  it('lesson thumb falls back to paired_story then lesson start; unit thumb uses unit start', () => {
    const withPaired = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'a.pdf',
      startPageHint: 8,
      lessons: [
        {
          id: 'l1',
          title: 'Lesson 1',
          startPageHint: 10,
          parts: [
            { id: 'p1', title: 'Warm-up', startPageHint: 10, structureTag: 'unspecified' as const },
            { id: 'p2', title: 'Paired', startPageHint: 22, structureTag: 'paired_story' as const },
          ],
        },
      ],
    }
    expect(resolveLessonShelfThumbPrintedStart(withPaired, withPaired.lessons[0]!, 0)).toBe(22)
    expect(resolveUnitShelfThumbPrintedStart(withPaired)).toBe(8)

    const bare = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'a.pdf',
      startPageHint: 14,
      lessons: [{ id: 'l1', title: 'Lesson 1', startPageHint: 14 }],
    }
    expect(resolveLessonShelfThumbPrintedStart(bare, bare.lessons[0]!, 0)).toBe(14)
    expect(resolveUnitShelfThumbPrintedStart(bare)).toBe(14)
  })

  it('lesson thumb uses Journeys slot when story title has no structureTag; unit thumb uses unit start', () => {
    const unit = {
      id: 'u1',
      title: 'Unit 3',
      filePath: 'a.pdf',
      startPageHint: 420,
      lessons: [
        {
          id: 'l13',
          title: 'Lesson 13',
          startPageHint: 426,
          parts: [
            { id: 'p0', title: 'Vocabulary in Context', startPageHint: 426 },
            { id: 'p1', title: 'Comprehension', startPageHint: 429 },
            { id: 'p2', title: 'Yonder Mountain', startPageHint: 430 },
          ],
        },
      ],
    }
    expect(resolveLessonShelfThumbPrintedStart(unit, unit.lessons[0]!, 0)).toBe(430)
    expect(resolveUnitShelfThumbPrintedStart(unit, 'journeys')).toBe(420)
    const book = baseBook({ id: 'journeys-g3', title: 'Journeys', units: [unit] })
    const rows = buildBookLessonShelfRows(book)
    expect(rows[0]!.cards[0]!.printedStart).toBe(420)
  })

  it('resolveLessonShelfCardPdfPage uses unit first page with no offset', () => {
    const book = baseBook({
      units: [
        {
          id: 'u1',
          title: 'Unit 1',
          filePath: 'a.pdf',
          startPageHint: 10,
          lessons: [
            {
              id: 'l1',
              title: 'First',
              startPageHint: 10,
              parts: [
                { id: 'p-vocab', title: 'Vocab', startPageHint: 10, structureTag: 'vocabulary_in_context' as const },
                { id: 'p-story', title: 'Story', startPageHint: 20, structureTag: 'main_story' as const },
              ],
            },
          ],
        },
      ],
      pageAlignmentByFile: {
        'a.pdf': { notCountedPdfPages: [], hiddenPdfPages: [] },
      },
    })
    const rows = buildBookLessonShelfRows(book)
    const card = rows[0]!.cards[0]!
    expect(card.printedStart).toBe(10)
    expect(resolveLessonShelfCardPdfPage(book, rows[0]!.unit, card, 100)).toBe(10)
  })

  it('resolveLessonShelfCardPdfPage respects not-counted pages for unit covers', () => {
    const book = baseBook({
      units: [
        {
          id: 'u1',
          title: 'Unit 1',
          filePath: 'a.pdf',
          startPageHint: 10,
          lessons: [
            {
              id: 'l1',
              title: 'First',
              startPageHint: 10,
              parts: [
                { id: 'p-story', title: 'Jump!', startPageHint: 10, structureTag: 'main_story' as const },
              ],
            },
          ],
        },
      ],
      pageAlignmentByFile: {
        'a.pdf': { notCountedPdfPages: [3], hiddenPdfPages: [] },
      },
    })
    const rows = buildBookLessonShelfRows(book)
    const card = rows[0]!.cards[0]!
    // printed 10 with ghost PDF 3 → PDF 11
    expect(resolveLessonShelfCardPdfPage(book, rows[0]!.unit, card, 50)).toBe(11)
  })
})
