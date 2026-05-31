import { describe, expect, it } from 'vitest'
import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  computeEraserLineDeadIndices,
  polylineMinDistSq,
  textCommandBBox,
  textTopYFromCenterAnchor,
} from './annotation-geometry'

describe('annotation-geometry', () => {
  it('textTopYFromCenterAnchor preserves the top edge of a single-line box', () => {
    const fontSizeNorm = 0.04
    const centerY = 0.5
    const box = textCommandBBox({
      kind: 'text',
      id: 't0',
      x: 0.1,
      y: centerY,
      yAnchor: 'center',
      text: 'Hi',
      fontSizeNorm,
      color: '#111',
    })
    expect(textTopYFromCenterAnchor(centerY, fontSizeNorm, 1)).toBeCloseTo(box.y, 5)
  })

  it('textCommandBBox shifts top upward when yAnchor is center', () => {
    const cmd = {
      kind: 'text' as const,
      id: 't1',
      x: 0.1,
      y: 0.5,
      yAnchor: 'center' as const,
      text: 'Hi',
      fontSizeNorm: 0.04,
      color: '#111',
    }
    const box = textCommandBBox(cmd)
    expect(box.h).toBeCloseTo(0.04 * 1.4, 5)
    expect(box.y).toBeCloseTo(0.5 - box.h / 2, 5)
  })

  it('polylineMinDistSq returns 0 for overlapping segments', () => {
    const a: [number, number][] = [
      [0.2, 0.5],
      [0.8, 0.5],
    ]
    const b: [number, number][] = [
      [0.5, 0.5],
      [0.5, 0.6],
    ]
    expect(polylineMinDistSq(a, b)).toBeLessThan(1e-6)
  })

  it('eraser-line removes pen strokes and shapes in command order', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stroke',
        id: '1',
        tool: 'pen',
        points: [
          [0.1, 0.5],
          [0.9, 0.5],
        ],
      },
      {
        kind: 'rect',
        id: '2',
        x: 0.4,
        y: 0.4,
        w: 0.2,
        h: 0.2,
        strokeColor: '#000',
      },
      {
        kind: 'stroke',
        id: '3',
        tool: 'eraser-line',
        points: [
          [0.5, 0.1],
          [0.5, 0.9],
        ],
      },
    ]
    const dead = computeEraserLineDeadIndices(commands)
    expect(dead.has(0)).toBe(true)
    expect(dead.has(1)).toBe(true)
    expect(dead.has(2)).toBe(false)
  })

  it('eraser-line removes stamp and text when path crosses them', () => {
    const commands: AnnotationCommand[] = [
      {
        kind: 'stamp',
        id: 's1',
        variant: 'check',
        center: [0.5, 0.5],
        color: '#0a0',
      },
      {
        kind: 'text',
        id: 't1',
        x: 0.5,
        y: 0.5,
        text: 'Hi',
        fontSizeNorm: 0.04,
        color: '#111',
      },
      {
        kind: 'stroke',
        id: 'e1',
        tool: 'eraser-line',
        points: [
          [0.5, 0.2],
          [0.5, 0.8],
        ],
      },
    ]
    const dead = computeEraserLineDeadIndices(commands)
    expect(dead.has(0)).toBe(true)
    expect(dead.has(1)).toBe(true)
  })
})
