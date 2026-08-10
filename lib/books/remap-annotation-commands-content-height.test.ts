import { describe, expect, it } from 'vitest'
import {
  remapAnnotationCommandForContentHeightChange,
  remapAnnotationCommandsForContentHeightChange,
} from '@/lib/books/remap-annotation-commands-content-height'

describe('remapAnnotationCommandsForContentHeightChange', () => {
  it('keeps sticky pixel top and height when page grows', () => {
    const oldH = 1000
    const newH = 2000
    const sticky = {
      kind: 'sticky' as const,
      id: 's1',
      x: 0.1,
      y: 0.1,
      w: 0.2,
      h: 0.1,
      text: 'hi',
      fontSizeNorm: 0.04,
      fillColor: '#fef08a',
    }
    const next = remapAnnotationCommandForContentHeightChange(sticky, oldH, newH)
    expect(next.kind).toBe('sticky')
    if (next.kind !== 'sticky') return
    expect(next.y * newH).toBeCloseTo(sticky.y * oldH, 5)
    expect(next.h * newH).toBeCloseTo(sticky.h * oldH, 5)
    expect(next.w).toBe(sticky.w)
    expect(next.fontSizeNorm * newH).toBeCloseTo(sticky.fontSizeNorm * oldH, 5)
  })

  it('scales stroke Y points only', () => {
    const stroke = {
      kind: 'stroke' as const,
      id: 'p1',
      tool: 'pen' as const,
      points: [
        [0.1, 0.2],
        [0.3, 0.4],
      ] as [number, number][],
    }
    const next = remapAnnotationCommandForContentHeightChange(stroke, 1000, 2500)
    expect(next.kind).toBe('stroke')
    if (next.kind !== 'stroke') return
    expect(next.points[0]?.[0]).toBe(0.1)
    expect(next.points[0]?.[1]).toBeCloseTo(0.2 * (1000 / 2500), 5)
    expect(next.points[1]?.[1]).toBeCloseTo(0.4 * (1000 / 2500), 5)
  })

  it('no-ops when heights match', () => {
    const cmds = [
      {
        kind: 'stamp' as const,
        id: 't1',
        variant: 'star' as const,
        center: [0.5, 0.5] as [number, number],
        color: '#000',
      },
    ]
    const next = remapAnnotationCommandsForContentHeightChange(cmds, 800, 800)
    expect(next[0]).toEqual(cmds[0])
  })
})
