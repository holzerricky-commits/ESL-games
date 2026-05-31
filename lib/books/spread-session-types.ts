import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

export type SpreadSessionKey = {
  studentId: string
  bookId: string
  unitId: string
  leftPage: number
  rightPage: number
}

export type SpreadSessionMeta = {
  revision: number
  dirty: boolean
  updatedAt: number
}

/** Phase 1: same command schema, interpreted in spread-space while session is active. */
export type SpreadSessionCommand = AnnotationCommand

export type SpreadSessionDocument = {
  docId: string
  key: SpreadSessionKey
  commands: SpreadSessionCommand[]
  meta: SpreadSessionMeta
}

export function spreadSessionDocId(key: SpreadSessionKey): string {
  return `${key.studentId}::${key.bookId}::${key.unitId}::${key.leftPage}-${key.rightPage}`
}

export function createEmptySpreadSession(key: SpreadSessionKey, now = Date.now()): SpreadSessionDocument {
  return {
    docId: spreadSessionDocId(key),
    key,
    commands: [],
    meta: {
      revision: 0,
      dirty: false,
      updatedAt: now,
    },
  }
}
