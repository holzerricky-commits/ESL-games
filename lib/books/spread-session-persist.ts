import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { isSpreadDelegatedCanvasCommand } from '@/lib/books/ink-session-page-layer'
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

function mergePageLayerWithSpreadSession(
  existingPageCommands: readonly AnnotationCommand[],
  projectedSpreadCommands: readonly AnnotationCommand[],
): AnnotationCommand[] {
  const pageLayerCommands = existingPageCommands.filter((cmd) => !isSpreadDelegatedCanvasCommand(cmd))
  if (projectedSpreadCommands.length === 0) return pageLayerCommands
  return [...pageLayerCommands, ...projectedSpreadCommands]
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
  const projected = projectSpreadSessionToOwnerPages(doc.commands, layout)
  const leftExisting = getAnnotationsForPage(studentId, bookId, unitId, pages.leftPage, 'pdf')
  const rightExisting = getAnnotationsForPage(studentId, bookId, unitId, pages.rightPage, 'pdf')
  setAnnotationsForPage(
    studentId,
    bookId,
    unitId,
    pages.leftPage,
    mergePageLayerWithSpreadSession(leftExisting, projected.left),
    'pdf',
  )
  setAnnotationsForPage(
    studentId,
    bookId,
    unitId,
    pages.rightPage,
    mergePageLayerWithSpreadSession(rightExisting, projected.right),
    'pdf',
  )
}
