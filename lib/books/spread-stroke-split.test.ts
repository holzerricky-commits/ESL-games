import { describe, expect, it } from 'vitest'
import {
  clientPointToPageNorm,
  intersectSegmentWithVerticalLine,
  seamClientX,
  splitPolylineAtVerticalSeam,
  splitSpreadNormPolylineToPageNormalizedChains,
  splitSpreadNormPolylineViaClientRects,
  spreadNormPointToPageNorm,
} from '@/lib/books/spread-stroke-split'

describe('seamClientX', () => {
  it('is the midpoint between left.right and right.left', () => {
    const left = { left: 0, top: 0, width: 100, height: 200, right: 100 }
    const right = { left: 90, top: 0, width: 100, height: 200, right: 190 }
    expect(seamClientX(left, right)).toBe(95)
  })
})

describe('clientPointToPageNorm', () => {
  const rect = { left: 10, top: 20, width: 100, height: 200, right: 110 }
  it('maps center to ~0.5,0.5', () => {
    expect(clientPointToPageNorm(rect, 60, 120)).toEqual([0.5, 0.5])
  })
  it('clamps outside', () => {
    expect(clientPointToPageNorm(rect, 0, 0)).toEqual([0, 0])
    expect(clientPointToPageNorm(rect, 999, 999)).toEqual([1, 1])
  })
})

describe('intersectSegmentWithVerticalLine', () => {
  it('returns crossing point when segment crosses the seam', () => {
    const p = intersectSegmentWithVerticalLine(0, 0, 100, 100, 50)
    expect(p).not.toBeNull()
    expect(p![0]).toBe(50)
    expect(p![1]).toBeCloseTo(50, 5)
  })
  it('returns null when segment stays on one side', () => {
    expect(intersectSegmentWithVerticalLine(0, 0, 40, 100, 50)).toBeNull()
    expect(intersectSegmentWithVerticalLine(60, 0, 100, 100, 50)).toBeNull()
  })
})

describe('splitPolylineAtVerticalSeam', () => {
  const seam = 100

  it('keeps an all-left polyline on the left only', () => {
    const { left, right } = splitPolylineAtVerticalSeam(
      [
        [0, 0],
        [50, 10],
        [80, 20],
      ],
      seam,
    )
    expect(left).toHaveLength(1)
    expect(right).toHaveLength(0)
    expect(left[0]![0]).toEqual([0, 0])
    expect(left[0]!.at(-1)).toEqual([80, 20])
  })

  it('keeps an all-right polyline on the right only', () => {
    const { left, right } = splitPolylineAtVerticalSeam(
      [
        [120, 0],
        [150, 50],
      ],
      seam,
    )
    expect(left).toHaveLength(0)
    expect(right).toHaveLength(1)
    expect(right[0]).toHaveLength(2)
  })

  it('splits a horizontal stroke across the seam with a junction on both sides', () => {
    const { left, right } = splitPolylineAtVerticalSeam(
      [
        [50, 40],
        [150, 40],
      ],
      seam,
    )
    expect(left).toHaveLength(1)
    expect(right).toHaveLength(1)
    const leftChain = left[0]!
    const rightChain = right[0]!
    expect(leftChain.length).toBeGreaterThanOrEqual(2)
    expect(rightChain.length).toBeGreaterThanOrEqual(2)
    expect(leftChain[leftChain.length - 1]![0]).toBeCloseTo(100, 5)
    expect(rightChain[0]![0]).toBeCloseTo(100, 5)
    expect(leftChain[leftChain.length - 1]![1]).toBeCloseTo(40, 5)
    expect(rightChain[0]![1]).toBeCloseTo(40, 5)
    expect(rightChain[rightChain.length - 1]).toEqual([150, 40])
  })

  it('does not connect two seam crossings on the same page with a straight chord', () => {
    const { left, right } = splitPolylineAtVerticalSeam(
      [
        [20, 30],
        [140, 30],
        [140, 70],
        [20, 70],
      ],
      seam,
    )
    expect(left).toHaveLength(2)
    expect(right).toHaveLength(1)
    const rightChain = right[0]!
    expect(rightChain.length).toBeGreaterThanOrEqual(3)
    expect(rightChain[0]![0]).toBeCloseTo(100, 5)
    expect(rightChain[rightChain.length - 1]![0]).toBeCloseTo(100, 5)
    const ys = rightChain.map((p) => p[1])
    expect(Math.min(...ys)).toBeLessThan(40)
    expect(Math.max(...ys)).toBeGreaterThan(60)
  })

  it('returns empty both sides for fewer than 2 points', () => {
    expect(splitPolylineAtVerticalSeam([[0, 0]], seam)).toEqual({ left: [], right: [] })
  })
})

describe('spreadNormPointToPageNorm', () => {
  const spreadW = 800
  const pageW = 400
  const leftOrigin = 0
  const rightOrigin = 392

  it('maps spread center of left page to ~0.5 page x', () => {
    const spreadNx = (leftOrigin + pageW * 0.5) / spreadW
    expect(spreadNormPointToPageNorm(spreadNx, 0.5, leftOrigin, pageW, spreadW)).toEqual([0.5, 0.5])
  })

  it('maps spread center of right page to ~0.5 page x', () => {
    const spreadNx = (rightOrigin + pageW * 0.5) / spreadW
    expect(spreadNormPointToPageNorm(spreadNx, 0.5, rightOrigin, pageW, spreadW)).toEqual([0.5, 0.5])
  })
})

describe('splitSpreadNormPolylineToPageNormalizedChains', () => {
  const layout = {
    spreadOverlayWidthPx: 800,
    spreadPageWidthPx: 400,
    leftPageOriginXPx: 0,
    rightPageOriginXPx: 392,
    seamNormX: 0.5,
  }

  it('splits a horizontal stroke across the seam', () => {
    const { leftNorm, rightNorm } = splitSpreadNormPolylineToPageNormalizedChains(
      [
        [0.1, 0.4],
        [0.9, 0.4],
      ],
      layout,
    )
    expect(leftNorm).toHaveLength(1)
    expect(rightNorm).toHaveLength(1)
    expect(leftNorm[0]!.length).toBeGreaterThanOrEqual(2)
    expect(rightNorm[0]!.length).toBeGreaterThanOrEqual(2)
    expect(leftNorm[0]!.at(-1)![1]).toBeCloseTo(0.4, 5)
    expect(rightNorm[0]![0]![1]).toBeCloseTo(0.4, 5)
  })
})

describe('splitSpreadNormPolylineViaClientRects', () => {
  it('maps spread norm through page rects so Y matches each page slot', () => {
    const spread = { left: 0, top: 0, width: 800, height: 200, right: 800 }
    const left = { left: 0, top: 20, width: 400, height: 200, right: 400 }
    const right = { left: 392, top: 20, width: 400, height: 200, right: 792 }
    const { leftNorm, rightNorm } = splitSpreadNormPolylineViaClientRects(
      [
        [0.1, 0.5],
        [0.9, 0.5],
      ],
      spread,
      left,
      right,
    )
    expect(leftNorm[0]![0]![1]).toBeCloseTo(0.4, 5)
    expect(rightNorm[0]![0]![1]).toBeCloseTo(0.4, 5)
    expect(leftNorm[0]!.at(-1)![1]).toBeCloseTo(0.4, 5)
    expect(rightNorm[0]!.at(-1)![1]).toBeCloseTo(0.4, 5)
  })
})
