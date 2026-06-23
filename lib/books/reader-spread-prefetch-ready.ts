import { getPageRenderCacheBitmap } from '@/lib/books/page-render-cache'
import { resolveSpreadAnchorPages } from '@/lib/books/reader-spread-navigation'

/**
 * Optional check: prefetched bitmaps for a spread at the current width bucket.
 * Page turns and open-ready no longer require this — slot pixel gates handle visibility.
 */
export function areReaderSpreadPagesPrefetched(args: {
  unitId: string
  anchorPage: number
  visiblePages: number[]
  spreadPageWidthPx: number
}): boolean {
  const { unitId, anchorPage, visiblePages, spreadPageWidthPx } = args
  if (!(spreadPageWidthPx > 0)) return false
  const { left, right } = resolveSpreadAnchorPages(anchorPage, visiblePages)
  if (!getPageRenderCacheBitmap(unitId, left, spreadPageWidthPx)) return false
  if (right != null && !getPageRenderCacheBitmap(unitId, right, spreadPageWidthPx)) return false
  return true
}

export function spreadPdfPagesForAnchor(
  anchorPage: number,
  visiblePages: number[],
): number[] {
  const { left, right } = resolveSpreadAnchorPages(anchorPage, visiblePages)
  return right != null ? [left, right] : [left]
}
