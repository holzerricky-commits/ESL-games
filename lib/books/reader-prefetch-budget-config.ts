/** Soft caps for reader PDF bitmap LRU (R7 — `docs/INK_ENGINE_V2.md`). */
export const READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_IDLE = 48

/** Tighter cap while ink pointer is down or session revision is hot. */
export const READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_INK_HOT = 24

export const READER_PREFETCH_MAX_CONCURRENT_IDLE = 3

export const READER_PREFETCH_MAX_CONCURRENT_INK_HOT = 1

/** @deprecated Import from `reader-prefetch-budget-config` in new code. */
export const READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES = READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES_IDLE
