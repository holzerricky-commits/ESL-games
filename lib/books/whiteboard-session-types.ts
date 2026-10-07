import type { InkSessionDocument, InkSessionMeta } from '@/lib/books/ink-session-types'
import {
  createLessonBoardPage,
  defaultLessonBoardContentHeightPx,
  type LessonBoardDocumentFields,
} from '@/lib/books/lesson-board-types'

export type WhiteboardSessionKey = {
  studentId: string
  bookId: string
  unitId: string
  storagePageKey: string
}

export type WhiteboardSessionCommand = InkSessionDocument['commands'][number]

/** Session ink document: `commands` mirrors the active page for the ink store; `pages` is canonical on disk. */
export type WhiteboardSessionDocument = InkSessionDocument &
  LessonBoardDocumentFields & {
    key: WhiteboardSessionKey
  }

const WHITEBOARD_DOC_ID_MARKER = '::wb::'

export function whiteboardSessionDocId(key: WhiteboardSessionKey): string {
  return `${key.studentId}::${key.bookId}::${key.unitId}${WHITEBOARD_DOC_ID_MARKER}${key.storagePageKey}`
}

export function parseWhiteboardSessionDocId(docId: string): WhiteboardSessionKey | null {
  const markerAt = docId.indexOf(WHITEBOARD_DOC_ID_MARKER)
  if (markerAt <= 0) return null
  const head = docId.slice(0, markerAt)
  const storagePageKey = docId.slice(markerAt + WHITEBOARD_DOC_ID_MARKER.length).trim()
  if (!storagePageKey) return null
  const parts = head.split('::')
  if (parts.length !== 3) return null
  const studentId = parts[0]?.trim() ?? ''
  const bookId = parts[1]?.trim() ?? ''
  const unitId = parts[2]?.trim() ?? ''
  if (!studentId || !bookId || !unitId) return null
  return { studentId, bookId, unitId, storagePageKey }
}

export function createEmptyWhiteboardSession(
  key: WhiteboardSessionKey,
  now = Date.now(),
  options: { defaultContentHeightPx?: number } = {},
): WhiteboardSessionDocument {
  const contentHeightPx =
    options.defaultContentHeightPx ?? defaultLessonBoardContentHeightPx()
  const page = createLessonBoardPage('standard', { contentHeightPx, commands: [] })
  return {
    docId: whiteboardSessionDocId(key),
    key,
    pages: [page],
    activePageId: page.id,
    commands: [],
    meta: {
      revision: 0,
      dirty: false,
      updatedAt: now,
    },
  }
}
