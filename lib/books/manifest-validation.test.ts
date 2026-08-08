import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { bookLibraryPayloadSchema, isBookLibraryFilePath } from '@/lib/books/manifest-validation'

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
})

describe('isBookLibraryFilePath', () => {
  const cwd = '/workspace/project'
  const libraryRoot = path.resolve(cwd, 'book-library')

  it('allows files inside book-library', () => {
    expect(isBookLibraryFilePath('book-library/book/unit1.pdf', cwd, libraryRoot)).toBe(true)
    expect(isBookLibraryFilePath('/book-library/book/unit1.pdf', cwd, libraryRoot)).toBe(true)
  })

  it('rejects sibling folders that only share the book-library prefix', () => {
    expect(isBookLibraryFilePath('book-library-private/secrets.pdf', cwd, libraryRoot)).toBe(false)
    expect(isBookLibraryFilePath('book-library/../book-library-private/secrets.pdf', cwd, libraryRoot)).toBe(false)
  })
})
