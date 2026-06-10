import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
import { isInkSessionDelegatedCanvasCommand } from '@/lib/books/ink-session-page-layer'
import { projectSpreadSessionToOwnerPages } from '@/lib/books/spread-session-commit'
import { saveSpreadSessionCheckpoint, type SpreadSessionStorageAdapter } from '@/lib/books/spread-session-storage'
import type { SpreadSessionDocument, SpreadSessionKey } from '@/lib/books/spread-session-types'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'

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
  const projected = projectSpreadSessionToOwnerPages(doc.commands, layout)
  setAnnotationsForPage(
    studentId,
    bookId,
    unitId,
    pages.leftPage,
    mergePageLayerWithSpreadSession(
      getAnnotationsForPage(studentId, bookId, unitId, pages.leftPage, 'pdf'),
      projected.left,
    ),
    'pdf',
  )
  setAnnotationsForPage(
    studentId,
    bookId,
    unitId,
    pages.rightPage,
    mergePageLayerWithSpreadSession(
      getAnnotationsForPage(studentId, bookId, unitId, pages.rightPage, 'pdf'),
      projected.right,
    ),
    'pdf',
  )
}

export function mergePageLayerWithSpreadSession(
  pageLayerCommands: readonly AnnotationCommand[],
  sessionCommands: readonly AnnotationCommand[],
): AnnotationCommand[] {
  const pageOwnedCommands = pageLayerCommands.filter((cmd) => !isInkSessionDelegatedCanvasCommand(cmd))
  if (sessionCommands.length === 0) return pageOwnedCommands
  return [...pageOwnedCommands, ...sessionCommands]
}
