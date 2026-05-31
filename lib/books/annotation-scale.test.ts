import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  hitTestScaleHandle,
  resizeBoundsFromHandle,
  scaleAnnotationCommand,
  thicknessScaleFromBounds,
  unionSelectionBounds,
} from '@/lib/books/annotation-scale'

describe('annotation-scale', () => {
  it('unionSelectionBounds merges selected items', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'rect',
        id: 'a',
        x: 0.1,
        y: 0.1,
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
      {
        kind: 'rect',
        id: 'b',
        x: 0.5,
        y: 0.5,
        w: 0.2,
        h: 0.15,
        strokeColor: '#000',
      },
    ]
    const u = unionSelectionBounds(commands, ['a', 'b'], 800, 600)
    expect(u).not.toBeNull()
    expect(u!.x).toBeCloseTo(0.1, 3)
    expect(u!.y).toBeCloseTo(0.1, 3)
    expect(u!.w).toBeCloseTo(0.6, 3)
    expect(u!.h).toBeCloseTo(0.55, 3)
  })

  it('hitTestScaleHandle finds corner handles', () => {
    const bounds = { x: 0.2, y: 0.2, w: 0.3, h: 0.2 }
    const se = hitTestScaleHandle([0.5, 0.4], bounds, 800, 600, 20)
    expect(se).toBe('se')
  })

  it('resizeBoundsFromHandle grows se corner', () => {
    const start = { x: 0.2, y: 0.2, w: 0.2, h: 0.2 }
    const next = resizeBoundsFromHandle(start, 'se', [0.5, 0.5])
    expect(next.x).toBeCloseTo(0.2, 3)
    expect(next.y).toBeCloseTo(0.2, 3)
    expect(next.w).toBeCloseTo(0.3, 3)
    expect(next.h).toBeCloseTo(0.3, 3)
  })

  it('resizeBoundsFromHandle preserves aspect when uniform (default gesture)', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 }
    const next = resizeBoundsFromHandle(start, 'se', [0.6, 0.5], { uniform: true })
    expect(next.w / next.h).toBeCloseTo(start.w / start.h, 2)
  })

  it('resizeBoundsFromHandle allows free aspect when uniform is off', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 }
    const next = resizeBoundsFromHandle(start, 'se', [0.6, 0.5], { uniform: false })
    expect(next.w / next.h).not.toBeCloseTo(start.w / start.h, 2)
  })

  it('uniform resize stops at page edge without breaking aspect', () => {
    const start = { x: 0.7, y: 0.7, w: 0.2, h: 0.1 }
    const next = resizeBoundsFromHandle(start, 'se', [2, 2], { uniform: true })
    expect(next.x + next.w).toBeLessThanOrEqual(1 + 1e-9)
    expect(next.y + next.h).toBeLessThanOrEqual(1 + 1e-9)
    expect(next.w / next.h).toBeCloseTo(start.w / start.h, 4)
    expect(next.x + next.w).toBeCloseTo(1, 3)
  })

  it('scaleAnnotationCommand scales stroke points', () => {
    const start = { x: 0, y: 0, w: 1, h: 1 }
    const next = { x: 0, y: 0, w: 0.5, h: 0.5 }
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's',
      tool: 'pen',
      points: [
        [0, 0],
        [1, 1],
      ],
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('stroke')
    if (scaled.kind === 'stroke') {
      expect(scaled.points[1]![0]).toBeCloseTo(0.5, 3)
      expect(scaled.points[1]![1]).toBeCloseTo(0.5, 3)
    }
  })

  it('thicknessScaleFromBounds uses sx when aspect locked', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 }
    const next = { x: 0.1, y: 0.1, w: 0.8, h: 0.4 }
    expect(thicknessScaleFromBounds(start, next)).toBeCloseTo(2, 5)
  })

  it('thicknessScaleFromBounds uses geometric mean when aspect free', () => {
    const start = { x: 0, y: 0, w: 0.4, h: 0.2 }
    const next = { x: 0, y: 0, w: 0.8, h: 0.2 }
    expect(thicknessScaleFromBounds(start, next)).toBeCloseTo(Math.sqrt(2), 5)
    expect(thicknessScaleFromBounds(start, next)).not.toBeCloseTo(1.5, 2)
  })

  it('uniform 2x scale doubles stroke widthScale', () => {
    const start = { x: 0, y: 0, w: 1, h: 1 }
    const next = { x: 0, y: 0, w: 2, h: 2 }
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's',
      tool: 'pen',
      points: [[0.25, 0.25], [0.75, 0.75]],
      widthScale: 1.2,
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('stroke')
    if (scaled.kind === 'stroke') {
      expect(scaled.widthScale).toBeCloseTo(2.4, 5)
    }
  })

  it('legacy stroke without widthScale gets thickness after scale', () => {
    const start = { x: 0, y: 0, w: 1, h: 1 }
    const next = { x: 0, y: 0, w: 0.5, h: 0.5 }
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's',
      tool: 'marker',
      points: [[0, 0], [1, 0]],
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('stroke')
    if (scaled.kind === 'stroke') {
      expect(scaled.widthScale).toBeCloseTo(0.5, 5)
    }
  })

  it('arrow scales headLengthNorm with bounds', () => {
    const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }
    const next = { x: 0.2, y: 0.2, w: 0.8, h: 0.8 }
    const cmd: AnnotationCommand = {
      kind: 'arrow',
      id: 'a',
      from: [0.3, 0.5],
      to: [0.5, 0.5],
      color: '#000',
      headLengthNorm: 0.04,
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('arrow')
    if (scaled.kind === 'arrow') {
      expect(scaled.headLengthNorm).toBeCloseTo(0.08, 5)
    }
  })

  it('text scales fontSizeNorm and maxWidthNorm with same factor', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.2 }
    const next = { x: 0.1, y: 0.1, w: 0.8, h: 0.4 }
    const cmd: AnnotationCommand = {
      kind: 'text',
      id: 't',
      x: 0.2,
      y: 0.2,
      text: 'hi',
      fontSizeNorm: 0.04,
      color: '#000',
      maxWidthNorm: 0.3,
    }
    const scaled = scaleAnnotationCommand(cmd, start, next)
    expect(scaled.kind).toBe('text')
    if (scaled.kind === 'text') {
      expect(scaled.fontSizeNorm).toBeCloseTo(0.08, 5)
      expect(scaled.maxWidthNorm).toBeCloseTo(0.6, 5)
    }
  })
})
