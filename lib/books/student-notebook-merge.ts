import type { BookLibraryPayload } from '@/lib/books/types'
import { lessonBoardDocumentHasNotes } from '@/lib/books/lesson-board-nav'
import {
  prepareLessonBoardSessionForPersist,
  syncLessonBoardActivePageToCommands,
  type LessonBoardPage,
} from '@/lib/books/lesson-board-types'
import {
  annotationStorageLocalWhiteboardKey,
  annotationStorageStudentWhiteboardKey,
  isStudentNotebookStorageKey,
  STUDENT_NOTEBOOK_BOOK_ID,
  STUDENT_NOTEBOOK_UNIT_ID,
} from '@/lib/books/whiteboard-storage'
import {
  listWhiteboardSessionDocIds,
  peekWhiteboardSession,
  type WhiteboardSessionStorageAdapter,
} from '@/lib/books/whiteboard-session-storage'
import { stampLegacyBoardLinksOntoPages } from '@/lib/books/lesson-board-page-links'
import {
  createEmptyWhiteboardSession,
  parseWhiteboardSessionDocId,
  whiteboardSessionDocId,
  type WhiteboardSessionDocument,
  type WhiteboardSessionKey,
} from '@/lib/books/whiteboard-session-types'

export type StudentNotebookMergeSource = {
  bookId: string
  unitId: string
}

export function studentNotebookSessionKey(studentId: string): WhiteboardSessionKey {
  const id = studentId.trim()
  return {
    studentId: id,
    bookId: STUDENT_NOTEBOOK_BOOK_ID,
    unitId: STUDENT_NOTEBOOK_UNIT_ID,
    storagePageKey: annotationStorageStudentWhiteboardKey(id),
  }
}

export function isStudentNotebookSessionKey(key: WhiteboardSessionKey): boolean {
  return (
    key.bookId === STUDENT_NOTEBOOK_BOOK_ID &&
    key.unitId === STUDENT_NOTEBOOK_UNIT_ID &&
    isStudentNotebookStorageKey(key.storagePageKey)
  )
}

/**
 * Assigned books (assignment order) then that book's units (library order).
 * Always includes the open book/unit when given.
 */
export function listStudentNotebookMergeSources(args: {
  library: Pick<BookLibraryPayload, 'books'>
  assignedBookIds?: readonly string[]
  assignedUnitRefs?: readonly StudentNotebookMergeSource[]
  openBookId?: string | null
  openUnitId?: string | null
}): StudentNotebookMergeSource[] {
  const booksById = new Map(args.library.books.map((book) => [book.id, book]))
  const seen = new Set<string>()
  const sources: StudentNotebookMergeSource[] = []

  const add = (bookId: string, unitId: string) => {
    const b = bookId.trim()
    const u = unitId.trim()
    if (!b || !u || !booksById.has(b)) return
    const token = `${b}::${u}`
    if (seen.has(token)) return
    seen.add(token)
    sources.push({ bookId: b, unitId: u })
  }

  for (const bookId of args.assignedBookIds ?? []) {
    const book = booksById.get(bookId.trim())
    if (!book) continue
    for (const unit of book.units) add(book.id, unit.id)
  }

  for (const ref of args.assignedUnitRefs ?? []) {
    add(ref.bookId, ref.unitId)
  }

  if (args.openBookId && args.openUnitId) {
    add(args.openBookId, args.openUnitId)
  }

  return sources
}

function clonePageWithSourceHint(
  page: LessonBoardPage,
  source: StudentNotebookMergeSource,
): LessonBoardPage {
  return {
    ...page,
    commands: [...page.commands],
    sourceBookId: page.sourceBookId?.trim() || source.bookId,
    sourceUnitId: page.sourceUnitId?.trim() || source.unitId,
  }
}

function peekLegacyBookUnitBoard(
  studentId: string,
  source: StudentNotebookMergeSource,
  adapter?: WhiteboardSessionStorageAdapter,
): WhiteboardSessionDocument | null {
  const key: WhiteboardSessionKey = {
    studentId,
    bookId: source.bookId,
    unitId: source.unitId,
    storagePageKey: annotationStorageLocalWhiteboardKey(source.bookId, source.unitId),
  }
  return peekWhiteboardSession(key, adapter)
}

