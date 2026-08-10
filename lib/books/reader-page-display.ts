/**
 * R3 — reader page display: sharp when ready, soft placeholder only on miss.
 *
 * Blur is not a deliberate transition effect — placeholders use light CSS blur only
 * when full-res cache / PDF compositing is not ready yet.
 */

import { getReaderPrefetchedLowResBitmap } from '@/lib/books/reader-page-prefetch-queue'
import {
  PDF_HERO_THUMB_WIDTH,
  PDF_THUMB_WIDTH,
  peekCachedThumbnailDataUrl,
} from '@/lib/books/pdf-thumbnail-cache'

/** Light blur on upscaled low-res / thumbnail placeholders only. */
export const READER_PAGE_PLACEHOLDER_FILTER = 'blur(2px)'

export type ReaderPagePlaceholderSource =
  | { kind: 'low-res-bitmap'; bitmap: ImageBitmap }
  | { kind: 'thumbnail'; dataUrl: string; sourceWidth: number }

/** Full-res cache hit or PDF composited — never show placeholder on top. */
export function isReaderPageSharpReady(args: {
  cacheBitmap: ImageBitmap | null | undefined
  pdfDisplayReady: boolean
}): boolean {
  return args.pdfDisplayReady || args.cacheBitmap != null
}

/** Placeholder only when sharp is not ready and a stand-in source exists. */
export function shouldShowReaderPagePlaceholder(args: {
  sharpReady: boolean
  placeholder: ReaderPagePlaceholderSource | null
}): boolean {
  return !args.sharpReady && args.placeholder != null
}

/** Drawable pixels for spread-ready: sharp or placeholder (not empty white). */
export function readerPageHasDrawablePixelsFromLayers(args: {
  showSharpCache: boolean
  pdfDisplayReady: boolean
  showPlaceholder: boolean
}): boolean {
  return args.showSharpCache || args.pdfDisplayReady || args.showPlaceholder
}

/** Layer visibility when PDF text selection shares the page with prefetch cache. */
export type ReaderPageLayerVisibility = {
  pdfTextLayerActive: boolean
  /** Text layer over sharp cache — hide live PDF canvas, keep cache as background. */
  pdfTextOverCache: boolean
  pdfHiddenBehindCache: boolean
  showSharpCacheLayer: boolean
}

/**
 * When live PDF is primary, cache is a loading placeholder only — never over live composited PDF.
 */
export function resolveReaderPageShowSharpCache(args: {
  livePdfPrimaryEnabled: boolean
  cacheBitmap: ImageBitmap | null
  pdfDisplayReady: boolean
  preferSharpCacheOverPdf: boolean
}): boolean {
  if (args.cacheBitmap == null) return false
  if (args.livePdfPrimaryEnabled) return !args.pdfDisplayReady
  return !args.pdfDisplayReady || args.preferSharpCacheOverPdf
}

export function resolveReaderPageLayerVisibility(args: {
  bookTextSelectActive: boolean
  pageHasSelectableText: boolean
  showSharpCache: boolean
}): ReaderPageLayerVisibility {
  const pdfTextLayerActive = args.bookTextSelectActive && args.pageHasSelectableText
  const showSharpCacheLayer = args.showSharpCache
  const pdfTextOverCache = pdfTextLayerActive && showSharpCacheLayer
  const pdfHiddenBehindCache = showSharpCacheLayer && !pdfTextLayerActive
  return {
    pdfTextLayerActive,
    pdfTextOverCache,
    pdfHiddenBehindCache,
    showSharpCacheLayer,
  }
}

/**
 * Resolve best available placeholder: P0 low-res prefetch, then 240px thumb, then 76px.
 * `prefetchRevision` is an opaque dependency so callers re-run when LRU updates.
 */
export function resolveReaderPagePlaceholderSource(
  unitId: string,
  pageNumber: number,
  spreadPageWidth: number,
  _prefetchRevision: number,
): ReaderPagePlaceholderSource | null {
  const lowRes = getReaderPrefetchedLowResBitmap(unitId, pageNumber, spreadPageWidth)
  if (lowRes) return { kind: 'low-res-bitmap', bitmap: lowRes }

  const hero = peekCachedThumbnailDataUrl(unitId, pageNumber, PDF_HERO_THUMB_WIDTH)
  if (hero) return { kind: 'thumbnail', dataUrl: hero, sourceWidth: PDF_HERO_THUMB_WIDTH }

  const thumb = peekCachedThumbnailDataUrl(unitId, pageNumber, PDF_THUMB_WIDTH)
  if (thumb) return { kind: 'thumbnail', dataUrl: thumb, sourceWidth: PDF_THUMB_WIDTH }

  return null
}
