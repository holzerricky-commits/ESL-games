import { describe, expect, it } from 'vitest'
import {
  canIncrementallyAppendStrokeDraft,
  incrementalStrokeDraftSegmentPoints,
  type IncrementalStrokeDraftState,
} from '@/lib/books/incremental-stroke-draft-paint'

describe('incremental-stroke-draft-paint', () => {
  const penPrev: IncrementalStrokeDraftState = { tool: 'pen', pointsLength: 5 }

  it('incrementalStrokeDraftSegmentPoints overlaps the last two points', () => {
    const pts: [number, number][] = [
      [0, 0],
      [0.1, 0.1],
      [0.2, 0.2],
      [0.3, 0.3],
      [0.4, 0.4],
      [0.5, 0.5],
    ]
    expect(incrementalStrokeDraftSegmentPoints(pts, 5)).toEqual([
      [0.3, 0.3],
      [0.4, 0.4],
      [0.5, 0.5],
    ])
  })

  it('canIncrementallyAppendStrokeDraft when points grow', () => {
    expect(
      canIncrementallyAppendStrokeDraft(penPrev, {
        tool: 'pen',
        points: [
          [0, 0],
          [0.5, 0.5],
          [0.6, 0.6],
          [0.7, 0.7],
          [0.8, 0.8],
          [0.9, 0.9],
        ],
      }),
    ).toBe(true)
  })

  it('rejects when point count does not grow (straight-line snap)', () => {
    expect(
      canIncrementallyAppendStrokeDraft(penPrev, {
        tool: 'pen',
        points: [
          [0, 0],
          [0.9, 0.2],
        ],
      }),
    ).toBe(false)
  })

  it('rejects tool changes', () => {
    expect(
      canIncrementallyAppendStrokeDraft(penPrev, {
        tool: 'marker',
        points: [
          [0, 0],
          [0.5, 0.5],
          [0.6, 0.6],
          [0.7, 0.7],
          [0.8, 0.8],
          [0.9, 0.9],
        ],
      }),
    ).toBe(false)
  })
})
