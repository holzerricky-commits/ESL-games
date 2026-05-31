import { describe, expect, it } from 'vitest'
import {
  estimateSpreadGutterPullRatioFromPageImages,
  medianSpreadGutterPullRatio,
  type PageImageRaster,
  scoreSpreadSeamAlignment,
} from '@/lib/books/spread-gutter-auto'

function solidPage(width: number, height: number, r: number, g: number, b: number): PageImageRaster {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    data[o] = r
    data[o + 1] = g
    data[o + 2] = b
    data[o + 3] = 255
  }
  return { width, height, data }
}

function setRgb(page: PageImageRaster, x: number, y: number, v: number) {
  const o = (y * page.width + x) * 4
  page.data[o] = v
  page.data[o + 1] = v
  page.data[o + 2] = v
}

/** Shared art shifted by `gutterPx`; white gutters on inner edges until overlap aligns art. */
function syntheticSpread(width: number, height: number, gutterPx: number): {
  left: PageImageRaster
  right: PageImageRaster
} {
  const left = solidPage(width, height, 255, 255, 255)
  const right = solidPage(width, height, 255, 255, 255)
  const y0 = Math.floor(height * 0.12)
  const y1 = Math.floor(height * 0.88)
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width - gutterPx; x++) {
      const v = (x % 16) < 8 ? 90 : 170
      setRgb(left, x, y, v)
      setRgb(right, gutterPx + x, y, v)
    }
  }
  return { left, right }
}

describe('scoreSpreadSeamAlignment', () => {
  it('scores lower when pull ratio matches synthetic gutter', () => {
    const w = 200
    const h = 280
    const gutterPx = 24
    const { left, right } = syntheticSpread(w, h, gutterPx)
    const expectedRatio = gutterPx / w
    const atGutter = scoreSpreadSeamAlignment(left, right, expectedRatio)
    const atZero = scoreSpreadSeamAlignment(left, right, 0)
    expect(atGutter).toBeLessThan(atZero)
  })
})

describe('estimateSpreadGutterPullRatioFromPageImages', () => {
  it('finds overlap near synthetic gutter width', () => {
    const w = 200
    const h = 280
    const gutterPx = 30
    const { left, right } = syntheticSpread(w, h, gutterPx)
    const estimated = estimateSpreadGutterPullRatioFromPageImages(left, right)
    expect(estimated).toBeGreaterThanOrEqual(0.1)
    expect(estimated).toBeLessThanOrEqual(0.2)
    expect(Math.abs(estimated - gutterPx / w)).toBeLessThan(0.04)
  })
})

describe('medianSpreadGutterPullRatio', () => {
  it('returns middle value', () => {
    expect(medianSpreadGutterPullRatio([0.02, 0.05, 0.03])).toBe(0.03)
  })
})
