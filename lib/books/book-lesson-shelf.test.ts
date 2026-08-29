import { describe, expect, it } from 'vitest'
import {
  bookHasBrowsablePdf,
  bookNeedsLessonShelfOutline,
  buildBookLessonShelfRows,
  resolveLessonShelfCardPdfPage,
  resolveLessonShelfThumbPrintedStart,
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

  it('buildBookLessonShelfRows groups lessons by unit in order', () => {
    const rows = buildBookLessonShelfRows(
      baseBook({
        units: [
          {
            id: 'u1',
            title: 'Unit 1',
            filePath: 'a.pdf',
            lessons: [
              { id: 'l1', title: 'First', startPageHint: 2 },
              { id: 'l2', title: 'Second', startPageHint: 8 },
            ],
          },
          {
            id: 'u2',
            title: 'Unit 2',
            filePath: 'a.pdf',
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
    expect(rows).toHaveLength(2)
    expect(rows[0]!.unit.id).toBe('u1')
    expect(rows[0]!.cards.map((c) => c.id)).toEqual(['l1', 'l2'])
    expect(rows[0]!.cards[0]!.indexLabel).toBe('L1')
    expect(rows[0]!.cards[0]!.printedStart).toBe(2)
    expect(rows[1]!.cards[0]!.id).toBe('l3')
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

  it('thumb prefers main_story over lesson start', () => {
    const unit = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'a.pdf',
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
    expect(rows[0]!.cards[0]!.printedStart).toBe(18)
    expect(resolveLessonShelfThumbPrintedStart(unit, unit.lessons[0]!, 0)).toBe(18)
    expect(resolveLessonShelfCardPdfPage(book, unit, rows[0]!.cards[0]!, 100)).toBe(18)
  })

  it('thumb falls back to paired_story then lesson start', () => {
    const withPaired = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'a.pdf',
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

    const bare = {
      id: 'u1',
      title: 'Unit 1',
      filePath: 'a.pdf',
      lessons: [{ id: 'l1', title: 'Lesson 1', startPageHint: 14 }],
    }
    expect(resolveLessonShelfThumbPrintedStart(bare, bare.lessons[0]!, 0)).toBe(14)
  })

  it('resolveLessonShelfCardPdfPage uses outline start with no offset', () => {
    const book = baseBook({
      units: [
        {
          id: 'u1',
          title: 'Unit 1',
          filePath: 'a.pdf',
          lessons: [
            { id: 'l1', title: 'First', startPageHint: 10 },
            { id: 'l2', title: 'Second', startPageHint: 20 },
          ],
        },
      ],
      pageAlignmentByFile: {
        'a.pdf': { notCountedPdfPages: [], hiddenPdfPages: [] },
      },
    })
    const rows = buildBookLessonShelfRows(book)
    const card = rows[0]!.cards[1]!
    expect(resolveLessonShelfCardPdfPage(book, rows[0]!.unit, card, 100)).toBe(20)
  })

  it('resolveLessonShelfCardPdfPage respects not-counted pages', () => {
    const book = baseBook({
      units: [
        {
          id: 'u1',
          title: 'Unit 1',
          filePath: 'a.pdf',
          lessons: [{ id: 'l1', title: 'First', startPageHint: 10 }],
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
