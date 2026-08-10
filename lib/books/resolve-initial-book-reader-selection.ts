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
  /** Map URL `book` — when valid, opens this book instead of assignment defaults. */
  preferBookId?: string | null
  /** Map URL `unit` — when valid with `preferBookId`, opens this unit. */
  preferUnitId?: string | null
  /** Resume page when `preferBookId` + unit resolve (e.g. from student bookmark/history). */
  preferResumePage?: number | null
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
  preferBookId,
  preferUnitId,
  preferResumePage,
}: ResolveInitialBookReaderSelectionArgs): InitialBookReaderSelection {
  const booksById = new Map(library.books.map((book) => [book.id, book]))
  const explicitBookId = preferBookId?.trim()
  if (explicitBookId) {
    const book = booksById.get(explicitBookId)
    if (book) {
      const explicitUnitId = preferUnitId?.trim()
      const unit = explicitUnitId
        ? (book.units.find((u) => u.id === explicitUnitId) ?? null)
        : (book.units[0] ?? null)
      if (unit) {
        const bounds = getUnitReaderBounds(unit, null, book)
        const resume =
          preferResumePage != null && Number.isFinite(preferResumePage)
            ? Math.max(1, Math.floor(preferResumePage))
            : getSavedUnitPage(book.id, unit.id)
        return {
          selectedBookId: book.id,
          selectedUnitId: unit.id,
          pageNumber: clampPdfPage(resume, bounds),
        }
      }
    }
  }
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

export interface LauncherBookCoverEntry {
  bookId: string
  unitId: string
  filePath: string
  cacheUnitId: string
  bookTitle: string
  /** When set, shown instead of PDF page 1. */
  imagePath?: string
}

/**
 * One cover entry per assigned book (assignment order), for the class welcome shelf.
 * Unit = first assigned unit ref for that book, else the book’s first unit.
 */
export function resolveLauncherBookCovers({
  library,
  assignedBookIds,
  assignedUnitRefs,
}: Pick<
  ResolveInitialBookReaderSelectionArgs,
  'library' | 'assignedBookIds' | 'assignedUnitRefs'
>): LauncherBookCoverEntry[] {
  const booksById = new Map(library.books.map((book) => [book.id, book]))
  const covers: LauncherBookCoverEntry[] = []

  for (const bookId of assignedBookIds) {
    const book = booksById.get(bookId)
    if (!book) continue

    let unit = null as (typeof book.units)[number] | null
    for (const ref of assignedUnitRefs) {
      if (ref.bookId !== book.id) continue
      const matched = book.units.find((u) => u.id === ref.unitId)
      if (matched) {
        unit = matched
        break
      }
    }
    if (!unit) unit = book.units[0] ?? null
    if (!unit) continue

    const coverUnit = book.units[0] ?? unit
    const imagePath = book.coverImagePath?.trim()
    if (!imagePath && !coverUnit.filePath) continue

    covers.push({
      bookId: book.id,
      unitId: unit.id,
      filePath: coverUnit.filePath ?? '',
      cacheUnitId: `${book.id}-launcher-cover`,
      bookTitle: book.title,
      ...(imagePath ? { imagePath } : {}),
    })
  }

  return covers
}

/** First-page cover of the book the fullscreen reader would open for this student. */
export function resolveLauncherBookCover(
  args: ResolveInitialBookReaderSelectionArgs,
): { filePath: string; cacheUnitId: string; bookTitle: string; imagePath?: string } | null {
  const sel = resolveInitialBookReaderSelection(args)
  if (!sel.selectedBookId) return null
  const book = args.library.books.find((b) => b.id === sel.selectedBookId)
  const coverUnit = book?.units[0]
  const imagePath = book?.coverImagePath?.trim()
  if (!book || (!imagePath && !coverUnit?.filePath)) return null
  return {
    filePath: coverUnit?.filePath ?? '',
    cacheUnitId: `${book.id}-launcher-cover`,
    bookTitle: book.title,
    ...(imagePath ? { imagePath } : {}),
  }
}
