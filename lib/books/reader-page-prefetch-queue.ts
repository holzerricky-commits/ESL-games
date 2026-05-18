/**
 * Phase C2 — Off-thread style PDF page raster prefetch for the fullscreen reader.
 *
 * Renders neighbour pages at reader width (bucketed) into `ImageBitmap`s using the same
 * `loadCachedPdfDocument` + PDF.js worker path as thumbnails (`pdf-thumbnail-cache.ts`).
 * Concurrency and idle scheduling keep the map / main thread responsive.
 *
 * Phase C3: `BookCanvasStage` may paint `getReaderPrefetchedImageBitmap` until `react-pdf` fires
 * `onLoadSuccess`, then hands off to `PdfPage` for annotations + consistency.
 *
 * @see `lib/books/reader-prefetch-window.ts` — which PDF indices to queue
 */

import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import { READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES } from '@/lib/books/reader-prefetch-window'

/** CSS width quantisation for cache keys — coarser than 1px so resize does not thrash (C4). */
export const READER_PREFETCH_WIDTH_BUCKET_PX = 32

/** Quantise width for `(unitId, page, bucket)` keys; see `invalidateReaderPrefetchStaleWidthBucketsForUnit`. */
export function readerPrefetchWidthBucket(widthPx: number): number {
  if (!Number.isFinite(widthPx) || widthPx < 1) return 320
  return Math.max(64, Math.round(widthPx / READER_PREFETCH_WIDTH_BUCKET_PX) * READER_PREFETCH_WIDTH_BUCKET_PX)
}

/**
 * Drop prefetched bitmaps for `unitId` whose width bucket no longer matches the active reader width
 * (e.g. after a large resize). Keeps entries for `readerPrefetchWidthBucket(widthPx)`.
 */
export function invalidateReaderPrefetchStaleWidthBucketsForUnit(unitId: string, widthPx: number): void {
  const keepBucket = readerPrefetchWidthBucket(widthPx)
  const prefix = `${unitId}|`
  let changed = false
  for (const key of [...bitmapCache.keys()]) {
    if (!key.startsWith(prefix)) continue
    const parts = key.split('|')
    const bucketPart = parts[2]
    if (bucketPart === String(keepBucket)) continue
    bitmapCache.get(key)?.close()
    bitmapCache.delete(key)
    changed = true
  }
  if (changed) notifyReaderPrefetchCache()
}

function storageKey(unitId: string, pageNumber: number, widthBucket: number): string {
  return `${unitId}|${pageNumber}|${widthBucket}`
}

let queueRunning = 0
const MAX_CONCURRENT_READER_PREFETCH = 2
const pendingRuns: Array<() => void> = []

function pumpReaderPrefetchQueue() {
  while (queueRunning < MAX_CONCURRENT_READER_PREFETCH && pendingRuns.length > 0) {
    const run = pendingRuns.shift()!
    run()
  }
}

function enqueueReaderPrefetchWork<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pendingRuns.push(() => {
      queueRunning++
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          queueRunning--
          pumpReaderPrefetchQueue()
        })
    })
    pumpReaderPrefetchQueue()
  })
}

const bitmapCache = new Map<string, ImageBitmap>()

const prefetchListeners = new Set<() => void>()

export function subscribeReaderPrefetchCache(listener: () => void): () => void {
  prefetchListeners.add(listener)
  return () => {
    prefetchListeners.delete(listener)
  }
}

