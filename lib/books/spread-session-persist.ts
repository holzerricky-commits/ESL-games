import { setAnnotationsForPage } from '@/lib/books/annotation-storage'
import { projectSpreadSessionToOwnerPages } from '@/lib/books/spread-session-commit'
import { saveSpreadSessionCheckpoint, type SpreadSessionStorageAdapter } from '@/lib/books/spread-session-storage'
import type { SpreadSessionDocument, SpreadSessionKey } from '@/lib/books/spread-session-types'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'

export type FlushSpreadSessionToPagesParams = {
  doc: SpreadSessionDocument
  key: Pick<SpreadSessionKey, 'leftPage' | 'rightPage'>
  layout: SpreadInkLayout
  studentId: string
  bookId: string
  unitId: string
}

/** Tier B: persist spread-normalized commands to `bookSpreadSessionV1` immediately. */
export function checkpointSpreadSessionDocument(
  doc: SpreadSessionDocument,
  storage?: SpreadSessionStorageAdapter,
): void {
  saveSpreadSessionCheckpoint(doc, storage)
}

/**
 * Tier C: project spread commands onto left/right per-page annotation storage
 * (for legacy readers / export — not on every stroke).
 */
export function flushSpreadSessionDocumentToPageStorage({
  doc,
  key,
  layout,
  studentId,
  bookId,
  unitId,
}: FlushSpreadSessionToPagesParams): void {
  const pages = { leftPage: key.leftPage, rightPage: key.rightPage }
  if (doc.commands.length === 0) {
    setAnnotationsForPage(studentId, bookId, unitId, pages.leftPage, [], 'pdf')
    setAnnotationsForPage(studentId, bookId, unitId, pages.rightPage, [], 'pdf')
    return
  }
  const projected = projectSpreadSessionToOwnerPages(doc.commands, layout)
  setAnnotationsForPage(studentId, bookId, unitId, pages.leftPage, projected.left, 'pdf')
  setAnnotationsForPage(studentId, bookId, unitId, pages.rightPage, projected.right, 'pdf')
}
