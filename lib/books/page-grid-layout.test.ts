import { describe, expect, it } from 'vitest'
import {
  computePageGridLayout,
  PAGE_GRID_MAX_COLS,
  PAGE_GRID_MIN_COLS,
  PAGE_GRID_THUMB_RENDER_WIDTH,
} from '@/lib/books/page-grid-layout'

describe('computePageGridLayout', () => {
  it('fills a typical desk with 4–5 columns', () => {
    const m = computePageGridLayout(1100)
    expect(m.cols).toBeGreaterThanOrEqual(4)
    expect(m.cols).toBeLessThanOrEqual(5)
    expect(m.pageWidthPx * m.cols + m.gapPx * (m.cols - 1)).toBeLessThanOrEqual(
      1100 - m.padPx * 2 + 1,
    )
  })

  it('clamps to min/max columns', () => {
    expect(computePageGridLayout(400).cols).toBe(PAGE_GRID_MIN_COLS)
    expect(computePageGridLayout(2400).cols).toBe(PAGE_GRID_MAX_COLS)
  })
})

describe('PAGE_GRID_THUMB_RENDER_WIDTH', () => {
  it('stays fixed so Overview thumbs do not reload on resize', () => {
    expect(PAGE_GRID_THUMB_RENDER_WIDTH).toBe(240)
  })
})
