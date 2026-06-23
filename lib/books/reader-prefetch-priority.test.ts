import { describe, expect, it } from 'vitest'
import {
  READER_MAP_WARM_P0_FORWARD_SPREADS,
  READER_PREFETCH_P0_BACK_SPREADS,
  READER_PREFETCH_P0_FORWARD_SPREADS,
  resolveReaderPrefetchP0SpreadCounts,
  splitReaderPrefetchPages,
} from '@/lib/books/reader-prefetch-priority'
import { getReaderPrefetchVisiblePageIndices } from '@/lib/books/reader-prefetch-window'

describe('splitReaderPrefetchPages', () => {
  const bounds = { min: 1, max: 100 }

  it('P0 includes current spread and next three two-up spreads forward', () => {
    const visible = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const { immediate } = splitReaderPrefetchPages({
      anchorPage: 3,
      visiblePages: visible,
      readerBounds: bounds,
    })
    expect(immediate).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 1, 2])
  })

  it('P0 includes one spread back in two-up mode', () => {
    const visible = [1, 2, 3, 4, 5, 6, 7, 8]
    const { immediate } = splitReaderPrefetchPages({
      anchorPage: 5,
      visiblePages: visible,
      readerBounds: bounds,
    })
    expect(immediate.slice(0, 2)).toEqual([5, 6])
    expect(immediate).toContain(3)
    expect(immediate).toContain(4)
  })

  it('orders immediate forward-first from anchor', () => {
    const visible = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const { immediate } = splitReaderPrefetchPages({
      anchorPage: 14,
      visiblePages: visible,
      readerBounds: bounds,
    })
    const idx14 = immediate.indexOf(14)
    const idx16 = immediate.indexOf(16)
    const idx18 = immediate.indexOf(18)
    const idx12 = immediate.indexOf(12)
    expect(idx14).toBeGreaterThanOrEqual(0)
    expect(idx16).toBeGreaterThan(idx14)
    expect(idx18).toBeGreaterThan(idx16)
    if (idx12 >= 0) {
      expect(idx12).toBeGreaterThan(idx18)
    }
  })

  it('idle is window minus immediate without duplicates', () => {
    const visible = Array.from({ length: 25 }, (_, i) => i + 1)
    const anchorPage = 12
    const { immediate, idle } = splitReaderPrefetchPages({
      anchorPage,
      visiblePages: visible,
      readerBounds: bounds,
    })
    const windowPages = getReaderPrefetchVisiblePageIndices({
      anchorPage,
      visiblePages: visible,
      readerBounds: bounds,
    })
    const immediateSet = new Set(immediate)
    expect(idle.every((p) => windowPages.includes(p))).toBe(true)
    expect(idle.every((p) => !immediateSet.has(p))).toBe(true)
    expect(immediate.length + idle.length).toBe(windowPages.length)
  })

  it('deduplicates PDF pages when spreads overlap at window edge', () => {
    const visible = [1, 2, 3, 4]
    const { immediate } = splitReaderPrefetchPages({
      anchorPage: 1,
      visiblePages: visible,
      readerBounds: bounds,
    })
    expect(new Set(immediate).size).toBe(immediate.length)
  })

  it('when visible list is empty returns clamped anchor only', () => {
    const { immediate, idle } = splitReaderPrefetchPages({
      anchorPage: 50,
      visiblePages: [],
      readerBounds: { min: 10, max: 20 },
    })
    expect(immediate).toEqual([20])
    expect(idle).toEqual([])
  })

  it('uses P0 spread counts from policy constants', () => {
    expect(READER_PREFETCH_P0_FORWARD_SPREADS).toBe(3)
    expect(READER_PREFETCH_P0_BACK_SPREADS).toBe(1)
    expect(READER_MAP_WARM_P0_FORWARD_SPREADS).toBe(2)
  })

  it('R5.1 backward bias prioritizes spreads behind anchor', () => {
    const visible = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    const { immediate } = splitReaderPrefetchPages({
      anchorPage: 7,
      visiblePages: visible,
      readerBounds: bounds,
      directionBias: 'backward',
      intent: 'routine',
    })
    const idx5 = immediate.indexOf(5)
    const idx9 = immediate.indexOf(9)
    expect(idx5).toBeGreaterThanOrEqual(0)
    expect(idx9).toBeGreaterThanOrEqual(0)
    expect(idx5).toBeLessThan(idx9)
  })

  it('R5.2 jump intent limits P0 to target ±1 spread', () => {
    const visible = Array.from({ length: 20 }, (_, i) => i + 1)
    const { immediate } = splitReaderPrefetchPages({
      anchorPage: 12,
      visiblePages: visible,
      readerBounds: bounds,
      intent: 'jump',
    })
    expect(immediate).toContain(12)
    expect(immediate).toContain(11)
    expect(immediate).toContain(13)
    expect(immediate).toContain(14)
    expect(immediate).not.toContain(16)
  })

  it('R5.3 map-warm intent includes current and two spreads forward', () => {
    const visible = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const { immediate } = splitReaderPrefetchPages({
      anchorPage: 3,
      visiblePages: visible,
      readerBounds: bounds,
      intent: 'map-warm',
    })
    expect(immediate).toEqual([3, 4, 5, 6, 7, 8, 1, 2])
  })
})

describe('resolveReaderPrefetchP0SpreadCounts', () => {
  it('swaps forward/back counts when direction is backward', () => {
    expect(resolveReaderPrefetchP0SpreadCounts({ directionBias: 'backward' })).toEqual({
      forwardSpreads: 1,
      backSpreads: 3,
      neighboursFirst: 'back',
    })
  })
})
