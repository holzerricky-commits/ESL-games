import { describe, expect, it } from 'vitest'
import { appendNormPointsIfMoved } from '@/lib/books/stroke-pointer-samples'

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
})
