import { describe, expect, it } from 'vitest'
import { buildHoldShapeCommand } from '@/lib/books/hold-shape-commit'
import type { StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

const stroke: StrokeAnnotationCommand = {
  kind: 'stroke',
  id: 's1',
  tool: 'pen',
  points: [[0.1, 0.2]],
  color: '#e11d48',
  widthScale: 1.5,
  lineDashStyle: 'dashed',
}

const shapeOpts = {
  shapeColor: '#111827',
  shapeStrokeWidthScale: 1,
  shapeLineDashStyle: 'solid' as const,
  shapeStrokeEnabled: true,
  shapeFillMode: 'none' as const,
  shapeFillColor: '#fef08a',
}

describe('hold-shape-commit', () => {
  it('commits a marker hold line as a marker stroke', () => {
    const markerStroke: StrokeAnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'marker',
      points: [[0.1, 0.2]],
      color: '#ffeb3b',
      widthScale: 1.2,
    }
    const cmd = buildHoldShapeCommand(
      {
        kind: 'line',
        anchor: [0.1, 0.2],
        current: [0.6, 0.2],
        lineAxis: 'horizontal',
      },
      markerStroke,
      shapeOpts,
    )
    expect(cmd?.kind).toBe('stroke')
    if (cmd?.kind === 'stroke') {
      expect(cmd.tool).toBe('marker')
      expect(cmd.points).toEqual([
        [0.1, 0.2],
        [0.6, 0.2],
      ])
      expect(cmd.color).toBe('#ffeb3b')
      expect(cmd.widthScale).toBe(1.2)
    }
  })

  it('commits a line with stroke ink', () => {
    const cmd = buildHoldShapeCommand(
      {
        kind: 'line',
        anchor: [0.1, 0.2],
        current: [0.6, 0.2],
        lineAxis: 'horizontal',
      },
      stroke,
      shapeOpts,
    )
    expect(cmd?.kind).toBe('line')
    if (cmd?.kind === 'line') {
      expect(cmd.color).toBe('#e11d48')
      expect(cmd.widthScale).toBe(1.5)
      expect(cmd.lineDashStyle).toBe('dashed')
    }
  })

  it('commits a rectangle with stroke ink', () => {
    const cmd = buildHoldShapeCommand(
      {
        kind: 'rect',
        anchor: [0.1, 0.2],
        current: [0.5, 0.55],
        lineAxis: null,
      },
      stroke,
      shapeOpts,
    )
    expect(cmd?.kind).toBe('rect')
    if (cmd?.kind === 'rect') {
      expect(cmd.strokeColor).toBe('#e11d48')
      expect(cmd.w).toBeCloseTo(0.4, 3)
    }
  })
})
