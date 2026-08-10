/**
 * PageRenderCache (Phase 1 stable pages) — PDF page raster LRU for the fullscreen reader.
 *
 * Renders neighbour pages at reader width (bucketed) into `ImageBitmap`s using the same
 * `loadCachedPdfDocument` + PDF.js worker path as thumbnails (`pdf-thumbnail-cache.ts`).
 * Concurrency and idle scheduling keep the map / main thread responsive.
 *
 * Phase 1: `CachedPageCanvas` paints cache hits while react-pdf loads off-screen.
 * Phase 3: once composited, live react-pdf is primary; cache is a loading placeholder only.
 *
 * Public aliases: `lib/books/page-render-cache.ts`.
 *
 * @see `lib/books/reader-prefetch-window.ts` — which PDF indices to queue
 */

import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import { resolveReaderPageRenderDensity } from '@/lib/books/reader-page-render-width'
import {
  isReaderPrefetchIdleWorkPaused,
  resolveReaderPrefetchBitmapCacheMaxEntries,
  resolveReaderPrefetchMaxConcurrent,
  subscribeReaderPrefetchInkCoordinator,
} from '@/lib/books/reader-prefetch-ink-coordinator'

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
  const keepLowBucket = readerPrefetchLowResWidthBucket(widthPx)
  const prefix = `${unitId}|`
  const lowPrefix = `${LOW_RES_KEY_PREFIX}${unitId}|`
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
  for (const key of [...lowResBitmapCache.keys()]) {
    if (!key.startsWith(lowPrefix)) continue
    const parts = key.split('|')
    const bucketPart = parts[3]
    if (bucketPart === String(keepLowBucket)) continue
    lowResBitmapCache.get(key)?.close()
    lowResBitmapCache.delete(key)
    changed = true
  }
  if (changed) notifyReaderPrefetchCache()
}

function storageKey(unitId: string, pageNumber: number, widthBucket: number): string {
  return `${unitId}|${pageNumber}|${widthBucket}`
}

let queueRunning = 0
const MAX_CONCURRENT_READER_PREFETCH = 3
/** R2.4 — higher burst for P0 immediate full-res (idle + thumbnails stay at 3 / 2). */
export const MAX_CONCURRENT_READER_PREFETCH_IMMEDIATE = 5
const pendingRuns: Array<() => void> = []

let immediateQueueRunning = 0
const pendingImmediateRuns: Array<() => void> = []

let pendingIdlePrefetchBurst: (() => void) | null = null

function trimPrefetchBitmapCachesToBudget(): void {
  let changed = false
  const maxFull = resolveReaderPrefetchBitmapCacheMaxEntries()
  while (bitmapCache.size > maxFull) {
    const first = bitmapCache.keys().next().value as string | undefined
    if (!first) break
    bitmapCache.get(first)?.close()
    bitmapCache.delete(first)
    changed = true
  }
  while (lowResBitmapCache.size > maxFull) {
    const first = lowResBitmapCache.keys().next().value as string | undefined
    if (!first) break
    lowResBitmapCache.get(first)?.close()
    lowResBitmapCache.delete(first)
    changed = true
  }
  if (changed) notifyReaderPrefetchCache()
}

function onReaderPrefetchInkCoordinatorChange(): void {
  trimPrefetchBitmapCachesToBudget()
  if (!isReaderPrefetchIdleWorkPaused()) {
    pumpReaderPrefetchQueue()
    runPendingIdlePrefetchBurst()
  }
}

if (typeof window !== 'undefined') {
  subscribeReaderPrefetchInkCoordinator(onReaderPrefetchInkCoordinatorChange)
}

function pumpReaderPrefetchQueue() {
  const maxConcurrent = resolveReaderPrefetchMaxConcurrent()
  while (queueRunning < maxConcurrent && pendingRuns.length > 0) {
    if (isReaderPrefetchIdleWorkPaused()) return
    const run = pendingRuns.shift()!
    run()
  }
}

function pumpReaderPrefetchImmediateQueue() {
  while (
    immediateQueueRunning < MAX_CONCURRENT_READER_PREFETCH_IMMEDIATE &&
    pendingImmediateRuns.length > 0
  ) {
    const run = pendingImmediateRuns.shift()!
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
    if (!isReaderPrefetchIdleWorkPaused()) {
      pumpReaderPrefetchQueue()
    }
  })
}

function enqueueReaderPrefetchImmediateWork<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pendingImmediateRuns.push(() => {
      immediateQueueRunning++
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          immediateQueueRunning--
          pumpReaderPrefetchImmediateQueue()
        })
    })
    pumpReaderPrefetchImmediateQueue()
  })
}

