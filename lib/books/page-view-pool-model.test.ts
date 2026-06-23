import { describe, expect, it } from 'vitest'
import {
  computePooledPageIndices,
  diffPageViewPool,
  getActiveSpreadPageNumbers,
  PAGE_VIEW_POOL_RADIUS,
  resolvePageViewSlotRole,
} from '@/lib/books/page-view-pool-model'

describe('computePooledPageIndices', () => {
  const bounds = { min: 1, max: 100 }
  const visible = Array.from({ length: 30 }, (_, i) => i + 1)

  it('returns anchor ± pool radius intersected with visible list', () => {
    const anchor = 15
    const out = computePooledPageIndices({ anchorPage: anchor, visiblePages: visible, readerBounds: bounds })
    expect(out[0]).toBe(anchor - PAGE_VIEW_POOL_RADIUS)
    expect(out[out.length - 1]).toBe(anchor + PAGE_VIEW_POOL_RADIUS)
    expect(out).toHaveLength(PAGE_VIEW_POOL_RADIUS * 2 + 1)
  })

  it('truncates at visible list edges', () => {
    const out = computePooledPageIndices({ anchorPage: 3, visiblePages: visible, readerBounds: bounds })
    expect(out[0]).toBe(1)
    expect(out).toContain(3)
  })

  it('when visible list is empty, returns single clamped page', () => {
    const out = computePooledPageIndices({
      anchorPage: 50,
      visiblePages: [],
      readerBounds: { min: 10, max: 20 },
    })
    expect(out).toEqual([20])
  })
})

describe('resolvePageViewSlotRole', () => {
  it('assigns left/right for two-up spread', () => {
    expect(resolvePageViewSlotRole(4, 4, 5)).toEqual({ role: 'left', isActiveSpread: true })
    expect(resolvePageViewSlotRole(5, 4, 5)).toEqual({ role: 'right', isActiveSpread: true })
    expect(resolvePageViewSlotRole(6, 4, 5)).toEqual({ role: 'hidden', isActiveSpread: false })
  })

  it('assigns left only when spread has no right page', () => {
    expect(resolvePageViewSlotRole(7, 7, null)).toEqual({ role: 'left', isActiveSpread: true })
    expect(resolvePageViewSlotRole(8, 7, null)).toEqual({ role: 'hidden', isActiveSpread: false })
  })
})

describe('getActiveSpreadPageNumbers', () => {
  it('returns anchor only when no right page', () => {
    expect(getActiveSpreadPageNumbers({ anchorPage: 3, spreadRightPage: null })).toEqual([3])
  })

  it('returns both pages in spread mode', () => {
    expect(getActiveSpreadPageNumbers({ anchorPage: 3, spreadRightPage: 4 })).toEqual([3, 4])
  })
})

describe('diffPageViewPool', () => {
  it('reports added and removed pages', () => {
    expect(diffPageViewPool([1, 2, 3], [2, 3, 4])).toEqual({ added: [4], removed: [1] })
  })
})
