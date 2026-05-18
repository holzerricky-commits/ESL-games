/**
 * ## Reader page-turn prefetch window (Phase C1)
 *
 * Neighbour prefetch (Phase C2+) must only target **1-based PDF page indices** that can actually
 * appear in the reader: the same set `getVisiblePdfPages` returns for the unit, clamped by
 * `getUnitReaderBounds`. Never prefetch hidden PDF pages or indices outside reader bounds.
 *
 * The window is measured in **slots along the sorted visible list** (not “anchor ± N” raw PDF
 * numbers), so manifests with gaps do not schedule unreachable pages.
 *
 * @see `getVisiblePdfPages`, `getUnitReaderBounds`, `clampPdfPageToVisible` in `lib/books/page-range.ts`
 * @see `docs/FULLSCREEN_BOOK_PREFETCH_PAGE_TURN_TASKS.md` — Phase C
 */

import { clampPdfPage, clampPdfPageToVisible, type UnitPageBounds } from '@/lib/books/page-range'

/**
 * Visible-list slots *before* the clamped anchor (≈ two two-page spreads when every PDF page is visible).
 * Tune with Phase C2 queue / memory profiling.
 */
export const READER_PREFETCH_VISIBLE_SLOTS_BEFORE = 4

/** Visible-list slots *after* the clamped anchor (forward page-turn bias can increase this later). */
export const READER_PREFETCH_VISIBLE_SLOTS_AFTER = 4

/**
 * Upper bound on distinct prefetch bitmap entries (e.g. `(unitId, pdfPage, widthBucket)`) for LRU
 * eviction in Phase C2/C4 — width buckets are 32px quanta (`readerPrefetchWidthBucket` in prefetch queue).
 */
export const READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES = 24

export interface ReaderPrefetchWindowArgs {
  /** Current spread anchor (typically left page in two-up mode). */
  anchorPage: number
  /** Sorted visible PDF indices from `getVisiblePdfPages` (same unit/book as the reader). */
  visiblePages: number[]
  /** Inclusive bounds from `getUnitReaderBounds` for clamping when `visiblePages` is empty. */
  readerBounds: UnitPageBounds
}

/**
 * Returns sorted PDF page indices to prioritize for off-screen render / bitmap cache (Phase C2).
 * When `visiblePages` is empty (e.g. PDF page count not known yet), returns a single in-bounds page.
 */
export function getReaderPrefetchVisiblePageIndices(args: ReaderPrefetchWindowArgs): number[] {
  const { anchorPage, visiblePages, readerBounds } = args
  if (!visiblePages.length) {
    return [clampPdfPage(anchorPage, readerBounds)]
  }

  const clamped = clampPdfPageToVisible(anchorPage, visiblePages, readerBounds)
  const idx = visiblePages.indexOf(clamped)
  if (idx < 0) {
    return [clamped]
  }

  const start = Math.max(0, idx - READER_PREFETCH_VISIBLE_SLOTS_BEFORE)
  const end = Math.min(visiblePages.length - 1, idx + READER_PREFETCH_VISIBLE_SLOTS_AFTER)
  return visiblePages.slice(start, end + 1)
}
