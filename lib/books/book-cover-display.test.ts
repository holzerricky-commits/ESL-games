import { describe, expect, it } from 'vitest'
import {
  bookCoverImageUrl,
  getBookCoverSource,
  bookHasCustomCover,
} from '@/lib/books/book-cover-display'
import type { BookRecord } from '@/lib/books/types'

const baseBook: BookRecord = {
  id: 'journeys',
  title: 'Journeys',
  units: [{ id: 'u1', title: 'Unit 1', filePath: 'book-library/journeys/unit1.pdf' }],
}

describe('getBookCoverSource', () => {
  it('prefers custom cover image over PDF', () => {
    const book: BookRecord = {
      ...baseBook,
      coverImagePath: 'book-library/journeys/cover.jpg',
    }
    expect(getBookCoverSource(book)).toEqual({
      kind: 'image',
      imagePath: 'book-library/journeys/cover.jpg',
    })
  })

  it('falls back to first unit PDF page 1', () => {
    expect(getBookCoverSource(baseBook)).toEqual({
      kind: 'pdf',
      filePath: 'book-library/journeys/unit1.pdf',
      pageNumber: 1,
    })
  })

  it('returns null when book has no units', () => {
    expect(getBookCoverSource({ ...baseBook, units: [] })).toBeNull()
  })

  it('uses custom pdf page when provided', () => {
    expect(getBookCoverSource(baseBook, 3)).toEqual({
      kind: 'pdf',
      filePath: 'book-library/journeys/unit1.pdf',
      pageNumber: 3,
    })
  })
})

describe('bookCoverImageUrl', () => {
  it('wraps path in book-file API', () => {
    expect(bookCoverImageUrl('book-library/journeys/cover.jpg')).toBe(
      '/api/book-file?path=book-library%2Fjourneys%2Fcover.jpg',
    )
  })
})

describe('bookHasCustomCover', () => {
  it('is true when coverImagePath is set', () => {
    expect(bookHasCustomCover({ ...baseBook, coverImagePath: 'book-library/x/cover.png' })).toBe(true)
  })

  it('is false when coverImagePath is missing or blank', () => {
    expect(bookHasCustomCover(baseBook)).toBe(false)
    expect(bookHasCustomCover({ ...baseBook, coverImagePath: '  ' })).toBe(false)
  })
})
