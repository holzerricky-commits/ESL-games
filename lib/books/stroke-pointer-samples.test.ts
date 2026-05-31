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
})
