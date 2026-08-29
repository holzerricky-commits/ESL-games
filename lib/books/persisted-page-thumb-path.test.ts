import { describe, expect, it } from 'vitest'
import {
  bookPageThumbUrl,
  clampPageThumbPage,
  persistedPageThumbRelativePath,
} from '@/lib/books/persisted-page-thumb-path'

describe('persistedPageThumbRelativePath', () => {
  it('puts a jpeg next to the book under thumbs/', () => {
    expect(persistedPageThumbRelativePath('book-library/journeys-g4/student-book.pdf', 12)).toBe(
      'book-library/journeys-g4/thumbs/student-book-p12.jpg',
    )
  })

  it('slugifies nested pdf names', () => {
    expect(
      persistedPageThumbRelativePath('book-library/wonders-g3/units/Unit 1.pdf', 1),
    ).toBe('book-library/wonders-g3/thumbs/units-unit-1-p1.jpg')
  })

  it('returns null when the path is not a book-library pdf', () => {
    expect(persistedPageThumbRelativePath('other/file.pdf', 1)).toBeNull()
    expect(persistedPageThumbRelativePath('book-library/only-folder', 1)).toBeNull()
  })

  it('returns null for invalid pages', () => {
    expect(persistedPageThumbRelativePath('book-library/journeys-g4/u.pdf', 0)).toBeNull()
    expect(persistedPageThumbRelativePath('book-library/journeys-g4/u.pdf', 1.2)).toBe(
      'book-library/journeys-g4/thumbs/u-p1.jpg',
    )
  })
})

describe('bookPageThumbUrl', () => {
  it('encodes the pdf path and page', () => {
    expect(bookPageThumbUrl('book-library/journeys-g4/student-book.pdf', 12)).toBe(
      '/api/books/page-thumb?path=book-library%2Fjourneys-g4%2Fstudent-book.pdf&page=12',
    )
  })
})

describe('clampPageThumbPage', () => {
  it('accepts whole pages from 1', () => {
    expect(clampPageThumbPage(1)).toBe(1)
    expect(clampPageThumbPage(40.9)).toBe(40)
  })

  it('rejects out of range', () => {
    expect(clampPageThumbPage(0)).toBeNull()
    expect(clampPageThumbPage(Number.NaN)).toBeNull()
  })
})
