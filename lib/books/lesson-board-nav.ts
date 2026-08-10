import { resolveBookCatalogIdentity } from '@/lib/books/book-catalog-labels'
import type { BookLibraryPayload, BookRecord } from '@/lib/books/types'
import { annotationStorageLocalWhiteboardKey } from '@/lib/books/whiteboard-storage'
import {
  peekWhiteboardSession,
  type WhiteboardSessionStorageAdapter,
} from '@/lib/books/whiteboard-session-storage'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'

/** Stable accents for board chrome — secondary to the book title. */
export const LESSON_BOARD_BOOK_ACCENT_PALETTE = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#DB2777',
  '#7C3AED',
  '#0891B2',
  '#DC2626',
  '#4F46E5',
] as const

export function lessonBoardBookAccentColor(bookId: string): string {
  const id = bookId.trim()
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const index = id.length === 0 ? 0 : hash >>> 0
  return LESSON_BOARD_BOOK_ACCENT_PALETTE[index % LESSON_BOARD_BOOK_ACCENT_PALETTE.length]!
}

/** Short fallback when a book has no catalog role. */
export function shortLessonBoardBookTitle(title: string, maxChars = 18): string {
  const trimmed = title.trim()
  if (trimmed.length <= maxChars) return trimmed
  const cut = Math.max(1, maxChars - 1)
  return `${trimmed.slice(0, cut).trimEnd()}…`
}

/**
 * Footer / strip label: prefer catalog role (Workshop, Literature, …), else short title.
 */
export function lessonBoardDisplayLabel(book: BookRecord, maxChars = 22): string {
  const identity = resolveBookCatalogIdentity(book)
  const role = identity.role?.trim()
  if (role) return role
  return shortLessonBoardBookTitle(book.title || book.id, maxChars)
}

export type LessonBoardShelfUnit = {
  unitId: string
  title: string
  /** True when the lasting board has ink, extra pages, or a titled page. */
  hasNotes: boolean
  pageCount: number
  firstPageTitle?: string
}

/** One lasting notebook the student can open from the Boards menu. */
export type LessonBoardShelfEntry = {
  bookId: string
  unitId: string
  /** Role or short title for the strip / primary menu line. */
  displayLabel: string
  /** Full library title for menu secondary / tooltip. */
  bookTitle: string
  /** Unit title when the book has 2+ units; omitted for single-unit books. */
  unitTitle?: string
  accentColor: string
  hasNotes: boolean
  pageCount: number
  firstPageTitle?: string
}

export function lessonBoardDocumentHasNotes(doc: WhiteboardSessionDocument): boolean {
  const pages = doc.pages ?? []
  if (pages.length > 1) return true
  for (const page of pages) {
    if (page.title?.trim()) return true
    if ((page.commands?.length ?? 0) > 0) return true
  }
  return (doc.commands?.length ?? 0) > 0
}

function peekShelfNotes(
  studentId: string,
  bookId: string,
  unitId: string,
  adapter?: WhiteboardSessionStorageAdapter,
): { hasNotes: boolean; pageCount: number; firstPageTitle?: string } {
  const storagePageKey = annotationStorageLocalWhiteboardKey(bookId, unitId)
  const key = { studentId, bookId, unitId, storagePageKey }
  const doc = peekWhiteboardSession(key, adapter)
  if (!doc) {
    return { hasNotes: false, pageCount: 0 }
  }
  const pages = doc.pages ?? []
  const firstTitled = pages.find((p) => p.title?.trim())
  return {
    hasNotes: lessonBoardDocumentHasNotes(doc),
    pageCount: pages.length,
    firstPageTitle: firstTitled?.title?.trim() || undefined,
  }
}

/**
 * Units for one book + whether each has a lasting lesson board with notes.
 * Empty / never-opened boards report `hasNotes: false` and `pageCount: 0`.
 */
export function listLessonBoardShelfUnits(args: {
  studentId: string
  book: Pick<BookRecord, 'id' | 'units'>
  adapter?: WhiteboardSessionStorageAdapter
}): LessonBoardShelfUnit[] {
  const studentId = args.studentId.trim()
  const bookId = args.book.id.trim()
  if (!studentId || !bookId) return []

  return args.book.units.map((unit) => {
    const unitId = unit.id.trim()
    const peeked = peekShelfNotes(studentId, bookId, unitId, args.adapter)
    return {
      unitId,
      title: unit.title.trim() || unitId,
      ...peeked,
    }
  })
}

export type AssignedUnitRef = { bookId: string; unitId: string }

