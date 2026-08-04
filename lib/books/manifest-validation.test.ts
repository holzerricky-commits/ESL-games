import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bookLibraryPayloadSchema,
  resolveBookLibraryFolderName,
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

describe('resolveBookLibraryFolderName', () => {
  const cwd = process.cwd()
  const libraryRoot = path.resolve(cwd, 'book-library')

  it('returns the book folder for a normal unit path', () => {
    expect(resolveBookLibraryFolderName('book-library/MyBook/unit.pdf', cwd, libraryRoot)).toBe('MyBook')
  })

  it('derives the folder from the resolved path, not raw ../ segments', () => {
    expect(
      resolveBookLibraryFolderName('book-library/../book-library/MyBook/unit.pdf', cwd, libraryRoot),
    ).toBe('MyBook')
  })

  it('rejects paths that resolve outside book-library', () => {
    expect(resolveBookLibraryFolderName('book-library/../outside/x.pdf', cwd, libraryRoot)).toBeNull()
  })

  it('rejects a bare .. segment extracted from an otherwise accepted library path', () => {
    // Old regex `book-library/([^/]+)/` would return ".." here.
    expect(resolveBookLibraryFolderName('book-library/../book-library/foo.pdf', cwd, libraryRoot)).toBeNull()
  })
})
