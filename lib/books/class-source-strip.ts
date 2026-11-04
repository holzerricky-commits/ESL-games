import {
  lessonBoardBookAccentColor,
  lessonBoardDisplayLabel,
} from '@/lib/books/lesson-board-nav'
import type { BookLibraryPayload } from '@/lib/books/types'

export type ClassSourceBookChip = {
  bookId: string
  unitId: string
  displayLabel: string
  bookTitle: string
  accentColor: string
  page: number | null
}

export type ClassSourceFocus = 'book' | 'notebook'

/** How Notebook sits on the desk this class. `null` = not opened yet. */
export type ClassSourceNotebookLayout = 'park' | 'pin' | 'overlay' | 'tab'

export type ClassSourceNotebookPresence = 'off' | 'present' | 'tab'

export function formatClassSourcePageLabel(page: number | null | undefined): string | null {
  if (page == null || !Number.isFinite(page) || page < 1) return null
  return `p.${Math.floor(page)}`
}

export function classSourceNotebookFocusStorageKey(studentId: string): string {
  return `esl-class-source-notebook-focus:${studentId.trim()}`
}

export function readClassSourceNotebookFocus(studentId: string): boolean {
  const id = studentId.trim()
  if (!id) return false
  try {
    return globalThis.sessionStorage?.getItem(classSourceNotebookFocusStorageKey(id)) === '1'
  } catch {
    return false
  }
}

export function writeClassSourceNotebookFocus(studentId: string, focused: boolean): void {
  const id = studentId.trim()
  if (!id) return
  try {
    const key = classSourceNotebookFocusStorageKey(id)
    if (focused) globalThis.sessionStorage?.setItem(key, '1')
    else globalThis.sessionStorage?.removeItem(key)
  } catch {
    // ignore quota / private mode
  }
}

export function classSourceNotebookLayoutStorageKey(studentId: string): string {
  return `esl-class-source-notebook-layout:${studentId.trim()}`
}

const NOTEBOOK_LAYOUTS: readonly ClassSourceNotebookLayout[] = ['park', 'pin', 'overlay', 'tab']

export function parseClassSourceNotebookLayout(raw: string | null | undefined): ClassSourceNotebookLayout | null {
  if (!raw) return null
  return NOTEBOOK_LAYOUTS.includes(raw as ClassSourceNotebookLayout)
    ? (raw as ClassSourceNotebookLayout)
    : null
}

export function readClassSourceNotebookLayout(studentId: string): ClassSourceNotebookLayout | null {
  const id = studentId.trim()
  if (!id) return null
  try {
    const stored = parseClassSourceNotebookLayout(
      globalThis.sessionStorage?.getItem(classSourceNotebookLayoutStorageKey(id)),
    )
    if (stored) return stored
    return readClassSourceNotebookFocus(id) ? 'tab' : null
  } catch {
    return null
  }
}

export function writeClassSourceNotebookLayout(
  studentId: string,
  layout: ClassSourceNotebookLayout | null,
): void {
  const id = studentId.trim()
  if (!id) return
  try {
    const key = classSourceNotebookLayoutStorageKey(id)
    if (layout) globalThis.sessionStorage?.setItem(key, layout)
    else globalThis.sessionStorage?.removeItem(key)
    writeClassSourceNotebookFocus(id, layout === 'tab')
  } catch {
    // ignore quota / private mode
  }
}

export function resolveClassSourceNotebookLayout(args: {
  sessionOpen: boolean
  minimized: boolean
  notebookFocus: boolean
  floating: boolean
}): ClassSourceNotebookLayout | null {
  if (!args.sessionOpen) return null
  if (args.minimized) return 'park'
  if (args.notebookFocus) return 'tab'
  if (args.floating) return 'overlay'
  return 'pin'
}

/** Strip chrome: Tab is selected; Pin/Overlay are present; Park looks off. */
export function resolveClassSourceNotebookPresence(args: {
  notebookFocus: boolean
  notebookOnDesk: boolean
}): ClassSourceNotebookPresence {
  if (args.notebookFocus) return 'tab'
  if (args.notebookOnDesk) return 'present'
  return 'off'
}

