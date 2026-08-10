import { describe, expect, it } from 'vitest'
import {
  applyBookCatalogDefaults,
  bookMatchesPickerFilters,
  BOOK_PICKER_UNLABELED_GRADE,
  formatBookDisplayTitle,
  formatBookGradeChipLabel,
  inferBookCatalogLabels,
  isPresentationBook,
  listBookPickerFacets,
  looksLikePresentationCatalogName,
  resolveBookContentFormat,
  resolveBookPickInitialState,
} from '@/lib/books/book-catalog-labels'
import type { BookRecord } from '@/lib/books/types'

describe('inferBookCatalogLabels', () => {
  it('infers Journeys + G3 + Student book from messy title', () => {
    expect(inferBookCatalogLabels({ title: 'JOURNEYS G3 BOOK 1', id: 'journeys-g3-book-1' })).toEqual({
      series: 'Journeys',
      grade: 'G3',
      role: 'Student book',
    })
  })

  it('infers Journeys + G4 from lowercase title', () => {
    expect(inferBookCatalogLabels({ title: 'journeys g4', id: 'journeys-g4' })).toEqual({
      series: 'Journeys',
      grade: 'G4',
    })
  })

  it('infers Wonders Workshop', () => {
    expect(
      inferBookCatalogLabels({ title: 'Wonders Grade 3 Workshop', folderName: 'wonders-g3-workshop' }),
    ).toEqual({
      series: 'Wonders',
      grade: 'G3',
      role: 'Workshop',
    })
  })

  it('infers HKMKC', () => {
    expect(inferBookCatalogLabels({ title: '2026 hkmkc g01 g02', id: '2026-hkmkc-g01-g02' })).toMatchObject({
      series: 'HKMKC',
      grade: 'G1',
    })
  })

  it('defaults unknown books to Other', () => {
    expect(inferBookCatalogLabels({ title: 'Random PDF dump', id: 'random-pdf' })).toEqual({
      series: 'Other',
    })
  })

  it('infers Kindergarten as K', () => {
    expect(inferBookCatalogLabels({ title: 'grk book1', id: 'grk-book1' })).toMatchObject({
      series: 'Other',
      grade: 'K',
      role: 'Student book',
    })
  })
})

describe('formatBookDisplayTitle', () => {
  it('formats series + grade + role', () => {
    expect(
      formatBookDisplayTitle({ series: 'Journeys', grade: 'G3', role: 'Student book' }),
    ).toBe('Journeys Grade 3 — Student book')
  })

  it('formats Wonders Literature', () => {
    expect(
      formatBookDisplayTitle({ series: 'Wonders', grade: 'G3', role: 'Literature' }),
    ).toBe('Wonders Grade 3 — Literature')
  })
})

describe('applyBookCatalogDefaults', () => {
  it('fills missing labels without overwriting saved series', () => {
    const book: BookRecord = {
      id: 'journeys-g3-book-1',
      title: 'JOURNEYS G3 BOOK 1',
      series: 'Custom Series',
      units: [{ id: 'u1', title: 'U1', filePath: 'book-library/JOURNEYS G3 BOOK 1/book.pdf' }],
    }
    const next = applyBookCatalogDefaults(book)
    expect(next.series).toBe('Custom Series')
    expect(next.grade).toBe('G3')
    expect(next.role).toBe('Student book')
  })

  it('does not change title or id', () => {
    const book: BookRecord = {
      id: 'journeys-g4',
      title: 'journeys g4',
      units: [{ id: 'u1', title: 'U1', filePath: 'book-library/journeys-g4/book.pdf' }],
    }
    const next = applyBookCatalogDefaults(book)
    expect(next.id).toBe('journeys-g4')
    expect(next.title).toBe('journeys g4')
    expect(next.series).toBe('Journeys')
    expect(next.grade).toBe('G4')
  })
})

