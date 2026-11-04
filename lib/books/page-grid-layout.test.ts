import { describe, expect, it } from 'vitest'
import {
  computeCutPageGridLayout,
  computePageGridLayout,
  CUT_PAGE_GRID_MAX_COLS,
  CUT_PAGE_GRID_MIN_COLS,
  CUT_PAGE_GRID_THUMB_RENDER_WIDTH,
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

  it('accepts denser options for cut scanning', () => {
    const m = computePageGridLayout(1400, {
      minCols: CUT_PAGE_GRID_MIN_COLS,
      maxCols: CUT_PAGE_GRID_MAX_COLS,
      targetPageWidthPx: 110,
      gapPx: 8,
      padPx: 12,
    })
    expect(m.cols).toBeGreaterThanOrEqual(8)
    expect(m.cols).toBeLessThanOrEqual(CUT_PAGE_GRID_MAX_COLS)
  })
})

describe('computeCutPageGridLayout', () => {
  it('packs more columns than the overview grid', () => {
    const overview = computePageGridLayout(1600)
    const cut = computeCutPageGridLayout(1600)
    expect(cut.cols).toBeGreaterThan(overview.cols)
    expect(cut.cols).toBeGreaterThanOrEqual(CUT_PAGE_GRID_MIN_COLS)
    expect(cut.cols).toBeLessThanOrEqual(CUT_PAGE_GRID_MAX_COLS)
  })
})

describe('PAGE_GRID_THUMB_RENDER_WIDTH', () => {
  it('stays fixed so Overview thumbs do not reload on resize', () => {
    expect(PAGE_GRID_THUMB_RENDER_WIDTH).toBe(240)
  })
})

describe('CUT_PAGE_GRID_THUMB_RENDER_WIDTH', () => {
  it('stays smaller than overview so dense tiles stay sharp without over-rendering', () => {
    expect(CUT_PAGE_GRID_THUMB_RENDER_WIDTH).toBeLessThan(PAGE_GRID_THUMB_RENDER_WIDTH)
  })
})
