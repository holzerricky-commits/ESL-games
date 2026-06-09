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

export function whiteboardSessionDocId(key: WhiteboardSessionKey): string {
  return `${key.studentId}::${key.bookId}::${key.unitId}::wb::${key.storagePageKey}`
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
