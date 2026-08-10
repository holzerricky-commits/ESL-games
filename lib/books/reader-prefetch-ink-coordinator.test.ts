import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_IDLE,
  READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_INK_HOT,
  READER_PREFETCH_MAX_CONCURRENT_IDLE,
  READER_PREFETCH_MAX_CONCURRENT_INK_HOT,
} from '@/lib/books/reader-prefetch-budget-config'

vi.mock('@/lib/books/feature-flags', () => ({
  inkPdfMemoryBudgetEnabled: true,
}))

vi.mock('@/lib/books/ink-session-persist-v2', () => ({
  isInkSessionDrawingHot: vi.fn(() => false),
}))

vi.mock('@/lib/lesson-coach/overlay-busy', () => ({
  isCoachAnnotationGestureActive: vi.fn(() => false),
  registerCoachAnnotationGestureListener: vi.fn(),
}))

import { isInkSessionDrawingHot } from '@/lib/books/ink-session-persist-v2'
import { isCoachAnnotationGestureActive } from '@/lib/lesson-coach/overlay-busy'
import {
  __resetReaderPrefetchInkCoordinatorForTests,
  isReaderPrefetchIdleWorkPaused,
  isReaderPrefetchInkHot,
  markReaderPrefetchInkPointerDown,
  markReaderPrefetchInkPointerUp,
  resolveReaderPrefetchBitmapCacheMaxEntries,
  resolveReaderPrefetchMaxConcurrent,
} from '@/lib/books/reader-prefetch-ink-coordinator'

describe('reader-prefetch-ink-coordinator', () => {
  beforeEach(() => {
    __resetReaderPrefetchInkCoordinatorForTests()
    vi.mocked(isInkSessionDrawingHot).mockReturnValue(false)
    vi.mocked(isCoachAnnotationGestureActive).mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses idle cache and concurrency budgets when ink is cool', () => {
    expect(isReaderPrefetchInkHot()).toBe(false)
    expect(resolveReaderPrefetchBitmapCacheMaxEntries()).toBe(
      READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_IDLE,
    )
    expect(resolveReaderPrefetchMaxConcurrent()).toBe(READER_PREFETCH_MAX_CONCURRENT_IDLE)
    expect(isReaderPrefetchIdleWorkPaused()).toBe(false)
  })

  it('pauses idle prefetch while pointer is down', () => {
    markReaderPrefetchInkPointerDown()
    expect(isReaderPrefetchInkHot()).toBe(true)
    expect(resolveReaderPrefetchBitmapCacheMaxEntries()).toBe(
      READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_INK_HOT,
    )
    expect(resolveReaderPrefetchMaxConcurrent()).toBe(READER_PREFETCH_MAX_CONCURRENT_INK_HOT)
    expect(isReaderPrefetchIdleWorkPaused()).toBe(true)
    markReaderPrefetchInkPointerUp()
    expect(isReaderPrefetchInkHot()).toBe(false)
  })

  it('treats drawing-hot session window as ink hot', () => {
    vi.mocked(isInkSessionDrawingHot).mockReturnValue(true)
    expect(isReaderPrefetchInkHot()).toBe(true)
  })

  it('treats active annotation gestures as ink hot', () => {
    vi.mocked(isCoachAnnotationGestureActive).mockReturnValue(true)
    expect(isReaderPrefetchInkHot()).toBe(true)
  })
})
