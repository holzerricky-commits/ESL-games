import { describe, expect, it } from 'vitest'
import { dedupeBooksById } from '@/lib/books/dedupe-book-library'
import type { BookRecord } from '@/lib/books/types'

function book(partial: Partial<BookRecord> & Pick<BookRecord, 'id' | 'title'>): BookRecord {
  return {
    units: [{ id: `${partial.id}-u1`, title: 'U1', filePath: `book-library/${partial.id}/book.pdf` }],
    ...partial,
  }
}

describe('dedupeBooksById', () => {
  it('keeps a single entry per id', () => {
    const a = book({ id: 'journeys-g3-book-1', title: 'A' })
    const b = book({ id: 'journeys-g3-book-1', title: 'B' })
    const c = book({ id: 'journeys-g4', title: 'C' })
    const out = dedupeBooksById([a, b, c])
    expect(out.map((row) => row.id)).toEqual(['journeys-g3-book-1', 'journeys-g4'])
  })

  it('prefers the copy with a richer outline', () => {
    const thin = book({ id: 'x', title: 'Thin' })
    const rich: BookRecord = {
      id: 'x',
      title: 'Rich',
      series: 'Journeys',
      units: [
        {
          id: 'u1',
          title: 'U1',
          filePath: 'book-library/x/book.pdf',
          lessons: [{ id: 'l1', title: 'L1', parts: [{ id: 'p1', title: 'P1' }] }],
        },
      ],
    }
    const out = dedupeBooksById([thin, rich])
    expect(out).toHaveLength(1)
    expect(out[0]?.title).toBe('Rich')
    expect(out[0]?.series).toBe('Journeys')
  })
})
