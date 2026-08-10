import { inkPdfMemoryBudgetEnabled } from '@/lib/books/feature-flags'
import { isInkSessionDrawingHot } from '@/lib/books/ink-session-persist-v2'
import { INK_SESSION_DRAWING_HOT_MS } from '@/lib/books/ink-session-persist-config'
import {
  isCoachAnnotationGestureActive,
  registerCoachAnnotationGestureListener,
} from '@/lib/lesson-coach/overlay-busy'
import {
  READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_IDLE,
  READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_INK_HOT,
  READER_PREFETCH_MAX_CONCURRENT_IDLE,
  READER_PREFETCH_MAX_CONCURRENT_INK_HOT,
} from '@/lib/books/reader-prefetch-budget-config'

type Listener = () => void

let inkPointerDownCount = 0
let lastHot = false
let drawingHotExpiryTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<Listener>()

function notifyIfHotChanged(nextHot: boolean): void {
  if (nextHot === lastHot) return
  lastHot = nextHot
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function computeInkHot(): boolean {
  if (!inkPdfMemoryBudgetEnabled) return false
  return (
    inkPointerDownCount > 0 ||
    isInkSessionDrawingHot() ||
    isCoachAnnotationGestureActive()
  )
}

export function isReaderPrefetchInkHot(): boolean {
  return computeInkHot()
}

/** Pause P1 / idle prefetch worker scheduling while ink is hot (R7). */
export function isReaderPrefetchIdleWorkPaused(): boolean {
  return isReaderPrefetchInkHot()
}

export function resolveReaderPrefetchBitmapCacheMaxEntries(): number {
  return isReaderPrefetchInkHot()
    ? READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_INK_HOT
    : READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_IDLE
}

export function resolveReaderPrefetchMaxConcurrent(): number {
  return isReaderPrefetchInkHot()
    ? READER_PREFETCH_MAX_CONCURRENT_INK_HOT
    : READER_PREFETCH_MAX_CONCURRENT_IDLE
}

function scheduleDrawingHotExpiryCheck(): void {
  if (drawingHotExpiryTimer) clearTimeout(drawingHotExpiryTimer)
  if (!isInkSessionDrawingHot()) return
  drawingHotExpiryTimer = setTimeout(() => {
    drawingHotExpiryTimer = null
    notifyIfHotChanged(computeInkHot())
  }, INK_SESSION_DRAWING_HOT_MS + 32)
}

export function markReaderPrefetchInkPointerDown(): void {
  if (!inkPdfMemoryBudgetEnabled) return
  inkPointerDownCount++
  scheduleDrawingHotExpiryCheck()
  notifyIfHotChanged(computeInkHot())
}

export function markReaderPrefetchInkPointerUp(): void {
  if (!inkPdfMemoryBudgetEnabled) return
  inkPointerDownCount = Math.max(0, inkPointerDownCount - 1)
  scheduleDrawingHotExpiryCheck()
  notifyIfHotChanged(computeInkHot())
}

/** Called when ink session revision bumps (spread / whiteboard store). */
export function notifyReaderPrefetchInkRevisionHot(): void {
  if (!inkPdfMemoryBudgetEnabled) return
  scheduleDrawingHotExpiryCheck()
  notifyIfHotChanged(computeInkHot())
}

export function subscribeReaderPrefetchInkCoordinator(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function __resetReaderPrefetchInkCoordinatorForTests(): void {
  inkPointerDownCount = 0
  lastHot = false
  if (drawingHotExpiryTimer) clearTimeout(drawingHotExpiryTimer)
  drawingHotExpiryTimer = null
  listeners.clear()
}

if (typeof window !== 'undefined') {
  registerCoachAnnotationGestureListener(() => {
    notifyIfHotChanged(computeInkHot())
  })
}
