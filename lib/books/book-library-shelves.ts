import {
  BOOK_GRADE_PRESETS,
  BOOK_PICKER_UNLABELED_GRADE,
  BOOK_ROLE_PRESETS,
  BOOK_SERIES_PRESETS,
  DEFAULT_BOOK_SERIES,
  formatBookGradeChipLabel,
  resolveBookCatalogIdentity,
} from '@/lib/books/book-catalog-labels'
import type { BookRecord } from '@/lib/books/types'

export const BOOK_LIBRARY_EXPANDED_SERIES_STORAGE_KEY = 'book-library-expanded-series-v1'

export interface BookLibraryGradeGroup {
  gradeKey: string
  gradeLabel: string
  books: BookRecord[]
}

export interface BookLibraryShelf {
  series: string
  books: BookRecord[]
  /** True when any grade in this series has 2+ books (Wonders-style). */
  useGradeGroups: boolean
  /** Populated when useGradeGroups; empty otherwise. */
  gradeGroups: BookLibraryGradeGroup[]
}

function seriesSortIndex(series: string): number {
  if (series === DEFAULT_BOOK_SERIES) return 10_000
  const presetIndex = (BOOK_SERIES_PRESETS as readonly string[]).indexOf(series)
  if (presetIndex >= 0) return presetIndex
  // Custom series after named presets, before Other
  return 100
}

function gradeSortIndex(grade: string | undefined): number {
  if (!grade) return 999
  if (grade === BOOK_PICKER_UNLABELED_GRADE) return 1000
  const idx = BOOK_GRADE_PRESETS.indexOf(grade as (typeof BOOK_GRADE_PRESETS)[number])
  return idx >= 0 ? idx : 500
}

function roleSortIndex(role: string | undefined): number {
  if (!role?.trim()) return 999
  const idx = (BOOK_ROLE_PRESETS as readonly string[]).indexOf(role.trim())
  return idx >= 0 ? idx : 500
}

function gradeKeyForBook(book: BookRecord): string {
  const grade = resolveBookCatalogIdentity(book).grade?.trim()
  return grade || BOOK_PICKER_UNLABELED_GRADE
}

function compareBooksWithinGrade(a: BookRecord, b: BookRecord): number {
  const aId = resolveBookCatalogIdentity(a)
  const bId = resolveBookCatalogIdentity(b)
  const roleCmp = roleSortIndex(aId.role) - roleSortIndex(bId.role)
  if (roleCmp !== 0) return roleCmp
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })
}

function compareBooksFlat(a: BookRecord, b: BookRecord): number {
  const aId = resolveBookCatalogIdentity(a)
  const bId = resolveBookCatalogIdentity(b)
  const gradeCmp = gradeSortIndex(aId.grade) - gradeSortIndex(bId.grade)
  if (gradeCmp !== 0) return gradeCmp
  return compareBooksWithinGrade(a, b)
}

function seriesNeedsGradeGroups(shelfBooks: BookRecord[]): boolean {
  const counts = new Map<string, number>()
  for (const book of shelfBooks) {
    const key = gradeKeyForBook(book)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const count of counts.values()) {
    if (count >= 2) return true
  }
  return false
}

function buildGradeGroups(shelfBooks: BookRecord[]): BookLibraryGradeGroup[] {
  const byGrade = new Map<string, BookRecord[]>()
  for (const book of shelfBooks) {
    const key = gradeKeyForBook(book)
    const list = byGrade.get(key) ?? []
    list.push(book)
    byGrade.set(key, list)
  }

  const keys = Array.from(byGrade.keys()).sort((a, b) => gradeSortIndex(a) - gradeSortIndex(b))

  return keys.map((gradeKey) => {
    const books = [...(byGrade.get(gradeKey) ?? [])].sort(compareBooksWithinGrade)
    return {
      gradeKey,
      gradeLabel: formatBookGradeChipLabel(gradeKey),
      books,
    }
  })
}

