import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  angleFromPivotToPoint,
  boxShapeRotatedBounds,
  hitTestRotationHandle,
  normalizeDeg,
  commitRotatedAnnotationCommands,
  rotateAnnotationCommand,
  rotateAnnotationCommands,
  rotatePointAroundPivot,
  selectionPivotFromBounds,
} from '@/lib/books/annotation-rotation'

describe('annotation-rotation', () => {
  it('rotatePointAroundPivot rotates 90deg around origin', () => {
    const next = rotatePointAroundPivot([1, 0], [0, 0], Math.PI / 2)
    expect(next[0]).toBeCloseTo(0, 5)
    expect(next[1]).toBeCloseTo(1, 5)
  })

  it('boxShapeRotatedBounds expands for rotated rect', () => {
    const bounds = boxShapeRotatedBounds({
      x: 0.4,
      y: 0.4,
      w: 0.2,
      h: 0.1,
      rotationDeg: 45,
    })
    expect(bounds.w).toBeGreaterThan(0.2)
    expect(bounds.h).toBeGreaterThan(0.1)
  })

  it('rotateAnnotationCommand adds rotationDeg on rect', () => {
    const cmd: AnnotationCommand = {
      kind: 'rect',
      id: 'r1',
      x: 0.2,
      y: 0.2,
      w: 0.2,
      h: 0.1,
      strokeColor: '#000',
    }
    const next = rotateAnnotationCommand(cmd, [0.3, 0.25], Math.PI / 4)
    expect(next.kind).toBe('rect')
    if (next.kind === 'rect') {
      expect(next.rotationDeg).toBeCloseTo(45, 3)
      expect(next.x).toBeCloseTo(0.2, 5)
    }
  })

  it('rotateAnnotationCommand rotates line endpoints', () => {
    const cmd: AnnotationCommand = {
      kind: 'line',
      id: 'l1',
      a: [0.5, 0.5],
      b: [0.6, 0.5],
      color: '#000',
    }
    const next = rotateAnnotationCommand(cmd, [0.5, 0.5], Math.PI / 2)
    expect(next.kind).toBe('line')
    if (next.kind === 'line') {
      expect(next.a[0]).toBeCloseTo(0.5, 5)
      expect(next.a[1]).toBeCloseTo(0.5, 5)
      expect(next.b[0]).toBeCloseTo(0.5, 5)
      expect(next.b[1]).toBeCloseTo(0.6, 5)
    }
  })

  it('rotateAnnotationCommands only touches selected ids', () => {
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
        w: 0.1,
        h: 0.1,
        strokeColor: '#000',
      },
    ]
    const next = rotateAnnotationCommands(commands, new Set(['a']), [0.15, 0.15], Math.PI / 2)
    expect(next[0]!.kind).toBe('rect')
    if (next[0]!.kind === 'rect') expect(next[0]!.rotationDeg).toBeCloseTo(90, 3)
    if (next[1]!.kind === 'rect') expect(next[1]!.rotationDeg).toBeUndefined()
  })

  it('hitTestRotationHandle finds handle above selection', () => {
    const bounds = { x: 0.2, y: 0.3, w: 0.4, h: 0.2 }
    const pivot = selectionPivotFromBounds(bounds)
    const angle = angleFromPivotToPoint(pivot, [pivot[0], bounds.y - 0.05])
    const probe: [number, number] = [
      pivot[0] + Math.cos(angle) * 0.001,
      pivot[1] + Math.sin(angle) * 0.001,
    ]
    void probe
    const hit = hitTestRotationHandle([0.4, 0.24], bounds, 800, 600, 24)
    expect(hit).toBe(true)
  })

  it('normalizeDeg wraps negative angles', () => {
    expect(normalizeDeg(-90)).toBeCloseTo(270, 5)
  })

  it('rotateAnnotationCommands snapshots rotationBounds and sets rotationDeg on pen stroke', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: 's1',
        tool: 'pen',
        points: [
          [0.5, 0.5],
          [0.6, 0.5],
        ],
        color: '#000',
      },
    ]
    const next = rotateAnnotationCommands(commands, new Set(['s1']), [0.55, 0.5], Math.PI / 2, {
      widthPx: 800,
      heightPx: 600,
    })
    const stroke = next[0]!
    expect(stroke.kind).toBe('stroke')
    if (stroke.kind === 'stroke') {
      expect(stroke.rotationBounds).toBeDefined()
      expect(stroke.rotationDeg).toBeCloseTo(90, 3)
      expect(stroke.points[1]![0]).toBeCloseTo(0.6, 5)
    }
  })

  it('commitRotatedAnnotationCommands merges live preview onto full stack', () => {
    const stroke: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.5, 0.5],
        [0.6, 0.5],
      ],
      color: '#000',
    }
    const text: AnnotationCommand = {
      kind: 'text',
      id: 't1',
      x: 0.1,
      y: 0.1,
      yAnchor: 'top',
      text: 'hi',
      fontSizeNorm: 0.04,
      color: '#111',
    }
    const commands = [stroke, text]
    const previewBase = [
      {
        ...stroke,
        rotationBounds: { x: 0.48, y: 0.48, w: 0.14, h: 0.06 },
      },
      text,
    ]
    const next = commitRotatedAnnotationCommands(
      commands,
      new Set(['s1']),
      [0.55, 0.5],
      Math.PI / 2,
      { widthPx: 800, heightPx: 600 },
      previewBase,
    )
    const committed = next[0]!
    expect(committed.kind).toBe('stroke')
    if (committed.kind === 'stroke') {
      expect(committed.rotationDeg).toBeCloseTo(90, 3)
      expect(committed.rotationBounds).toBeDefined()
    }
    expect(next[1]).toBe(text)
  })

  it('rotateAnnotationCommand adds rotationDeg on pen stroke without moving points', () => {
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 's1',
      tool: 'pen',
      points: [
        [0.5, 0.5],
        [0.6, 0.5],
      ],
      color: '#000',
      rotationBounds: { x: 0.48, y: 0.48, w: 0.14, h: 0.06 },
    }
    const next = rotateAnnotationCommand(cmd, [0.5, 0.5], Math.PI / 2)
    expect(next.kind).toBe('stroke')
    if (next.kind === 'stroke') {
      expect(next.rotationDeg).toBeCloseTo(90, 3)
      expect(next.points[1]![0]).toBeCloseTo(0.6, 5)
      expect(next.points[1]![1]).toBeCloseTo(0.5, 5)
    }
  })

  it('rotateAnnotationCommand skips eraser strokes', () => {
    const cmd: AnnotationCommand = {
      kind: 'stroke',
      id: 'e1',
      tool: 'eraser',
      points: [
        [0.2, 0.2],
        [0.3, 0.3],
      ],
    }
    const next = rotateAnnotationCommand(cmd, [0.25, 0.25], Math.PI / 2)
    expect(next).toEqual(cmd)
  })
})
