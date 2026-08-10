import { describe, expect, it } from 'vitest'
import {
  bookMatchesLibrarySearch,
  filterBooksByLibrarySearch,
  groupBooksIntoSeriesShelves,
  partitionBooksForStudentPin,
} from '@/lib/books/book-library-shelves'
import type { BookRecord } from '@/lib/books/types'

function book(partial: Partial<BookRecord> & Pick<BookRecord, 'id' | 'title'>): BookRecord {
  return {
    units: [{ id: `${partial.id}-u1`, title: 'U1', filePath: `book-library/${partial.id}/book.pdf` }],
    ...partial,
  }
}

describe('groupBooksIntoSeriesShelves', () => {
  it('groups by series and sorts presets then grade', () => {
    const shelves = groupBooksIntoSeriesShelves([
      book({ id: 'j-g4', title: 'Journeys G4', series: 'Journeys', grade: 'G4' }),
      book({ id: 'w-g3', title: 'Wonders G3', series: 'Wonders', grade: 'G3' }),
      book({ id: 'j-g3', title: 'Journeys G3', series: 'Journeys', grade: 'G3' }),
      book({ id: 'misc', title: 'Random', series: 'Other' }),
    ])

    expect(shelves.map((shelf) => shelf.series)).toEqual(['Journeys', 'Wonders', 'Other'])
    expect(shelves[0]?.books.map((row) => row.id)).toEqual(['j-g3', 'j-g4'])
    expect(shelves[0]?.useGradeGroups).toBe(false)
    expect(shelves[0]?.gradeGroups).toEqual([])
  })

  it('infers series when missing on the book record', () => {
    const shelves = groupBooksIntoSeriesShelves([
      book({ id: 'journeys-g2', title: 'journeys g2 book1' }),
    ])
    expect(shelves).toHaveLength(1)
    expect(shelves[0]?.series).toBe('Journeys')
  })

  it('nests Wonders by grade when a grade has multiple roles', () => {
    const shelves = groupBooksIntoSeriesShelves([
      book({
        id: 'w-g3-lit',
        title: 'Wonders Grade 3 — Literature',
        series: 'Wonders',
        grade: 'G3',
        role: 'Literature',
      }),
      book({
        id: 'w-g2-ws',
        title: 'Wonders Grade 2 — Workshop',
        series: 'Wonders',
        grade: 'G2',
        role: 'Workshop',
      }),
      book({
        id: 'w-g3-ws',
        title: 'Wonders Grade 3 — Workshop',
        series: 'Wonders',
        grade: 'G3',
        role: 'Workshop',
      }),
    ])

    expect(shelves).toHaveLength(1)
    const wonders = shelves[0]!
    expect(wonders.useGradeGroups).toBe(true)
    expect(wonders.gradeGroups.map((group) => group.gradeKey)).toEqual(['G2', 'G3'])
    expect(wonders.gradeGroups[0]?.books.map((row) => row.id)).toEqual(['w-g2-ws'])
    expect(wonders.gradeGroups[1]?.books.map((row) => row.id)).toEqual(['w-g3-ws', 'w-g3-lit'])
    expect(wonders.gradeGroups[1]?.gradeLabel).toBe('Grade 3')
  })

  it('keeps Journeys flat when each grade has one book', () => {
    const shelves = groupBooksIntoSeriesShelves([
      book({
        id: 'j-g4',
        title: 'Journeys Grade 4 — Student book',
        series: 'Journeys',
        grade: 'G4',
        role: 'Student book',
      }),
      book({
        id: 'j-g3',
        title: 'Journeys Grade 3 — Student book',
        series: 'Journeys',
        grade: 'G3',
        role: 'Student book',
      }),
      book({
        id: 'j-g2',
        title: 'Journeys Grade 2 — Student book',
        series: 'Journeys',
        grade: 'G2',
        role: 'Student book',
      }),
    ])

    expect(shelves).toHaveLength(1)
    expect(shelves[0]?.useGradeGroups).toBe(false)
    expect(shelves[0]?.gradeGroups).toEqual([])
    expect(shelves[0]?.books.map((row) => row.id)).toEqual(['j-g2', 'j-g3', 'j-g4'])
  })
})

describe('bookMatchesLibrarySearch', () => {
  const sample = book({
    id: 'journeys-g3-book-1',
    title: 'Journeys Grade 3 — Student book',
    series: 'Journeys',
    grade: 'G3',
    role: 'Student book',
  })

  it('matches title tokens', () => {
    expect(bookMatchesLibrarySearch(sample, 'grade 3')).toBe(true)
  })

  it('matches series and grade', () => {
    expect(bookMatchesLibrarySearch(sample, 'journeys g3')).toBe(true)
    expect(bookMatchesLibrarySearch(sample, 'wonders')).toBe(false)
  })

  it('matches role', () => {
    expect(bookMatchesLibrarySearch(sample, 'student')).toBe(true)
  })
})

describe('filterBooksByLibrarySearch', () => {
  it('returns all books for empty query', () => {
    const books = [book({ id: 'a', title: 'A' }), book({ id: 'b', title: 'B' })]
    expect(filterBooksByLibrarySearch(books, '  ')).toEqual(books)
  })
})

describe('partitionBooksForStudentPin', () => {
  it('pins assigned books in assignment order and leaves the rest', () => {
    const a = book({ id: 'a', title: 'A', series: 'Journeys' })
    const b = book({ id: 'b', title: 'B', series: 'Wonders' })
    const c = book({ id: 'c', title: 'C', series: 'Other' })
    const { pinned, rest } = partitionBooksForStudentPin([a, b, c], ['b', 'a', 'missing'])
    expect(pinned.map((row) => row.id)).toEqual(['b', 'a'])
    expect(rest.map((row) => row.id)).toEqual(['c'])
  })

  it('returns all books as rest when nothing assigned', () => {
    const books = [book({ id: 'a', title: 'A' })]
    expect(partitionBooksForStudentPin(books, [])).toEqual({ pinned: [], rest: books })
  })
})
