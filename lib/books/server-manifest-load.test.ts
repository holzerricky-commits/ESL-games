import { describe, expect, it } from 'vitest'
import { normalizeManifestBooks } from '@/lib/books/server'

describe('normalizeManifestBooks', () => {
  it('preserves endPageHint and structureTag written by TOC / structure save', () => {
    const books = normalizeManifestBooks([
      {
        id: 'b1',
        title: 'Book',
        units: [
          {
            id: 'u1',
            title: 'Unit 1',
            filePath: 'book-library/book/unit1.pdf',
            startPageHint: 2,
            endPageHint: 12,
            lessons: [
              {
                id: 'l1',
                title: 'Lesson 1',
                startPageHint: 3,
                endPageHint: 6,
                parts: [
                  {
                    id: 'p1',
                    title: 'Part 1',
                    startPageHint: 3,
                    endPageHint: 4,
                    structureTag: 'vocabulary_in_context',
                  },
                ],
              },
            ],
          },
        ],
      },
    ])

    const unit = books[0]?.units[0]
    const lesson = unit?.lessons?.[0]
    const part = lesson?.parts?.[0]
    expect(unit?.endPageHint).toBe(12)
    expect(lesson?.endPageHint).toBe(6)
    expect(part?.endPageHint).toBe(4)
    expect(part?.structureTag).toBe('vocabulary_in_context')
  })

  it('still loads start-only records without inventing end hints', () => {
    const books = normalizeManifestBooks([
      {
        id: 'b1',
        title: 'Book',
        units: [{ id: 'u1', title: 'Unit 1', filePath: 'book-library/book/unit1.pdf', startPageHint: 2 }],
      },
    ])
    expect(books[0]?.units[0]?.startPageHint).toBe(2)
    expect(books[0]?.units[0]?.endPageHint).toBeUndefined()
  })
})
