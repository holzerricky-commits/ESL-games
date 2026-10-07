import { describe, expect, it } from 'vitest'
import {
  appendNormPointsIfMoved,
  smoothingLevelToBlend,
  smoothingLevelToRdpEpsilon,
} from '@/lib/books/stroke-pointer-samples'

describe('stroke-pointer-samples', () => {
  it('appendNormPointsIfMoved skips duplicates and appends new samples', () => {
    const points: [number, number][] = [[0.1, 0.2]]
    appendNormPointsIfMoved(points, [
      [0.1, 0.2],
      [0.2, 0.3],
      [0.25, 0.35],
    ])
    expect(points).toEqual([
      [0.1, 0.2],
      [0.2, 0.3],
      [0.25, 0.35],
    ])
  })

  it('blends new samples when smoothBlend is set', () => {
    const points: [number, number][] = [
      [0, 0],
      [0.2, 0.2],
    ]
    appendNormPointsIfMoved(points, [[0.4, 0.4]], undefined, 0.5)
    expect(points[2]![0]).toBeCloseTo(0.3, 5)
    expect(points[2]![1]).toBeCloseTo(0.3, 5)
  })

  it('smoothingLevelToBlend maps 0 to raw and 10 to smooth', () => {
    expect(smoothingLevelToBlend(0)).toBeCloseTo(0.85, 5)
    expect(smoothingLevelToBlend(5)).toBeCloseTo(0.575, 5)
    expect(smoothingLevelToBlend(10)).toBeCloseTo(0.3, 5)
  })

  it('smoothingLevelToRdpEpsilon maps 0 to none and 10 to max', () => {
    expect(smoothingLevelToRdpEpsilon(0)).toBe(0)
    expect(smoothingLevelToRdpEpsilon(10)).toBeCloseTo(0.0004, 8)
  })

  it('uses level-derived blend in appendNormPointsIfMoved', () => {
    const points: [number, number][] = [
      [0, 0],
      [0.2, 0.2],
    ]
    const blend = smoothingLevelToBlend(5)
    appendNormPointsIfMoved(points, [[0.4, 0.4]], undefined, blend)
    expect(points[2]![0]).toBeCloseTo(0.2 + 0.2 * blend, 5)
    expect(points[2]![1]).toBeCloseTo(0.2 + 0.2 * blend, 5)
  })
})
