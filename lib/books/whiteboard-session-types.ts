import type { InkSessionDocument, InkSessionMeta } from '@/lib/books/ink-session-types'

export type WhiteboardSessionKey = {
  studentId: string
  bookId: string
  unitId: string
  storagePageKey: string
}

export type WhiteboardSessionCommand = InkSessionDocument['commands'][number]

export type WhiteboardSessionDocument = InkSessionDocument & {
  key: WhiteboardSessionKey
}

export function whiteboardSessionDocId(key: WhiteboardSessionKey): string {
  return `${key.studentId}::${key.bookId}::${key.unitId}::wb::${key.storagePageKey}`
}

export function createEmptyWhiteboardSession(key: WhiteboardSessionKey, now = Date.now()): WhiteboardSessionDocument {
  return {
    docId: whiteboardSessionDocId(key),
    key,
    commands: [],
    meta: {
      revision: 0,
      dirty: false,
      updatedAt: now,
    },
  }
}
