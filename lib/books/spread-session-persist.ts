import { setAnnotationsForPage } from '@/lib/books/annotation-storage'
import { isInkSessionPageFlushEnabled } from '@/lib/books/ink-session-flush-gate'
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

/** Last-page spread uses the same page index for left and right session key slots. */
export function isLastPageSpreadKey(key: Pick<SpreadSessionKey, 'leftPage' | 'rightPage'>): boolean {
  return key.rightPage === key.leftPage
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
  if (!isInkSessionPageFlushEnabled()) return
  const pages = { leftPage: key.leftPage, rightPage: key.rightPage }
  const lastPageOnly = isLastPageSpreadKey(pages)

  if (doc.commands.length === 0) {
    setAnnotationsForPage(studentId, bookId, unitId, pages.leftPage, [], 'pdf')
    if (!lastPageOnly) {
      setAnnotationsForPage(studentId, bookId, unitId, pages.rightPage, [], 'pdf')
    }
    return
  }

  const projected = projectSpreadSessionToOwnerPages(doc.commands, layout)
  setAnnotationsForPage(studentId, bookId, unitId, pages.leftPage, projected.left, 'pdf')
  if (!lastPageOnly) {
    setAnnotationsForPage(studentId, bookId, unitId, pages.rightPage, projected.right, 'pdf')
  }
}
