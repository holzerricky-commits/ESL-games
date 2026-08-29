import { describe, expect, it } from 'vitest'
import { spreadClusterWidthPx } from '@/lib/books/spread-canvas-coords'
import {
  BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_X_PX,
  BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_Y_PX,
} from '@/lib/books/book-spread-desk-shadow'
import {
  BOOK_SPREAD_FRAME_LAYOUT_SAFETY_PX,
  computeBookSpreadFrameOuterBox,
} from '@/lib/books/book-spread-frame-metrics'
import { DEFAULT_SPREAD_GUTTER_PULL_RATIO } from '@/lib/books/spread-gutter'
import {
  computePageCanvasHeightPx,
  computeSpreadClusterLayoutSlot,
  computeSpreadClusterMetrics,
  computeSpreadFitScale,
  computeSpreadPageWidth,
  computeSpreadReaderDisplayScale,
  computeSpreadReaderResizeScale,
} from '@/lib/books/spread-viewport-layout'

describe('computeSpreadPageWidth', () => {
  it('fits the open-book frame inside the viewport at scale 1', () => {
    const aspect = 1 / 1.414
    const w = 1200
    const h = 800
    const width = computeSpreadPageWidth(w, h, aspect)
    const outer = computeBookSpreadFrameOuterBox(
      Math.round(spreadClusterWidthPx(width, Math.round(width * DEFAULT_SPREAD_GUTTER_PULL_RATIO))),
      Math.round(width / aspect),
    )
    expect(outer.widthPx).toBeLessThanOrEqual(
      w - BOOK_SPREAD_FRAME_LAYOUT_SAFETY_PX - BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_X_PX,
    )
    expect(outer.heightPx).toBeLessThanOrEqual(
      h - BOOK_SPREAD_FRAME_LAYOUT_SAFETY_PX - BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_Y_PX,
    )
  })
})

