import { describe, expect, it } from 'vitest'
import { bookHasTocMapping, stripBookTocMapping } from '@/lib/books/strip-book-toc-mapping'
import type { BookRecord } from '@/lib/books/types'

const baseBook: BookRecord = {
  id: 'b1',
  title: 'Test',
  units: [
    { id: 'u1', title: 'A', filePath: 'book-library/x/full.pdf', lessons: [{ id: 'l1', title: 'Lesson 1' }] },
    { id: 'u2', title: 'B', filePath: 'book-library/x/full.pdf' },
  ],
}

describe('stripBookTocMapping', () => {
  it('collapses same filePath and removes lesson trees', () => {
    const cleared = stripBookTocMapping(baseBook)
    expect(cleared.units).toHaveLength(1)
    expect(cleared.units[0]!.filePath).toBe('book-library/x/full.pdf')
    expect(cleared.units[0]!.lessons).toBeUndefined()
  })

  it('bookHasTocMapping detects lesson trees', () => {
    expect(bookHasTocMapping(baseBook)).toBe(true)
    expect(
      bookHasTocMapping({
        ...baseBook,
        units: [{ id: 'u', title: 'A', filePath: 'book-library/x/a.pdf' }],
      }),
    ).toBe(false)
    expect(
      bookHasTocMapping({
        ...baseBook,
        units: [{ id: 'u', title: 'A', filePath: 'book-library/x/a.pdf', lessons: [{ id: 'l', title: 'L' }] }],
      }),
    ).toBe(true)
  })
})
