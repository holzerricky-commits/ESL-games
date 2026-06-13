import { getAnnotationsForPage, setAnnotationsForPage } from '@/lib/books/annotation-storage'
import { isInkSessionDelegatedCanvasCommand } from '@/lib/books/ink-session-page-layer'
import { projectSpreadSessionToOwnerPages } from '@/lib/books/spread-session-commit'
import { saveSpreadSessionCheckpoint, type SpreadSessionStorageAdapter } from '@/lib/books/spread-session-storage'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
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

function mergePageLayerAnnotationsWithSpreadInk(
  existing: readonly AnnotationCommand[],
  spreadInk: readonly AnnotationCommand[],
): AnnotationCommand[] {
  return [
    ...existing.filter((command) => !isInkSessionDelegatedCanvasCommand(command)),
    ...spreadInk,
  ]
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
  const projected =
    doc.commands.length === 0
      ? { left: [], right: [] }
      : projectSpreadSessionToOwnerPages(doc.commands, layout)
  const existingLeft = getAnnotationsForPage(studentId, bookId, unitId, pages.leftPage, 'pdf')
  const existingRight = getAnnotationsForPage(studentId, bookId, unitId, pages.rightPage, 'pdf')
  setAnnotationsForPage(
    studentId,
    bookId,
    unitId,
    pages.leftPage,
    mergePageLayerAnnotationsWithSpreadInk(existingLeft, projected.left),
    'pdf',
  )
  setAnnotationsForPage(
    studentId,
    bookId,
    unitId,
    pages.rightPage,
    mergePageLayerAnnotationsWithSpreadInk(existingRight, projected.right),
    'pdf',
  )
}
