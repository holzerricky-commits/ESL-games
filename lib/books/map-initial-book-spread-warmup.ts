/**
 * Phase E1c — Warm likely first-spread bitmaps while the fullscreen map is idle (before book tap).
 * Uses the same selection rules as `resolveInitialBookReaderSelection` + visible-page window
 * as `getReaderPrefetchVisiblePageIndices`. Width is a viewport heuristic until overlay measures.
 */

import { makeUnitFileUrl } from '@/components/students/fullscreen-book-overlay/constants'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import type { BookLibraryPayload } from '@/lib/books/types'
import { getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import { prefetchReaderPageBitmapIfMissing } from '@/lib/books/reader-page-prefetch-queue'
import { getReaderPrefetchVisiblePageIndices } from '@/lib/books/reader-prefetch-window'
import type { BookReaderCurriculumHistoryEntry } from '@/lib/books/resolve-initial-book-reader-selection'
import { resolveInitialBookReaderSelection } from '@/lib/books/resolve-initial-book-reader-selection'

export interface WarmMapInitialBookSpreadPrefetchArgs {
  library: BookLibraryPayload
  assignedBookIds: string[]
  assignedUnitRefs: Array<{ bookId: string; unitId: string }>
  curriculumHistory: BookReaderCurriculumHistoryEntry[]
}

function heuristicSpreadPageWidthPx(): number {
  if (typeof window === 'undefined' || !Number.isFinite(window.innerWidth)) return 360
  const safeHeight = window.innerHeight * 0.985
  const perPage = window.innerWidth / 2
  const widthFit = perPage * 0.995
  const heightFit = safeHeight * (1 / 1.414)
  return Math.floor(Math.max(64, Math.min(widthFit, heightFit)))
}

export async function warmMapInitialBookSpreadPrefetch(args: WarmMapInitialBookSpreadPrefetchArgs): Promise<void> {
  const { library, assignedBookIds, assignedUnitRefs, curriculumHistory } = args
  const sel = resolveInitialBookReaderSelection({
    library,
    assignedBookIds,
    assignedUnitRefs,
    curriculumHistory,
  })
  if (!sel.selectedBookId || !sel.selectedUnitId) return
  const book = library.books.find((b) => b.id === sel.selectedBookId)
  const unit = book?.units.find((u) => u.id === sel.selectedUnitId)
  if (!book || !unit) return

  await ensureReactPdfWorker()
  const fileUrl = makeUnitFileUrl(unit.filePath)
  const doc = await loadCachedPdfDocument(fileUrl)
  const numPages = doc.numPages
  const visiblePages = getVisiblePdfPages(unit, numPages, book)
  const readerBounds = getUnitReaderBounds(unit, numPages, book)
  const pages = getReaderPrefetchVisiblePageIndices({
    anchorPage: sel.pageNumber,
    visiblePages,
    readerBounds,
  })
  const widthPx = heuristicSpreadPageWidthPx()
  for (const pageNumber of pages) {
    void prefetchReaderPageBitmapIfMissing({ fileUrl, unitId: unit.id, pageNumber, widthPx }).catch(() => {})
  }
}