describe('computeSpreadReaderDisplayScale', () => {
  it('returns 1 at frame-aware width when page area matches viewport', () => {
    const aspect = 1 / 1.414
    const w = 1200
    const h = 800
    const pageWidth = computeSpreadPageWidth(w, h, aspect)
    const cluster = computeSpreadClusterMetrics(pageWidth, aspect, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    const scale = computeSpreadReaderDisplayScale(
      1,
      w,
      h,
      cluster.spreadOverlayWidthPx,
      cluster.pageCanvasHeightPx,
      true,
    )
    expect(scale).toBeCloseTo(1, 5)
  })

  it('allows upscale when the painted frame still fits', () => {
    const cluster = computeSpreadClusterMetrics(360, 1 / 1.414, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    const outer = computeBookSpreadFrameOuterBox(
      cluster.spreadOverlayWidthPx,
      cluster.pageCanvasHeightPx,
    )
    const scale = computeSpreadReaderDisplayScale(
      1.2,
      outer.widthPx * 1.5,
      outer.heightPx * 1.5,
      cluster.spreadOverlayWidthPx,
      cluster.pageCanvasHeightPx,
      true,
    )
    expect(scale).toBeGreaterThan(1)
    expect(scale).toBeLessThanOrEqual(1.2)
  })

  it('shrinks scale when the painted frame would exceed the page area', () => {
    const cluster = computeSpreadClusterMetrics(420, 1 / 1.414, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    const outer = computeBookSpreadFrameOuterBox(
      cluster.spreadOverlayWidthPx,
      cluster.pageCanvasHeightPx,
    )
    const scale = computeSpreadReaderDisplayScale(
      1,
      outer.widthPx - 2,
      outer.heightPx - 2,
      cluster.spreadOverlayWidthPx,
      cluster.pageCanvasHeightPx,
      true,
    )
    expect(scale).toBeLessThan(1)
  })

  it('allows upscale when export mode omits the frame', () => {
    const scale = computeSpreadReaderDisplayScale(1.2, 900, 700, 800, 560, false)
    expect(scale).toBeGreaterThan(1)
    expect(scale).toBeLessThanOrEqual(1.2)
  })
})

describe('computePageCanvasHeightPx', () => {
  it('derives height from width and aspect', () => {
    expect(computePageCanvasHeightPx(400, 0.5)).toBe(800)
  })
})

describe('computeSpreadClusterMetrics', () => {
  it('uses flush side-by-side layout when overlap is disabled', () => {
    const m = computeSpreadClusterMetrics(400, 1 / 1.414, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    expect(m.gutterPullPx).toBe(0)
    expect(m.spreadOverlayWidthPx).toBe(400 * 2)
  })
})

describe('computeSpreadFitScale', () => {
  it('never upscales above 1', () => {
    expect(computeSpreadFitScale(2000, 2000, 400, 600)).toBe(1)
  })

  it('shrinks when cluster exceeds container', () => {
    const scale = computeSpreadFitScale(300, 400, 800, 600)
    expect(scale).toBeLessThan(1)
    expect(scale).toBeCloseTo(Math.min(300 / 800, 400 / 600), 5)
  })

  it('accounts for frame chrome when includeBookFrame is true', () => {
    const cluster = computeSpreadClusterMetrics(400, 1 / 1.414, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    const outer = computeBookSpreadFrameOuterBox(
      cluster.spreadOverlayWidthPx,
      cluster.pageCanvasHeightPx,
    )
    const scale = computeSpreadFitScale(
      outer.widthPx,
      outer.heightPx,
      cluster.spreadOverlayWidthPx,
      cluster.pageCanvasHeightPx,
      true,
    )
    expect(scale).toBeLessThanOrEqual(1)
  })
})

describe('computeSpreadReaderResizeScale', () => {
  it('uses outer-box ratios so scaled bucket matches target frame size', () => {
    const aspect = 1 / 1.414
    const layout = 380
    const target = 460
    const scale = computeSpreadReaderResizeScale(layout, target, aspect)
    const layoutCluster = computeSpreadClusterMetrics(layout, aspect, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    const targetCluster = computeSpreadClusterMetrics(target, aspect, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    const layoutOuter = computeBookSpreadFrameOuterBox(
      layoutCluster.spreadOverlayWidthPx,
      layoutCluster.pageCanvasHeightPx,
    )
    const targetOuter = computeBookSpreadFrameOuterBox(
      targetCluster.spreadOverlayWidthPx,
      targetCluster.pageCanvasHeightPx,
    )
    const scaledWidth = layoutOuter.widthPx * scale
    const scaledHeight = layoutOuter.heightPx * scale
    // Uniform scale uses min(w, h); extra horizontal stack bleed can drift height slightly across buckets.
    expect(Math.abs(scaledWidth - targetOuter.widthPx)).toBeLessThanOrEqual(20)
    expect(Math.abs(scaledHeight - targetOuter.heightPx)).toBeLessThanOrEqual(20)
  })

  it('shrinks when the fitted width is smaller than the current picture', () => {
    const scale = computeSpreadReaderResizeScale(480, 360, 1 / 1.414)
    expect(scale).toBeLessThan(1)
    expect(scale).toBeGreaterThan(0.7)
  })
})

describe('computeSpreadClusterLayoutSlot', () => {
  it('keeps full outer box when scale shrinks (transform does not change layout size)', () => {
    const slot = computeSpreadClusterLayoutSlot(900, 700, 0.85)
    expect(slot.widthPx).toBe(900)
    expect(slot.heightPx).toBe(700)
  })

  it('expands slot when scale upscales past 1', () => {
    const slot = computeSpreadClusterLayoutSlot(900, 700, 1.15)
    expect(slot.widthPx).toBe(Math.ceil(900 * 1.15))
    expect(slot.heightPx).toBe(Math.ceil(700 * 1.15))
  })
})