/**
 * Notebooks for this student across assigned books (Workshop + Literature, etc.).
 * One row per book+unit the student can open from the Boards menu.
 */
export function listLessonBoardShelfForStudent(args: {
  studentId: string
  library: Pick<BookLibraryPayload, 'books'>
  assignedBookIds?: readonly string[]
  assignedUnitRefs?: readonly AssignedUnitRef[]
  /** Always include the currently open board even if not in assignments. */
  openBookId?: string | null
  openUnitId?: string | null
  adapter?: WhiteboardSessionStorageAdapter
}): LessonBoardShelfEntry[] {
  const studentId = args.studentId.trim()
  if (!studentId) return []

  const bookById = new Map(args.library.books.map((b) => [b.id, b]))
  const pairs = new Map<string, { bookId: string; unitId: string }>()

  const addPair = (bookId: string, unitId: string) => {
    const b = bookId.trim()
    const u = unitId.trim()
    if (!b || !u || !bookById.has(b)) return
    pairs.set(`${b}::${u}`, { bookId: b, unitId: u })
  }

  for (const ref of args.assignedUnitRefs ?? []) {
    addPair(ref.bookId, ref.unitId)
  }

  for (const bookId of args.assignedBookIds ?? []) {
    const book = bookById.get(bookId.trim())
    if (!book) continue
    for (const unit of book.units) {
      addPair(book.id, unit.id)
    }
  }

  if (args.openBookId && args.openUnitId) {
    addPair(args.openBookId, args.openUnitId)
  }

  // If assignments are empty but we have an open book, still list all its units.
  if (pairs.size === 0 && args.openBookId) {
    const book = bookById.get(args.openBookId.trim())
    if (book) {
      for (const unit of book.units) {
        addPair(book.id, unit.id)
      }
    }
  }

  const entries: LessonBoardShelfEntry[] = []
  for (const { bookId, unitId } of pairs.values()) {
    const book = bookById.get(bookId)
    if (!book) continue
    const unit = book.units.find((u) => u.id === unitId)
    if (!unit) continue
    const multiUnit = book.units.length >= 2
    const peeked = peekShelfNotes(studentId, bookId, unitId, args.adapter)
    entries.push({
      bookId,
      unitId,
      displayLabel: lessonBoardDisplayLabel(book),
      bookTitle: book.title.trim() || book.id,
      unitTitle: multiUnit ? unit.title.trim() || unitId : undefined,
      accentColor: lessonBoardBookAccentColor(bookId),
      ...peeked,
    })
  }

  entries.sort((a, b) => {
    const bookCmp = a.bookTitle.localeCompare(b.bookTitle)
    if (bookCmp !== 0) return bookCmp
    return (a.unitTitle ?? a.unitId).localeCompare(b.unitTitle ?? b.unitId)
  })

  return entries
}

/** Footer strip text for the active notebook. */
export function lessonBoardFooterLabel(entry: {
  displayLabel: string
  unitTitle?: string
}): string {
  if (entry.unitTitle?.trim()) {
    return `${entry.displayLabel} · ${entry.unitTitle.trim()}`
  }
  return entry.displayLabel
}

/**
 * Next unit in the same book (library order). Never invents units.
 * Returns null when this is the last unit or the unit is unknown.
 */
export function resolveNextUnitInBook(
  book: Pick<BookRecord, 'units'> | null | undefined,
  unitId: string | null | undefined,
): { id: string; title: string } | null {
  if (!book?.units?.length || !unitId?.trim()) return null
  const index = book.units.findIndex((u) => u.id === unitId.trim())
  if (index < 0 || index >= book.units.length - 1) return null
  const next = book.units[index + 1]
  if (!next) return null
  return { id: next.id, title: next.title.trim() || next.id }
}

/**
 * True when the reader is on the last spread of the current unit bounds
 * (left or right page at `max`, or left page is the last visible page).
 */
export function isNearEndOfUnitReader(args: {
  pageNumber: number
  spreadRightPage?: number | null
  unitMaxPage: number
}): boolean {
  const max = Math.floor(args.unitMaxPage)
  const left = Math.floor(args.pageNumber)
  if (!Number.isFinite(max) || max < 1 || !Number.isFinite(left) || left < 1) return false
  if (left >= max) return true
  const right = args.spreadRightPage
  if (typeof right === 'number' && Number.isFinite(right) && Math.floor(right) >= max) {
    return true
  }
  // One page before the end (so the soft prompt appears on the last full spread).
  return left >= max - 1
}
