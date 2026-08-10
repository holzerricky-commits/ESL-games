import { describe, expect, it } from 'vitest'
import { bookLibraryPayloadSchema } from '@/lib/books/manifest-validation'

describe('bookLibraryPayloadSchema', () => {
  it('accepts anchored unit, lesson, and part page hints', () => {
    const payload = {
      books: [
        {
          id: 'b1',
          title: 'Book',
          pageAlignmentByFile: {
            'book-library/book/unit1.pdf': {
              notCountedPdfPages: [8, 9],
              hiddenPdfPages: [11],
            },
          },
          units: [
            {
              id: 'u1',
              title: 'Unit 1',
              filePath: 'book-library/book/unit1.pdf',
              startPageHint: 2,
              endPageHint: 12,
              anchorConfidence: 'medium',
              anchorSource: 'toc',
              lessons: [
                {
                  id: 'l1',
                  title: 'Lesson 1',
                  startPageHint: 3,
                  endPageHint: 6,
                  anchorConfidence: 'high',
                  anchorSource: 'toc',
                  parts: [
                    {
                      id: 'p1',
                      title: 'Part 1',
                      startPageHint: 3,
                      endPageHint: 4,
                      anchorConfidence: 'high',
                      anchorSource: 'toc',
                      structureTag: 'vocabulary_in_context',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(bookLibraryPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('accepts optional coverImagePath on a book', () => {
    const payload = {
      books: [
        {
          id: 'b1',
          title: 'Book',
          coverImagePath: 'book-library/journeys/cover.jpg',
          units: [{ id: 'u1', title: 'Unit 1', filePath: 'book-library/journeys/unit1.pdf' }],
        },
      ],
    }
    expect(bookLibraryPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('remains backward compatible with start-only records', () => {
    const payload = {
      books: [
        {
          id: 'b1',
          title: 'Book',
          units: [{ id: 'u1', title: 'Unit 1', filePath: 'book-library/book/unit1.pdf', startPageHint: 2 }],
        },
      ],
    }
    expect(bookLibraryPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('accepts series, grade, and role on a book', () => {
    const payload = {
      books: [
        {
          id: 'b1',
          title: 'Journeys Grade 3 — Student book',
          series: 'Journeys',
          grade: 'G3',
          role: 'Student book',
          units: [{ id: 'u1', title: 'Unit 1', filePath: 'book-library/journeys/unit1.pdf' }],
        },
      ],
    }
    expect(bookLibraryPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('rejects duplicate book ids', () => {
    const unit = { id: 'u1', title: 'Unit 1', filePath: 'book-library/b/unit1.pdf' }
    const payload = {
      books: [
        { id: 'same', title: 'A', units: [unit] },
        { id: 'same', title: 'B', units: [unit] },
      ],
    }
    const result = bookLibraryPayloadSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})
