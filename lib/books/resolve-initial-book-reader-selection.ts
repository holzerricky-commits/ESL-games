import type { BookLibraryPayload } from '@/lib/books/types'
import { clampPdfPage, getUnitReaderBounds } from '@/lib/books/page-range'
import { getSavedUnitPage } from '@/lib/books/progress'

/** Same shape as `curriculumHistory` on the student profile / fullscreen overlay. */
export interface BookReaderCurriculumHistoryEntry {
  id: string
  bookId: string
  unitId: string
  page: number
  openedAt: string
  closedAt?: string
}

export interface ResolveInitialBookReaderSelectionArgs {
  library: BookLibraryPayload
  assignedBookIds: string[]
  assignedUnitRefs: Array<{ bookId: string; unitId: string }>
  curriculumHistory: BookReaderCurriculumHistoryEntry[]
}

export interface InitialBookReaderSelection {
  selectedBookId: string | null
  selectedUnitId: string | null
  pageNumber: number
}

/**
 * Picks default book/unit/page for the fullscreen reader — must stay aligned with
 * `useBookLibraryLoader` behaviour (single source for product rules).
 */
export function resolveInitialBookReaderSelection({
  library,
  assignedBookIds,
  assignedUnitRefs,
  curriculumHistory,
}: ResolveInitialBookReaderSelectionArgs): InitialBookReaderSelection {
  const booksById = new Map(library.books.map((book) => [book.id, book]))
  const sortedHistory = [...curriculumHistory].sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  )
  const assignedBookIdSet = new Set(assignedBookIds)
  const historyCandidates =
    assignedBookIds.length > 0
      ? sortedHistory.filter((entry) => assignedBookIdSet.has(entry.bookId))
      : sortedHistory

  let selectedBook = null as (typeof library.books)[number] | null
  let selectedUnit: (typeof library.books)[number]['units'][number] | null = null
  let initialPage: number | null = null

  for (const ref of assignedUnitRefs) {
    const book = booksById.get(ref.bookId)
    if (!book) continue
    const unit = book.units.find((u) => u.id === ref.unitId)
    if (!unit) continue
    selectedBook = book
    selectedUnit = unit
    initialPage = null
    break
  }

  if (!selectedBook || !selectedUnit) {
    for (const bookId of assignedBookIds) {
      const book = booksById.get(bookId)
      if (!book) continue
      if (book.units.length > 0) {
        selectedBook = book
        selectedUnit = book.units[0] ?? null
        initialPage = null
        break
      }
      if (!selectedBook) {
        selectedBook = book
      }
    }
  }

  if (!selectedBook || !selectedUnit) {
    for (const entry of historyCandidates) {
      const book = booksById.get(entry.bookId)
      if (!book) continue
      const unit = book.units.find((u) => u.id === entry.unitId)
      if (!unit) continue
      selectedBook = book
      selectedUnit = unit
      initialPage = Number.isFinite(entry.page) ? Math.max(1, Math.floor(entry.page)) : 1
      break
    }
  }

  const selectedBookId = selectedBook?.id ?? null
  const selectedUnitId = selectedUnit?.id ?? null

  if (selectedUnit && selectedBook) {
    const bounds = getUnitReaderBounds(selectedUnit, null, selectedBook ?? undefined)
    const seededPage = initialPage ?? getSavedUnitPage(selectedBook.id, selectedUnit.id)
    return {
      selectedBookId,
      selectedUnitId,
      pageNumber: clampPdfPage(seededPage, bounds),
    }
  }

  return { selectedBookId, selectedUnitId, pageNumber: 1 }
}