/** Extra local book/unit boards for this student that were not in the assigned list. */
export function listAdditionalStudentLegacyNotebooks(
  studentId: string,
  already: readonly StudentNotebookMergeSource[],
  adapter?: WhiteboardSessionStorageAdapter,
): StudentNotebookMergeSource[] {
  const id = studentId.trim()
  if (!id) return []
  const seen = new Set(already.map((s) => `${s.bookId}::${s.unitId}`))
  const extra: StudentNotebookMergeSource[] = []
  for (const docId of listWhiteboardSessionDocIds(adapter)) {
    const parsed = parseWhiteboardSessionDocId(docId)
    if (!parsed || parsed.studentId !== id) continue
    if (isStudentNotebookSessionKey(parsed)) continue
    if (parsed.storagePageKey !== annotationStorageLocalWhiteboardKey(parsed.bookId, parsed.unitId)) {
      continue
    }
    const token = `${parsed.bookId}::${parsed.unitId}`
    if (seen.has(token)) continue
    seen.add(token)
    extra.push({ bookId: parsed.bookId, unitId: parsed.unitId })
  }
  return extra
}

export function mergeStudentNotebookFromBookUnitBoards(args: {
  studentId: string
  sources: readonly StudentNotebookMergeSource[]
  adapter?: WhiteboardSessionStorageAdapter
  now?: number
}): WhiteboardSessionDocument | null {
  const studentId = args.studentId.trim()
  if (!studentId) return null
  const extra = listAdditionalStudentLegacyNotebooks(studentId, args.sources, args.adapter)
  const sources = [...args.sources, ...extra]
  const pages: LessonBoardPage[] = []
  const seenPageIds = new Set<string>()
  let newest: { updatedAt: number; activePageId: string } | null = null

  for (const source of sources) {
    const doc = peekLegacyBookUnitBoard(studentId, source, args.adapter)
    if (!doc || !lessonBoardDocumentHasNotes(doc)) continue
    const synced = prepareLessonBoardSessionForPersist(doc)
    for (const page of synced.pages) {
      if (seenPageIds.has(page.id)) continue
      seenPageIds.add(page.id)
      pages.push(clonePageWithSourceHint(page, source))
    }
    const updatedAt = synced.meta?.updatedAt ?? 0
    if (synced.activePageId && (newest == null || updatedAt >= newest.updatedAt)) {
      newest = { updatedAt, activePageId: synced.activePageId }
    }
  }

  if (pages.length === 0) return null

  const primaryKey = studentNotebookSessionKey(studentId)
  const activePageId =
    newest && pages.some((page) => page.id === newest.activePageId)
      ? newest.activePageId
      : pages[0]!.id
  const now = args.now ?? Date.now()
  const merged: WhiteboardSessionDocument = {
    docId: whiteboardSessionDocId(primaryKey),
    key: primaryKey,
    pages,
    activePageId,
    commands: [],
    meta: {
      revision: 0,
      dirty: true,
      updatedAt: now,
    },
  }
  return syncLessonBoardActivePageToCommands(merged)
}

/**
 * Load the student notebook. First open copy-merges this student's book/unit boards.
 * Old keys stay on disk. Never writes during load.
 */
export function loadStudentNotebookSession(
  studentId: string,
  sources: readonly StudentNotebookMergeSource[] = [],
  adapter?: WhiteboardSessionStorageAdapter,
): WhiteboardSessionDocument {
  const primaryKey = studentNotebookSessionKey(studentId)
  const existing = peekWhiteboardSession(primaryKey, adapter)
  if (existing) {
    return withLegacyBookLinks({
      ...existing,
      key: primaryKey,
      docId: whiteboardSessionDocId(primaryKey),
    })
  }
  const merged = mergeStudentNotebookFromBookUnitBoards({
    studentId,
    sources,
    adapter,
  })
  if (merged) return withLegacyBookLinks(merged)
  return withLegacyBookLinks(createEmptyWhiteboardSession(primaryKey))
}

function withLegacyBookLinks(doc: WhiteboardSessionDocument): WhiteboardSessionDocument {
  const stamped = stampLegacyBoardLinksOntoPages(doc.key.studentId, doc.pages)
  if (!stamped.changed) return doc
  const next = {
    ...doc,
    pages: stamped.pages,
    meta: {
      ...doc.meta,
      dirty: true,
      updatedAt: Date.now(),
    },
  }
  return syncLessonBoardActivePageToCommands(next)
}
