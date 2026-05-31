import { describe, expect, it } from 'vitest'
import {
  splitTwoPointDraftForPreview,
  splitTwoPointShapeCommands,
  splitTwoPointShapeCommandsViaClientRects,
  SPREAD_TWO_POINT_EPS,
} from '@/lib/books/spread-command-split'
import type { SpreadInkLayout } from '@/lib/books/spread-stroke-split'

const layout: SpreadInkLayout = {
  spreadOverlayWidthPx: 800,
  spreadPageWidthPx: 400,
  leftPageOriginXPx: 0,
  rightPageOriginXPx: 392,
  seamNormX: 0.5,
}

const shapeOpts = {
  shapeColor: '#111827',
  shapeStrokeWidthScale: 1,
  shapeLineDashStyle: 'solid' as const,
  shapeStrokeEnabled: true,
  shapeFillMode: 'none' as const,
  shapeFillColor: '#eab308',
}

describe('splitTwoPointShapeCommands', () => {
  it('splits a horizontal line across the seam', () => {
    const { left, right } = splitTwoPointShapeCommands(
      'line',
      [0.1, 0.4],
      [0.9, 0.4],
      layout,
      shapeOpts,
    )
    expect(left?.kind).toBe('line')
    expect(right?.kind).toBe('line')
    if (left?.kind === 'line' && right?.kind === 'line') {
      expect(left.id).toBe(right.id)
      expect(left.b[0]).toBeGreaterThan(left.a[0])
      expect(right.b[0]).toBeGreaterThan(right.a[0])
    }
  })

  it('keeps a line entirely on the left page', () => {
    const { left, right } = splitTwoPointShapeCommands(
      'line',
      [0.05, 0.2],
      [0.35, 0.8],
      layout,
      shapeOpts,
    )
    expect(left?.kind).toBe('line')
    expect(right).toBeNull()
  })

  it('splits a rectangle spanning the seam', () => {
    const { left, right } = splitTwoPointShapeCommands(
      'rect',
      [0.1, 0.2],
      [0.9, 0.7],
      layout,
      shapeOpts,
    )
    expect(left?.kind).toBe('rect')
    expect(right?.kind).toBe('rect')
    if (left?.kind === 'rect' && right?.kind === 'rect') {
      expect(left.w).toBeGreaterThan(SPREAD_TWO_POINT_EPS)
      expect(right.w).toBeGreaterThan(SPREAD_TWO_POINT_EPS)
      expect(left.x + left.w).toBeLessThanOrEqual(1 + 1e-6)
      expect(right.x).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps a rectangle entirely on the right page', () => {
    const { left, right } = splitTwoPointShapeCommands(
      'ellipse',
      [0.55, 0.1],
      [0.95, 0.9],
      layout,
      shapeOpts,
    )
    expect(left).toBeNull()
    expect(right?.kind).toBe('ellipse')
  })
})

describe('splitTwoPointDraftForPreview', () => {
  it('returns page-local drafts for a crossing line', () => {
    const { left, right } = splitTwoPointDraftForPreview('arrow', [0.2, 0.5], [0.8, 0.5], layout)
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    expect(left!.kind).toBe('arrow')
    expect(right!.kind).toBe('arrow')
  })
})

describe('splitTwoPointShapeCommandsViaClientRects', () => {
  it('keeps crossing line vertically aligned when page rects are offset', () => {
    const spreadRect = { left: 0, top: 0, width: 800, height: 220, right: 800 }
    const leftRect = { left: 0, top: 20, width: 400, height: 200, right: 400 }
    const rightRect = { left: 392, top: 20, width: 400, height: 200, right: 792 }
    const { left, right } = splitTwoPointShapeCommandsViaClientRects(
      'line',
      [0.1, 0.5],
      [0.9, 0.5],
      spreadRect,
      leftRect,
      rightRect,
      shapeOpts,
    )
    expect(left?.kind).toBe('line')
    expect(right?.kind).toBe('line')
    if (left?.kind === 'line' && right?.kind === 'line') {
      expect(left.id).toBe(right.id)
      expect(left.a[1]).toBeCloseTo(0.45, 5)
      expect(left.b[1]).toBeCloseTo(0.45, 5)
      expect(right.a[1]).toBeCloseTo(0.45, 5)
      expect(right.b[1]).toBeCloseTo(0.45, 5)
    }
  })
})
