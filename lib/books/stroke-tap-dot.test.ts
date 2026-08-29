import { describe, expect, it } from 'vitest'
import {
  STROKE_TAP_MAX_PX,
  ensureStrokeCommitPoints,
  isStrokeTap,
  strokeDotPairAt,
  strokeLayoutPxFromClientRect,
} from '@/lib/books/stroke-tap-dot'

describe('stroke-tap-dot', () => {
  it('strokeDotPairAt returns two distinct points', () => {
    const pair = strokeDotPairAt([0.5, 0.4])
    expect(pair).toHaveLength(2)
    expect(pair[0]).toEqual([0.5, 0.4])
    expect(pair[1]![0]).toBeGreaterThan(pair[0]![0])
    expect(pair[1]![1]).toBe(pair[0]![1])
  })

  it('ensureStrokeCommitPoints expands a single point', () => {
    const out = ensureStrokeCommitPoints([[0.2, 0.3]])
    expect(out).toHaveLength(2)
  })

  it('ensureStrokeCommitPoints expands a tap (two near points)', () => {
    const out = ensureStrokeCommitPoints([
      [0.2, 0.3],
      [0.200001, 0.300001],
    ])
    expect(out).toHaveLength(2)
    expect(out[1]![0]).toBeGreaterThan(out[0]![0])
  })

  it('ensureStrokeCommitPoints keeps a real stroke', () => {
    const pts: [number, number][] = [
      [0.1, 0.1],
      [0.5, 0.5],
    ]
    const out = ensureStrokeCommitPoints(pts)
    expect(out).toEqual(pts)
  })

  it('isStrokeTap detects minimal movement', () => {
    expect(isStrokeTap([[0.5, 0.5]])).toBe(true)
    expect(
      isStrokeTap([
        [0.5, 0.5],
        [0.9, 0.9],
      ]),
    ).toBe(false)
  })

  it('keeps a short stroke when zoomed in (screen pixels over page percent)', () => {
    const pts: [number, number][] = [
      [0.4, 0.5],
      [0.403, 0.5],
    ]
    const zoomed = { widthPx: 2400, heightPx: 3200 }
    expect(isStrokeTap(pts, zoomed)).toBe(false)
    expect(ensureStrokeCommitPoints(pts, zoomed)).toEqual(pts)
  })

  it('still collapses a click-sized wiggle into a dot', () => {
    const pts: [number, number][] = [
      [0.4, 0.5],
      [0.4005, 0.5],
    ]
    const layout = { widthPx: 800, heightPx: 1000 }
    expect(isStrokeTap(pts, layout)).toBe(true)
    const out = ensureStrokeCommitPoints(pts, layout)
    expect(out[0]).toEqual(pts[0])
    expect(out[1]![0]).toBeGreaterThan(out[0]![0])
  })

  it('strokeLayoutPxFromClientRect rejects empty rects', () => {
    expect(strokeLayoutPxFromClientRect({ width: 0, height: 100 })).toBeNull()
    expect(strokeLayoutPxFromClientRect({ width: 120, height: 80 })).toEqual({
      widthPx: 120,
      heightPx: 80,
    })
  })

  it('tap threshold is a few CSS pixels', () => {
    expect(STROKE_TAP_MAX_PX).toBe(4)
  })
})
