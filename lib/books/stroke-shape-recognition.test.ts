import { describe, expect, it } from 'vitest'
import {
  recognizeHoldShapeFromStroke,
  scoreHoldShapeCandidatesForTest,
  snapHoldShapeDraftOnActivate,
  updateHoldShapeDraftAtPointer,
} from '@/lib/books/stroke-shape-recognition'

function rectLoop(x: number, y: number, w: number, h: number, steps = 24): [number, number][] {
  const pts: [number, number][] = []
  const pushEdge = (a: [number, number], b: [number, number]) => {
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  const tl: [number, number] = [x, y]
  const tr: [number, number] = [x + w, y]
  const br: [number, number] = [x + w, y + h]
  const bl: [number, number] = [x, y + h]
  pushEdge(tl, tr)
  pushEdge(tr, br)
  pushEdge(br, bl)
  pushEdge(bl, tl)
  pts.push(tl)
  return pts
}

function ellipseLoop(cx: number, cy: number, rx: number, ry: number, steps = 36): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry])
  }
  return pts
}

function triangleLoop(x: number, y: number, w: number, h: number): [number, number][] {
  const top: [number, number] = [x + w / 2, y]
  const left: [number, number] = [x, y + h]
  const right: [number, number] = [x + w, y + h]
  const pts: [number, number][] = []
  const edge = (a: [number, number], b: [number, number]) => {
    for (let i = 0; i < 12; i++) {
      const t = i / 12
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  edge(top, right)
  edge(right, left)
  edge(left, top)
  pts.push(top)
  return pts
}

describe('stroke-shape-recognition', () => {
  it('recognizes a rough horizontal line', () => {
    const pts: [number, number][] = []
    for (let i = 0; i <= 20; i++) {
      pts.push([0.1 + i * 0.03, 0.2 + (i % 2 === 0 ? 0.002 : -0.002)])
    }
    const shape = recognizeHoldShapeFromStroke(pts)
    expect(shape?.kind).toBe('line')
    expect(shape?.lineAxis).toBe('horizontal')
  })

  it('recognizes a closed rectangle', () => {
    const shape = recognizeHoldShapeFromStroke(rectLoop(0.15, 0.2, 0.35, 0.25))
    expect(shape?.kind).toBe('rect')
  })

  it('keeps hand-drawn size when hold activates on a rectangle', () => {
    const shape = recognizeHoldShapeFromStroke(rectLoop(0.15, 0.2, 0.35, 0.25))!
    const wBefore = Math.abs(shape.current[0] - shape.anchor[0])
    const hBefore = Math.abs(shape.current[1] - shape.anchor[1])
    expect(wBefore).toBeCloseTo(0.35, 2)
    expect(hBefore).toBeCloseTo(0.25, 2)
    snapHoldShapeDraftOnActivate(shape, [0.22, 0.28])
    expect(Math.abs(shape.current[0] - shape.anchor[0])).toBeCloseTo(0.35, 2)
    expect(Math.abs(shape.current[1] - shape.anchor[1])).toBeCloseTo(0.25, 2)
    updateHoldShapeDraftAtPointer(shape, [0.221, 0.281])
    expect(Math.abs(shape.current[0] - shape.anchor[0])).toBeCloseTo(0.35, 2)
    updateHoldShapeDraftAtPointer(shape, [0.5, 0.55])
    expect(Math.abs(shape.current[0] - shape.anchor[0])).toBeGreaterThan(0.1)
  })

  it('recognizes a closed ellipse', () => {
    const shape = recognizeHoldShapeFromStroke(ellipseLoop(0.5, 0.5, 0.18, 0.12))
    expect(shape?.kind).toBe('ellipse')
  })

  it('recognizes a closed triangle', () => {
    const pts = triangleLoop(0.2, 0.2, 0.3, 0.28)
    const scores = scoreHoldShapeCandidatesForTest(pts)
    expect(scores.closed).toBe(true)
    expect(scores.triangle).toBeGreaterThan(0.52)
    const shape = recognizeHoldShapeFromStroke(pts)
    expect(shape?.kind).toBe('triangle')
  })

  it('updates line draft on pointer move along locked axis', () => {
    const draft = {
      kind: 'line' as const,
      anchor: [0.1, 0.2] as [number, number],
      current: [0.5, 0.2] as [number, number],
      lineAxis: 'horizontal' as const,
    }
    updateHoldShapeDraftAtPointer(draft, [0.8, 0.55])
    expect(draft.current).toEqual([0.8, 0.2])
  })
})
