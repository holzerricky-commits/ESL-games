/**
 * Phase 1 stable pages — public name for the reader bitmap LRU.
 * Implementation remains in `reader-page-prefetch-queue.ts` until a later split.
 */

import { getReaderPrefetchedImageBitmap } from '@/lib/books/reader-page-prefetch-queue'

export {
  READER_PREFETCH_WIDTH_BUCKET_PX,
  readerPrefetchWidthBucket,
  readerPrefetchLowResTargetWidth,
  readerPrefetchLowResWidthBucket,
  invalidateReaderPrefetchStaleWidthBucketsForUnit,
  clearReaderPrefetchCacheForUnit,
  invalidateReaderPrefetchPagesAtWidth,
  subscribeReaderPrefetchCache as subscribePageRenderCache,
  getReaderPrefetchedImageBitmap as getPageRenderCacheBitmap,
  getReaderPrefetchedLowResBitmap,
  prefetchReaderPageBitmapIfMissing as ensurePageRenderCacheEntry,
  queueReaderPrefetchPagesImmediate,
  queueReaderPrefetchPagesLowRes,
  queueReaderPrefetchWindowIdle,
} from '@/lib/books/reader-page-prefetch-queue'

export { READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES as PAGE_RENDER_CACHE_MAX_ENTRIES } from '@/lib/books/reader-prefetch-window'

/** Returns true when a drawable bitmap exists for `(unitId, page, widthPx)`. */
export function hasPageRenderCacheEntry(unitId: string, pageNumber: number, widthPx: number): boolean {
  return getReaderPrefetchedImageBitmap(unitId, pageNumber, widthPx) != null
}