function notifyReaderPrefetchCache(): void {
  for (const listener of prefetchListeners) {
    try {
      listener()
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function touchLru(key: string): ImageBitmap | undefined {
  const bmp = bitmapCache.get(key)
  if (!bmp) return undefined
  bitmapCache.delete(key)
  bitmapCache.set(key, bmp)
  return bmp
}

function putBitmap(key: string, bmp: ImageBitmap) {
  const existing = bitmapCache.get(key)
  if (existing && existing !== bmp) {
    existing.close()
    bitmapCache.delete(key)
  }
  while (bitmapCache.size >= READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES && !bitmapCache.has(key)) {
    const first = bitmapCache.keys().next().value as string | undefined
    if (!first) break
    bitmapCache.get(first)?.close()
    bitmapCache.delete(first)
  }
  bitmapCache.set(key, bmp)
  notifyReaderPrefetchCache()
}

export function clearReaderPrefetchCacheForUnit(unitId: string): void {
  const prefix = `${unitId}|`
  for (const key of [...bitmapCache.keys()]) {
    if (key.startsWith(prefix)) {
      bitmapCache.get(key)?.close()
      bitmapCache.delete(key)
    }
  }
  notifyReaderPrefetchCache()
}

/** Peek/touch for Phase C3 — returns bitmap and refreshes LRU order. */
export function getReaderPrefetchedImageBitmap(
  unitId: string,
  pageNumber: number,
  widthPx: number,
): ImageBitmap | undefined {
  if (typeof window === 'undefined') return undefined
  const key = storageKey(unitId, pageNumber, readerPrefetchWidthBucket(widthPx))
  return touchLru(key)
}

async function renderPageToImageBitmap(
  fileUrl: string,
  pageNumber: number,
  targetCssWidthPx: number,
): Promise<ImageBitmap> {
  await ensureReactPdfWorker()
  const pdf: PDFDocumentProxy = await loadCachedPdfDocument(fileUrl)
  const page = await pdf.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = targetCssWidthPx / baseViewport.width
  const renderDensity = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const viewport = page.getViewport({ scale: scale * renderDensity })
  const w = Math.floor(viewport.width)
  const h = Math.floor(viewport.height)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Could not get canvas context for reader prefetch')
  const renderTask = page.render({
    canvas,
    canvasContext: ctx,
    viewport,
  })
  await renderTask.promise
  return await createImageBitmap(canvas)
}

async function prefetchReaderPageBitmapIfMissingInner(args: {
  fileUrl: string
  unitId: string
  pageNumber: number
  widthPx: number
}): Promise<void> {
  const { fileUrl, unitId, pageNumber, widthPx } = args
  if (typeof window === 'undefined') return
  const bucket = readerPrefetchWidthBucket(widthPx)
  const key = storageKey(unitId, pageNumber, bucket)
  if (bitmapCache.has(key)) {
    touchLru(key)
    return
  }
  const bmp = await renderPageToImageBitmap(fileUrl, pageNumber, widthPx)
  putBitmap(key, bmp)
}

export function prefetchReaderPageBitmapIfMissing(args: {
  fileUrl: string
  unitId: string
  pageNumber: number
  widthPx: number
}): Promise<void> {
  return enqueueReaderPrefetchWork(() => prefetchReaderPageBitmapIfMissingInner(args))
}

export interface QueueReaderPrefetchWindowIdleArgs {
  fileUrl: string
  unitId: string
  pages: number[]
  widthPx: number
  /** If provided, skip starting or continuing when this returns false (e.g. overlay closed). */
  shouldProceed?: () => boolean
}

/**
 * Schedules prefetch work on idle time, then queues each page through the PDF work pool.
 * Safe to call frequently — per-page work no-ops on cache hit.
 */
export function queueReaderPrefetchWindowIdle(args: QueueReaderPrefetchWindowIdleArgs): void {
  const { fileUrl, unitId, pages, widthPx, shouldProceed } = args
  if (typeof window === 'undefined') return
  if (!pages.length || !(widthPx > 0)) return

  const runBurst = () => {
    if (shouldProceed && !shouldProceed()) return
    for (const pageNumber of pages) {
      if (shouldProceed && !shouldProceed()) break
      void prefetchReaderPageBitmapIfMissing({ fileUrl, unitId, pageNumber, widthPx }).catch(() => {
        /* single-page failures should not block the rest */
      })
    }
  }

  const ric = window.requestIdleCallback
  if (typeof ric === 'function') {
    ric(
      () => {
        runBurst()
      },
      { timeout: 2000 },
    )
  } else {
    window.setTimeout(runBurst, 1)
  }
}