const bitmapCache = new Map<string, ImageBitmap>()
const lowResBitmapCache = new Map<string, ImageBitmap>()

const LOW_RES_KEY_PREFIX = 'lr|'

function lowResStorageKey(unitId: string, pageNumber: number, widthBucket: number): string {
  return `${LOW_RES_KEY_PREFIX}${unitId}|${pageNumber}|${widthBucket}`
}

/** R2.6 — fast placeholder render width (~quarter of reader CSS width). */
export function readerPrefetchLowResTargetWidth(widthPx: number): number {
  if (!Number.isFinite(widthPx) || widthPx < 1) return 64
  return Math.max(64, Math.round(widthPx / 4))
}

export function readerPrefetchLowResWidthBucket(widthPx: number): number {
  const target = readerPrefetchLowResTargetWidth(widthPx)
  return Math.max(64, Math.round(target / 16) * 16)
}

const prefetchListeners = new Set<() => void>()
let prefetchCacheRevision = 0

export function subscribeReaderPrefetchCache(listener: () => void): () => void {
  prefetchListeners.add(listener)
  return () => {
    prefetchListeners.delete(listener)
  }
}

/** Monotonic counter for `useSyncExternalStore` — bumps when LRU entries are added or removed. */
export function getReaderPrefetchCacheRevisionSnapshot(): number {
  return prefetchCacheRevision
}

function notifyReaderPrefetchCache(): void {
  prefetchCacheRevision++
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
  while (bitmapCache.size >= resolveReaderPrefetchBitmapCacheMaxEntries() && !bitmapCache.has(key)) {
    const first = bitmapCache.keys().next().value as string | undefined
    if (!first) break
    bitmapCache.get(first)?.close()
    bitmapCache.delete(first)
  }
  bitmapCache.set(key, bmp)
  notifyReaderPrefetchCache()
}

function touchLowResLru(key: string): ImageBitmap | undefined {
  const bmp = lowResBitmapCache.get(key)
  if (!bmp) return undefined
  lowResBitmapCache.delete(key)
  lowResBitmapCache.set(key, bmp)
  return bmp
}

function putLowResBitmap(key: string, bmp: ImageBitmap) {
  const existing = lowResBitmapCache.get(key)
  if (existing && existing !== bmp) {
    existing.close()
    lowResBitmapCache.delete(key)
  }
  while (
    lowResBitmapCache.size >= resolveReaderPrefetchBitmapCacheMaxEntries() &&
    !lowResBitmapCache.has(key)
  ) {
    const first = lowResBitmapCache.keys().next().value as string | undefined
    if (!first) break
    lowResBitmapCache.get(first)?.close()
    lowResBitmapCache.delete(first)
  }
  lowResBitmapCache.set(key, bmp)
  notifyReaderPrefetchCache()
}

export function clearReaderPrefetchCacheForUnit(unitId: string): void {
  const prefix = `${unitId}|`
  const lowPrefix = `${LOW_RES_KEY_PREFIX}${unitId}|`
  for (const key of [...bitmapCache.keys()]) {
    if (key.startsWith(prefix)) {
      bitmapCache.get(key)?.close()
      bitmapCache.delete(key)
    }
  }
  for (const key of [...lowResBitmapCache.keys()]) {
    if (key.startsWith(lowPrefix)) {
      lowResBitmapCache.get(key)?.close()
      lowResBitmapCache.delete(key)
    }
  }
  notifyReaderPrefetchCache()
}