describe('listBookPickerFacets', () => {
  it('groups series and grades for the picker', () => {
    const books: BookRecord[] = [
      {
        id: 'j3',
        title: 'Journeys G3',
        series: 'Journeys',
        grade: 'G3',
        units: [{ id: 'u1', title: 'U1', filePath: 'a.pdf' }],
      },
      {
        id: 'j4',
        title: 'Journeys G4',
        series: 'Journeys',
        grade: 'G4',
        units: [{ id: 'u1', title: 'U1', filePath: 'b.pdf' }],
      },
      {
        id: 'w3',
        title: 'Wonders G3',
        series: 'Wonders',
        grade: 'G3',
        units: [{ id: 'u1', title: 'U1', filePath: 'c.pdf' }],
      },
      {
        id: 'other',
        title: 'Reading Explorer',
        series: 'Reading Explorer',
        units: [{ id: 'u1', title: 'U1', filePath: 'd.pdf' }],
      },
    ]
    const facets = listBookPickerFacets(books)
    expect(facets.series).toEqual(['Journeys', 'Wonders', 'Reading Explorer'])
    expect(facets.gradesBySeries.Journeys).toEqual(['G3', 'G4'])
    expect(facets.gradesBySeries['Reading Explorer']).toEqual([BOOK_PICKER_UNLABELED_GRADE])
    expect(formatBookGradeChipLabel('G3')).toBe('Grade 3')
    expect(formatBookGradeChipLabel(BOOK_PICKER_UNLABELED_GRADE)).toBe('Unlabeled')
    expect(bookMatchesPickerFilters(books[0]!, { series: 'Journeys', grade: 'G3' })).toBe(true)
    expect(bookMatchesPickerFilters(books[0]!, { series: 'Journeys', grade: 'G4' })).toBe(false)
    expect(bookMatchesPickerFilters(books[0]!, { series: 'Journeys', grade: null })).toBe(true)
  })
})

describe('resolveBookPickInitialState', () => {
  it('starts on series when multiple series exist', () => {
    expect(
      resolveBookPickInitialState([
        {
          id: '1',
          title: 'Journeys G3',
          series: 'Journeys',
          grade: 'G3',
          units: [{ id: 'u1', title: 'U1', filePath: 'a.pdf' }],
        },
        {
          id: '2',
          title: 'Wonders G3',
          series: 'Wonders',
          grade: 'G3',
          units: [{ id: 'u1', title: 'U1', filePath: 'b.pdf' }],
        },
      ]),
    ).toEqual({ step: 'series', series: null, grade: null })
  })

  it('skips to grade when only one series has multiple grades', () => {
    expect(
      resolveBookPickInitialState([
        {
          id: '1',
          title: 'Journeys G3',
          series: 'Journeys',
          grade: 'G3',
          units: [{ id: 'u1', title: 'U1', filePath: 'a.pdf' }],
        },
        {
          id: '2',
          title: 'Journeys G4',
          series: 'Journeys',
          grade: 'G4',
          units: [{ id: 'u1', title: 'U1', filePath: 'b.pdf' }],
        },
      ]),
    ).toEqual({ step: 'grade', series: 'Journeys', grade: null })
  })

  it('skips to book when only one series and one grade', () => {
    expect(
      resolveBookPickInitialState([
        {
          id: '1',
          title: 'Journeys G3 Book 1',
          series: 'Journeys',
          grade: 'G3',
          units: [{ id: 'u1', title: 'U1', filePath: 'a.pdf' }],
        },
        {
          id: '2',
          title: 'Journeys G3 Workshop',
          series: 'Journeys',
          grade: 'G3',
          units: [{ id: 'u1', title: 'U1', filePath: 'b.pdf' }],
        },
      ]),
    ).toEqual({ step: 'book', series: 'Journeys', grade: 'G3' })
  })
})

describe('presentation content format helpers', () => {
  it('detects slide-like filenames', () => {
    expect(looksLikePresentationCatalogName({ title: 'Mia week 3 slides' })).toBe(true)
    expect(looksLikePresentationCatalogName({ title: 'Journeys G3 Book 1' })).toBe(false)
  })

  it('infers Presentations series from slide-like names', () => {
    expect(inferBookCatalogLabels({ title: 'Mia week 3 presentation' })).toEqual({
      series: 'Presentations',
    })
  })

  it('resolves missing contentFormat as book', () => {
    const book: BookRecord = { id: 'a', title: 'A', units: [] }
    expect(resolveBookContentFormat(book)).toBe('book')
    expect(isPresentationBook(book)).toBe(false)
    expect(isPresentationBook({ ...book, contentFormat: 'presentation' })).toBe(true)
  })
})
