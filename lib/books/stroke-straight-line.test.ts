import { describe, expect, it } from 'vitest'
import {
  extendStrokeDraftFromMove,
  finalizeStrokeDraftEndPoint,
  lockStraightStrokeAxis,
  resolveStraightStrokeAxis,
  shouldUseStraightStrokeLine,
  straightStrokePoints,
} from '@/lib/books/stroke-straight-line'

describe('stroke-straight-line', () => {
  it('enables straight marker when toggle or shift is held', () => {
    expect(
      shouldUseStraightStrokeLine({ tool: 'marker', shiftKey: false, markerStraightStrokeEnabled: true }),
    ).toBe(true)
    expect(
      shouldUseStraightStrokeLine({ tool: 'marker', shiftKey: true, markerStraightStrokeEnabled: false }),
    ).toBe(true)
    expect(
      shouldUseStraightStrokeLine({ tool: 'marker', shiftKey: false, markerStraightStrokeEnabled: false }),
    ).toBe(false)
  })

  it('enables straight pen only with shift when ink is solid', () => {
    expect(shouldUseStraightStrokeLine({ tool: 'pen', shiftKey: true })).toBe(true)
    expect(shouldUseStraightStrokeLine({ tool: 'pen', shiftKey: false })).toBe(false)
    expect(
      shouldUseStraightStrokeLine({ tool: 'pen', shiftKey: true, penInkStyle: 'rainbow' }),
    ).toBe(false)
  })

  it('enables straight pen when paused with pointer still down', () => {
    expect(
      shouldUseStraightStrokeLine({ tool: 'pen', shiftKey: false, straightFromHold: true }),
    ).toBe(true)
  })

  it('resolves axis from initial displacement', () => {
    expect(resolveStraightStrokeAxis(0.5, 0.1)).toBe('horizontal')
    expect(resolveStraightStrokeAxis(0.1, 0.5)).toBe('vertical')
  })

  it('locks axis on first movement and keeps it', () => {
    const anchor: [number, number] = [0.1, 0.2]
    expect(lockStraightStrokeAxis(null, anchor, [0.1, 0.2])).toBeNull()
    const first = lockStraightStrokeAxis(null, anchor, [0.5, 0.25])
    expect(first).toBe('horizontal')
    expect(lockStraightStrokeAxis(first, anchor, [0.1, 0.9])).toBe('horizontal')
  })

  it('snaps to vertical along locked axis', () => {
    expect(straightStrokePoints([0.1, 0.2], [0.5, 0.8], 'vertical')).toEqual([
      [0.1, 0.2],
      [0.1, 0.8],
    ])
  })

  it('snaps to horizontal along locked axis', () => {
    expect(straightStrokePoints([0.1, 0.2], [0.9, 0.25], 'horizontal')).toEqual([
      [0.1, 0.2],
      [0.9, 0.2],
    ])
  })

  it('finalizeStrokeDraftEndPoint replaces the last freehand point', () => {
    const draft = { tool: 'marker' as const, points: [[0.1, 0.2], [0.5, 0.6]] as [number, number][] }
    finalizeStrokeDraftEndPoint(draft, [0.7, 0.8], {
      shiftKey: false,
      markerStraightStrokeEnabled: false,
      straightStrokeAxis: null,
    })
    expect(draft.points).toEqual([
      [0.1, 0.2],
      [0.7, 0.8],
    ])
  })

  it('finalizeStrokeDraftEndPoint ignores finger-lift jitter near the last point', () => {
    const draft = { tool: 'pen' as const, points: [[0.1, 0.2], [0.5, 0.6]] as [number, number][] }
    finalizeStrokeDraftEndPoint(draft, [0.500001, 0.600001], {
      shiftKey: false,
      markerStraightStrokeEnabled: false,
      straightStrokeAxis: null,
    })
    expect(draft.points[1]).toEqual([0.5, 0.6])
  })

  it('extendStrokeDraftFromMove appends all coalesced freehand samples', () => {
    const draft = { tool: 'pen' as const, points: [[0.1, 0.2]] as [number, number][] }
    extendStrokeDraftFromMove(draft, [
      [0.15, 0.22],
      [0.3, 0.4],
    ], {
      shiftKey: false,
      markerStraightStrokeEnabled: false,
      straightStrokeAxis: null,
    })
    expect(draft.points[0]).toEqual([0.1, 0.2])
    expect(draft.points[1]).toEqual([0.15, 0.22])
    expect(draft.points[2]![0]).toBeCloseTo(0.237, 3)
    expect(draft.points[2]![1]).toBeCloseTo(0.3244, 3)
  })

  it('does not smooth marker sample points', () => {
    const draft = { tool: 'marker' as const, points: [[0.1, 0.2]] as [number, number][] }
    extendStrokeDraftFromMove(draft, [[0.3, 0.4]], {
      shiftKey: false,
      markerStraightStrokeEnabled: false,
      straightStrokeAxis: null,
    })
    expect(draft.points[1]).toEqual([0.3, 0.4])
  })

  it('finalizeStrokeDraftEndPoint snaps straight marker to release position', () => {
    const draft = { tool: 'marker' as const, points: [[0.1, 0.2], [0.5, 0.2]] as [number, number][] }
    finalizeStrokeDraftEndPoint(draft, [0.9, 0.5], {
      shiftKey: false,
      markerStraightStrokeEnabled: true,
      straightStrokeAxis: 'horizontal',
    })
    expect(draft.points).toEqual([
      [0.1, 0.2],
      [0.9, 0.2],
    ])
  })

  it('extendStrokeDraftFromMove snaps freehand to straight after hold pause', () => {
    const draft = { tool: 'pen' as const, points: [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]] as [number, number][] }
    extendStrokeDraftFromMove(draft, [[0.9, 0.25]], {
      shiftKey: false,
      straightFromHold: true,
      markerStraightStrokeEnabled: false,
      straightStrokeAxis: null,
    })
    expect(draft.points).toEqual([
      [0.1, 0.2],
      [0.9, 0.2],
    ])
  })
})
