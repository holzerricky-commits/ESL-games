import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bookLibraryPayloadSchema,
  isBookLibraryFilePath,
  resolveBookFolderFromLibraryFilePath,
} from '@/lib/books/manifest-validation'

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

describe('book library path helpers', () => {
  const cwd = path.resolve('/tmp/esl-app')
  const libraryRoot = path.resolve(cwd, 'book-library')

  it('rejects sibling folders that only share the book-library prefix', () => {
    expect(isBookLibraryFilePath('book-library/book-a/unit.pdf', cwd, libraryRoot)).toBe(true)
    expect(isBookLibraryFilePath('book-library2/leak.pdf', cwd, libraryRoot)).toBe(false)
  })

  it('derives the real book folder after path normalization', () => {
    expect(
      resolveBookFolderFromLibraryFilePath(
        'book-library/../book-library/book-a/unit.pdf',
        cwd,
        libraryRoot,
      ),
    ).toBe('book-a')
    expect(
      resolveBookFolderFromLibraryFilePath('book-library/../supporting/leak.pdf', cwd, libraryRoot),
    ).toBeNull()
  })
})