/** Exactly one material Focus (books vs Notebook Tab). Review is a separate mode, not Focus. Notebook Tab outranks the teaching book chip. */
export function resolveClassSourceStripSelection(args: {
  focusedBookId: string | null
  notebookFocus: boolean
}): { focusedBookId: string | null; notebookFocused: boolean } {
  if (args.notebookFocus) {
    return { focusedBookId: null, notebookFocused: true }
  }
  return { focusedBookId: args.focusedBookId, notebookFocused: false }
}

/** Overlay `1` / `2` — same order as the shelf chips. Ignores other keys. */
export function classSourceBookForDigitKey(
  books: readonly ClassSourceBookChip[],
  key: string,
): ClassSourceBookChip | null {
  if (key !== '1' && key !== '2') return null
  return books[Number(key) - 1] ?? null
}

export type ClassSourceBookPlace = { unitId: string; pdfPage: number }

function resolveUnitIdForBook(args: {
  book: BookLibraryPayload['books'][number]
  assignedUnitRefs: readonly { bookId: string; unitId: string }[]
  openBookId: string | null
  openUnitId: string | null
  placeUnitId?: string | null
}): string | null {
  if (args.openBookId === args.book.id && args.openUnitId) {
    const openUnit = args.book.units.find((unit) => unit.id === args.openUnitId)
    if (openUnit) return openUnit.id
  }
  const placeUnitId = args.placeUnitId?.trim()
  if (placeUnitId) {
    const placeUnit = args.book.units.find((unit) => unit.id === placeUnitId)
    if (placeUnit) return placeUnit.id
  }
  for (const ref of args.assignedUnitRefs) {
    if (ref.bookId !== args.book.id) continue
    const unit = args.book.units.find((u) => u.id === ref.unitId)
    if (unit) return unit.id
  }
  return args.book.units[0]?.id ?? null
}

/**
 * Assigned books (assignment order) as class source chips.
 * Always includes the currently open book even if it is not assigned.
 * Prefer `getPlaceForBook` (session / student place) over assignment defaults for unit + page.
 */
export function listClassSourceBooks(args: {
  library: Pick<BookLibraryPayload, 'books'>
  assignedBookIds?: readonly string[]
  assignedUnitRefs?: readonly { bookId: string; unitId: string }[]
  openBookId?: string | null
  openUnitId?: string | null
  openPage?: number | null
  getSavedPage?: (bookId: string, unitId: string) => number | null
  /** Student / session place for a book — wins unit + page when the book is not focused. */
  getPlaceForBook?: (bookId: string) => ClassSourceBookPlace | null
}): ClassSourceBookChip[] {
  const booksById = new Map(args.library.books.map((book) => [book.id, book]))
  const assignedUnitRefs = args.assignedUnitRefs ?? []
  const openBookId = args.openBookId?.trim() || null
  const openUnitId = args.openUnitId?.trim() || null
  const getSavedPage = args.getSavedPage
  const getPlaceForBook = args.getPlaceForBook
  const seen = new Set<string>()
  const chips: ClassSourceBookChip[] = []

  const pushBook = (bookId: string) => {
    const id = bookId.trim()
    if (!id || seen.has(id)) return
    const book = booksById.get(id)
    if (!book) return
    const place = getPlaceForBook?.(id) ?? null
    const unitId = resolveUnitIdForBook({
      book,
      assignedUnitRefs,
      openBookId,
      openUnitId,
      placeUnitId: place?.unitId,
    })
    if (!unitId) return
    seen.add(id)
    const isOpen = openBookId === id
    const placePage =
      place && place.unitId === unitId && Number.isFinite(place.pdfPage) && place.pdfPage >= 1
        ? Math.floor(place.pdfPage)
        : null
    const saved = getSavedPage?.(id, unitId) ?? null
    const page = isOpen
      ? (args.openPage != null && Number.isFinite(args.openPage) && args.openPage >= 1
          ? Math.floor(args.openPage)
          : placePage ?? saved)
      : (placePage ?? saved)
    chips.push({
      bookId: id,
      unitId,
      displayLabel: lessonBoardDisplayLabel(book),
      bookTitle: book.title.trim() || id,
      accentColor: lessonBoardBookAccentColor(id),
      page: page != null && Number.isFinite(page) && page >= 1 ? Math.floor(page) : null,
    })
  }

  for (const bookId of args.assignedBookIds ?? []) {
    pushBook(bookId)
  }
  if (openBookId) pushBook(openBookId)

  return chips
}
