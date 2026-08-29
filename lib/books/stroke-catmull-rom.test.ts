import { describe, expect, it } from 'vitest'
import {
  PEN_TAPER_END,
  PEN_TAPER_START,
  centripetalCubicControls,
  penTaperWidthFactor,
} from '@/lib/books/stroke-catmull-rom'

describe('stroke-catmull-rom', () => {
  it('keeps collinear points on the line', () => {
    const { c1, c2 } = centripetalCubicControls([0, 0], [1, 0], [2, 0], [3, 0])
    expect(c1[1]).toBeCloseTo(0, 8)
    expect(c2[1]).toBeCloseTo(0, 8)
    expect(c1[0]).toBeGreaterThan(1)
    expect(c1[0]).toBeLessThan(2)
    expect(c2[0]).toBeGreaterThan(1)
    expect(c2[0]).toBeLessThan(2)
  })

  it('does not loop on a sharp corner', () => {
    const { c1, c2 } = centripetalCubicControls([0, 0], [1, 0], [1, 1], [1, 2])
    expect(Math.abs(c1[1])).toBeLessThan(0.35)
    expect(Math.abs(c2[0] - 1)).toBeLessThan(0.35)
  })

  it('duplicates start neighbor without exploding', () => {
    const p1: [number, number] = [0, 0]
    const p2: [number, number] = [10, 0]
    const { c1, c2 } = centripetalCubicControls(p1, p1, p2, p2)
    expect(c1[0]).toBeGreaterThanOrEqual(0)
    expect(c2[0]).toBeLessThanOrEqual(10)
    expect(c1[1]).toBeCloseTo(0, 8)
    expect(c2[1]).toBeCloseTo(0, 8)
  })

  it('tapers only near the ends', () => {
    expect(penTaperWidthFactor(0)).toBeCloseTo(PEN_TAPER_START, 5)
    expect(penTaperWidthFactor(0.5)).toBe(1)
    expect(penTaperWidthFactor(1)).toBeCloseTo(PEN_TAPER_END, 5)
    expect(penTaperWidthFactor(0.5)).toBeGreaterThan(penTaperWidthFactor(1))
  })
})
