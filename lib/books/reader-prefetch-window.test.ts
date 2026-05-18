import { describe, expect, it } from 'vitest'
import { readerPrefetchWidthBucket } from '@/lib/books/reader-page-prefetch-queue'
import {
  getReaderPrefetchVisiblePageIndices,
  READER_PREFETCH_VISIBLE_SLOTS_AFTER,
  READER_PREFETCH_VISIBLE_SLOTS_BEFORE,
} from '@/lib/books/reader-prefetch-window'

describe('readerPrefetchWidthBucket', () => {
  it('quantises to 32px steps with a sensible minimum', () => {
    expect(readerPrefetchWidthBucket(323)).toBe(320)
    expect(readerPrefetchWidthBucket(350)).toBe(352)
    expect(readerPrefetchWidthBucket(0)).toBe(320)
  })
})

describe('getReaderPrefetchVisiblePageIndices', () => {
  const bounds = { min: 1, max: 100 }

  it('returns a window centered on the anchor in visible-list space', () => {
    const visible = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const out = getReaderPrefetchVisiblePageIndices({
      anchorPage: 15,
      visiblePages: visible,
      readerBounds: bounds,
    })
    const idx = visible.indexOf(15)
    expect(out).toEqual(
      visible.slice(
        Math.max(0, idx - READER_PREFETCH_VISIBLE_SLOTS_BEFORE),
        Math.min(visible.length, idx + READER_PREFETCH_VISIBLE_SLOTS_AFTER + 1),
      ),
    )
    expect(out).toContain(15)
    expect(out.length).toBeLessThanOrEqual(READER_PREFETCH_VISIBLE_SLOTS_BEFORE + READER_PREFETCH_VISIBLE_SLOTS_AFTER + 1)
  })

  it('never returns pages outside the visible list', () => {
    const visible = [2, 4, 6, 8, 10]
    const out = getReaderPrefetchVisiblePageIndices({
      anchorPage: 6,
      visiblePages: visible,
      readerBounds: bounds,
    })
    for (const p of out) {
      expect(visible).toContain(p)
    }
  })

  it('clamps anchor to visible then expands (hidden gaps in manifest)', () => {
    const visible = [1, 3, 5, 7, 9]
    const out = getReaderPrefetchVisiblePageIndices({
      anchorPage: 4,
      visiblePages: visible,
      readerBounds: bounds,
    })
    expect(out.every((p) => visible.includes(p))).toBe(true)
    expect(out).toContain(3)
  })

  it('truncates at the ends of the visible list', () => {
    const visible = Array.from({ length: 15 }, (_, i) => i + 1)
    const nearStart = getReaderPrefetchVisiblePageIndices({
      anchorPage: 2,
      visiblePages: visible,
      readerBounds: bounds,
    })
    expect(nearStart[0]).toBe(1)
    expect(nearStart.length).toBeLessThan(visible.length)

    const nearEnd = getReaderPrefetchVisiblePageIndices({
      anchorPage: 14,
      visiblePages: visible,
      readerBounds: bounds,
    })
    expect(nearEnd[nearEnd.length - 1]).toBe(15)
    expect(nearEnd.length).toBeLessThan(visible.length)
  })

  it('when visible list is empty, returns single page clamped to reader bounds', () => {
    const out = getReaderPrefetchVisiblePageIndices({
      anchorPage: 50,
      visiblePages: [],
      readerBounds: { min: 10, max: 20 },
    })
    expect(out).toEqual([20])
  })
})