/** Group books into series shelves for the Library sidebar. */
export function groupBooksIntoSeriesShelves(books: BookRecord[]): BookLibraryShelf[] {
  const bySeries = new Map<string, BookRecord[]>()

  for (const book of books) {
    const identity = resolveBookCatalogIdentity(book)
    const series = identity.series.trim() || DEFAULT_BOOK_SERIES
    const list = bySeries.get(series) ?? []
    list.push(book)
    bySeries.set(series, list)
  }

  const shelves: BookLibraryShelf[] = Array.from(bySeries.entries()).map(([series, shelfBooks]) => {
    const useGradeGroups = seriesNeedsGradeGroups(shelfBooks)
    const gradeGroups = useGradeGroups ? buildGradeGroups(shelfBooks) : []
    const sorted = useGradeGroups
      ? gradeGroups.flatMap((group) => group.books)
      : [...shelfBooks].sort(compareBooksFlat)
    return { series, books: sorted, useGradeGroups, gradeGroups }
  })

  shelves.sort((a, b) => {
    const ai = seriesSortIndex(a.series)
    const bi = seriesSortIndex(b.series)
    if (ai !== bi) return ai - bi
    return a.series.localeCompare(b.series, undefined, { sensitivity: 'base' })
  })

  return shelves
}

export function readExpandedSeriesFromStorage(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(BOOK_LIBRARY_EXPANDED_SERIES_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return null
  }
}

export function writeExpandedSeriesToStorage(seriesNames: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BOOK_LIBRARY_EXPANDED_SERIES_STORAGE_KEY, JSON.stringify(seriesNames))
  } catch {
    // ignore quota / private mode
  }
}

/** Initial expanded set: remembered shelves that still exist, else selected book's series, else first shelf. */
export function resolveInitialExpandedSeries(options: {
  shelves: BookLibraryShelf[]
  selectedBookId: string | null
  books: BookRecord[]
}): Set<string> {
  const available = new Set(options.shelves.map((shelf) => shelf.series))
  const remembered = readExpandedSeriesFromStorage()
  if (remembered && remembered.length > 0) {
    const kept = remembered.filter((name) => available.has(name))
    if (kept.length > 0) return new Set(kept)
  }

  if (options.selectedBookId) {
    const selected = options.books.find((book) => book.id === options.selectedBookId)
    if (selected) {
      const series = resolveBookCatalogIdentity(selected).series || DEFAULT_BOOK_SERIES
      if (available.has(series)) return new Set([series])
    }
  }

  const first = options.shelves[0]?.series
  return first ? new Set([first]) : new Set()
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** True if title / series / grade / role / id matches the query. */
export function bookMatchesLibrarySearch(book: BookRecord, query: string): boolean {
  const q = normalizeSearchText(query)
  if (!q) return true
  const identity = resolveBookCatalogIdentity(book)
  const formatBit = book.contentFormat === 'presentation' ? 'presentation slides deck powerpoint' : ''
  const haystack = normalizeSearchText(
    [
      book.title,
      book.id,
      identity.series,
      identity.grade ?? '',
      identity.role ?? '',
      book.description ?? '',
      formatBit,
    ].join(' '),
  )
  const tokens = q.split(' ').filter(Boolean)
  return tokens.every((token) => haystack.includes(token))
}

export function filterBooksByLibrarySearch(books: BookRecord[], query: string): BookRecord[] {
  const q = query.trim()
  if (!q) return books
  return books.filter((book) => bookMatchesLibrarySearch(book, q))
}

/**
 * Split library into assigned-for-student (pinned order) vs the rest.
 * Assigned ids that are missing from the library are skipped.
 */
export function partitionBooksForStudentPin(
  books: BookRecord[],
  assignedBookIds: string[] | null | undefined,
): { pinned: BookRecord[]; rest: BookRecord[] } {
  const ids = (assignedBookIds ?? []).map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) {
    return { pinned: [], rest: books }
  }

  const byId = new Map(books.map((book) => [book.id, book]))
  const pinned: BookRecord[] = []
  const pinnedIds = new Set<string>()
  for (const id of ids) {
    const book = byId.get(id)
    if (!book || pinnedIds.has(book.id)) continue
    pinned.push(book)
    pinnedIds.add(book.id)
  }

  const rest = books.filter((book) => !pinnedIds.has(book.id))
  return { pinned, rest }
}
