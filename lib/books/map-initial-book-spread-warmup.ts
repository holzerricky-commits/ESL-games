/**
 * Phase E1c / R5.3 — Warm likely first-spread bitmaps while the fullscreen map is idle (before book tap).
 * P0: current spread + next 2 spreads at viewport heuristic width; rest of window on idle.
 */

import { makeUnitFileUrl } from '@/components/students/fullscreen-book-overlay/constants'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import type { BookLibraryPayload } from '@/lib/books/types'
import { getUnitReaderBounds, getVisiblePdfPages } from '@/lib/books/page-range'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import {
  queueReaderPrefetchPagesImmediate,
  queueReaderPrefetchPagesLowRes,
  queueReaderPrefetchWindowIdle,
} from '@/lib/books/reader-page-prefetch-queue'
import { splitReaderPrefetchPages } from '@/lib/books/reader-prefetch-priority'
import type { BookReaderCurriculumHistoryEntry } from '@/lib/books/resolve-initial-book-reader-selection'
import { resolveInitialBookReaderSelection } from '@/lib/books/resolve-initial-book-reader-selection'
import { setMapAnchorSpreadContext } from '@/lib/books/map-anchor-spread-context'
import { heuristicBookOverlaySpreadPageWidthPx } from '@/lib/books/spread-viewport-layout'

export interface WarmMapInitialBookSpreadPrefetchArgs {
  library: BookLibraryPayload
  assignedBookIds: string[]
  assignedUnitRefs: Array<{ bookId: string; unitId: string }>
  curriculumHistory: BookReaderCurriculumHistoryEntry[]
}

export async function warmMapInitialBookSpreadPrefetch(args: WarmMapInitialBookSpreadPrefetchArgs): Promise<void> {
  const { library, assignedBookIds, assignedUnitRefs, curriculumHistory } = args
  const sel = resolveInitialBookReaderSelection({
    library,
    assignedBookIds,
    assignedUnitRefs,
    curriculumHistory,
  })
  if (!sel.selectedBookId || !sel.selectedUnitId) {
    setMapAnchorSpreadContext(null)
    return
  }
  const book = library.books.find((b) => b.id === sel.selectedBookId)
  const unit = book?.units.find((u) => u.id === sel.selectedUnitId)
  if (!book || !unit) return

  await ensureReactPdfWorker()
  const fileUrl = makeUnitFileUrl(unit.filePath)
  const doc = await loadCachedPdfDocument(fileUrl)
  const numPages = doc.numPages
  const visiblePages = getVisiblePdfPages(unit, numPages, book)
  const readerBounds = getUnitReaderBounds(unit, numPages, book)
  const widthPx = heuristicBookOverlaySpreadPageWidthPx()
  setMapAnchorSpreadContext({
    unitId: unit.id,
    anchorPage: sel.pageNumber,
    visiblePages,
    widthPx,
  })

  const { immediate, idle } = splitReaderPrefetchPages({
    anchorPage: sel.pageNumber,
    visiblePages,
    readerBounds,
    intent: 'map-warm',
  })

  queueReaderPrefetchPagesImmediate({
    fileUrl,
    unitId: unit.id,
    pages: immediate,
    widthPx,
  })

  queueReaderPrefetchPagesLowRes({
    fileUrl,
    unitId: unit.id,
    pages: immediate,
    widthPx,
  })

  if (idle.length > 0) {
    queueReaderPrefetchWindowIdle({
      fileUrl,
      unitId: unit.id,
      pages: idle,
      widthPx,
    })
  }
}