/** Drop full-res cache entries for specific pages at a width bucket (e.g. browser zoom / DPR change). */
export function invalidateReaderPrefetchPagesAtWidth(
  unitId: string,
  pages: readonly number[],
  widthPx: number,
): void {
  if (typeof window === 'undefined') return
  const bucket = readerPrefetchWidthBucket(widthPx)
  let changed = false
  for (const pageNumber of pages) {
    const key = storageKey(unitId, pageNumber, bucket)
    const existing = bitmapCache.get(key)
    if (!existing) continue
    existing.close()
    bitmapCache.delete(key)
    changed = true
  }
  if (changed) notifyReaderPrefetchCache()
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

/** R2.6 — peek/touch low-res placeholder bitmap (R3 display). */
export function getReaderPrefetchedLowResBitmap(
  unitId: string,
  pageNumber: number,
  widthPx: number,
): ImageBitmap | undefined {
  if (typeof window === 'undefined') return undefined
  const key = lowResStorageKey(unitId, pageNumber, readerPrefetchLowResWidthBucket(widthPx))
  return touchLowResLru(key)
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
  const renderDensity = resolveReaderPageRenderDensity(1)
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

function prefetchReaderPageBitmapIfMissingImmediate(args: {
  fileUrl: string
  unitId: string
  pageNumber: number
  widthPx: number
}): Promise<void> {
  return enqueueReaderPrefetchImmediateWork(() => prefetchReaderPageBitmapIfMissingInner(args))
}

async function prefetchReaderPageLowResBitmapIfMissingInner(args: {
  fileUrl: string
  unitId: string
  pageNumber: number
  widthPx: number
}): Promise<void> {
  const { fileUrl, unitId, pageNumber, widthPx } = args
  if (typeof window === 'undefined') return
  const targetWidth = readerPrefetchLowResTargetWidth(widthPx)
  const bucket = readerPrefetchLowResWidthBucket(widthPx)
  const key = lowResStorageKey(unitId, pageNumber, bucket)
  if (lowResBitmapCache.has(key)) {
    touchLowResLru(key)
    return
  }
  const bmp = await renderPageToImageBitmap(fileUrl, pageNumber, targetWidth)
  putLowResBitmap(key, bmp)
}

function prefetchReaderPageLowResBitmapIfMissingImmediate(args: {
  fileUrl: string
  unitId: string
  pageNumber: number
  widthPx: number
}): Promise<void> {
  return enqueueReaderPrefetchImmediateWork(() => prefetchReaderPageLowResBitmapIfMissingInner(args))
}

export interface QueueReaderPrefetchPagesArgs {
  fileUrl: string
  unitId: string
  pages: number[]
  widthPx: number
  /** If provided, skip starting or continuing when this returns false (e.g. overlay closed). */
  shouldProceed?: () => boolean
}

/** E3 / R2 — Prefetch without idle delay (P0 immediate window). */
export function queueReaderPrefetchPagesImmediate(args: QueueReaderPrefetchPagesArgs): void {
  const { fileUrl, unitId, pages, widthPx, shouldProceed } = args
  if (typeof window === 'undefined') return
  if (!pages.length || !(widthPx > 0)) return
  for (const pageNumber of pages) {
    if (shouldProceed && !shouldProceed()) break
    void prefetchReaderPageBitmapIfMissingImmediate({ fileUrl, unitId, pageNumber, widthPx }).catch(
      () => {
        /* single-page failures should not block the rest */
      },
    )
  }
}

/** R2.6 — Low-res P0 placeholders (parallel with full-res immediate queue). */
export function queueReaderPrefetchPagesLowRes(args: QueueReaderPrefetchPagesArgs): void {
  const { fileUrl, unitId, pages, widthPx, shouldProceed } = args
  if (typeof window === 'undefined') return
  if (!pages.length || !(widthPx > 0)) return
  for (const pageNumber of pages) {
    if (shouldProceed && !shouldProceed()) break
    void prefetchReaderPageLowResBitmapIfMissingImmediate({
      fileUrl,
      unitId,
      pageNumber,
      widthPx,
    }).catch(() => {
      /* single-page failures should not block the rest */
    })
  }
}

export interface QueueReaderPrefetchWindowIdleArgs {
  fileUrl: string
  unitId: string
  pages: number[]
  widthPx: number
  /** If provided, skip starting or continuing when this returns false (e.g. overlay closed). */
  shouldProceed?: () => boolean
}

function runPendingIdlePrefetchBurst(): void {
  const burst = pendingIdlePrefetchBurst
  pendingIdlePrefetchBurst = null
  burst?.()
}

/**
 * Schedules prefetch work on idle time, then queues each page through the PDF work pool.
 * Safe to call frequently — per-page work no-ops on cache hit.
 * R7: defers while ink pointer / revision is hot.
 */
export function queueReaderPrefetchWindowIdle(args: QueueReaderPrefetchWindowIdleArgs): void {
  const { fileUrl, unitId, pages, widthPx, shouldProceed } = args
  if (typeof window === 'undefined') return
  if (!pages.length || !(widthPx > 0)) return

  const runBurst = () => {
    if (shouldProceed && !shouldProceed()) return
    if (isReaderPrefetchIdleWorkPaused()) {
      pendingIdlePrefetchBurst = runBurst
      return
    }
    for (const pageNumber of pages) {
      if (shouldProceed && !shouldProceed()) break
      void prefetchReaderPageBitmapIfMissing({ fileUrl, unitId, pageNumber, widthPx }).catch(() => {
        /* single-page failures should not block the rest */
      })
    }
  }

  if (isReaderPrefetchIdleWorkPaused()) {
    pendingIdlePrefetchBurst = runBurst
    return
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
