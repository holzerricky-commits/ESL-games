import { describe, expect, it } from 'vitest'
import {
  computePageCanvasHeightPx,
  computeSpreadClusterMetrics,
  computeSpreadFitScale,
  computeSpreadPageWidth,
} from '@/lib/books/spread-viewport-layout'
import { DEFAULT_SPREAD_GUTTER_PULL_RATIO } from '@/lib/books/spread-gutter'

describe('computeSpreadPageWidth', () => {
  it('matches reader viewport formula (width vs height bound)', () => {
    const aspect = 1 / 1.414
    const w = 1200
    const h = 800
    const widthFit = (w * 0.996) / 2
    const heightFit = h * 0.996 * aspect
    expect(computeSpreadPageWidth(w, h, aspect)).toBe(Math.floor(Math.min(widthFit, heightFit)))
  })
})

describe('computePageCanvasHeightPx', () => {
  it('derives height from width and aspect', () => {
    expect(computePageCanvasHeightPx(400, 0.5)).toBe(800)
  })
})

describe('computeSpreadClusterMetrics', () => {
  it('uses one gutter pull for cluster width', () => {
    const m = computeSpreadClusterMetrics(400, 1 / 1.414, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    expect(m.gutterPullPx).toBe(Math.round(400 * DEFAULT_SPREAD_GUTTER_PULL_RATIO))
    expect(m.spreadOverlayWidthPx).toBe(400 * 2 - m.gutterPullPx)
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
})
