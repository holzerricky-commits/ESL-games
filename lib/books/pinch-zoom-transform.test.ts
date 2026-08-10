import { describe, expect, it } from 'vitest'
import {
  applyPinchZoomWheelAtClient,
  BOOK_PINCH_ZOOM_MAX_WHEEL_DELTA,
  BOOK_PINCH_ZOOM_MIN_SCALE,
  clampPinchZoomPan,
  clampPinchZoomWheelDelta,
  defaultPinchZoomState,
  isPinchZoomActive,
  pinchZoomFactorFromWheelDelta,
  reclampPinchZoomState,
} from '@/lib/books/pinch-zoom-transform'

describe('pinchZoomFactorFromWheelDelta', () => {
  it('zooms in on negative deltaY', () => {
    expect(pinchZoomFactorFromWheelDelta(-100)).toBeGreaterThan(1)
  })

  it('is more sensitive than the prior 0.0015 factor', () => {
    const prevFactor = Math.exp(-100 * 0.0015)
    const newFactor = pinchZoomFactorFromWheelDelta(-100)
    expect(Math.abs(newFactor - 1)).toBeGreaterThan(Math.abs(prevFactor - 1) * 2.5)
  })

  it('zooms out on positive deltaY', () => {
    expect(pinchZoomFactorFromWheelDelta(100)).toBeLessThan(1)
  })
})

describe('clampPinchZoomWheelDelta', () => {
  it('caps large trackpad bursts', () => {
    expect(clampPinchZoomWheelDelta(500)).toBe(BOOK_PINCH_ZOOM_MAX_WHEEL_DELTA)
    expect(clampPinchZoomWheelDelta(-500)).toBe(-BOOK_PINCH_ZOOM_MAX_WHEEL_DELTA)
  })

  it('passes small deltas through', () => {
    expect(clampPinchZoomWheelDelta(20)).toBe(20)
  })
})

describe('clampPinchZoomPan', () => {
  const area = {
    spreadOuterW: 600,
    spreadOuterH: 400,
    pageAreaW: 1000,
    pageAreaH: 800,
  }

  it('keeps fit/shrink centered', () => {
    expect(
      clampPinchZoomPan({
        panX: 80,
        panY: -40,
        scale: 1,
        ...area,
      }),
    ).toEqual({ panX: 0, panY: 0 })
    expect(
      clampPinchZoomPan({
        panX: 80,
        panY: -40,
        scale: BOOK_PINCH_ZOOM_MIN_SCALE,
        ...area,
      }),
    ).toEqual({ panX: 0, panY: 0 })
  })

  it('allows an edge of the zoomed spread to reach screen center', () => {
    const scale = 2
    const halfW = (area.spreadOuterW * scale) / 2
    const halfH = (area.spreadOuterH * scale) / 2
    const atEdge = clampPinchZoomPan({
      panX: halfW,
      panY: -halfH,
      scale,
      ...area,
    })
    expect(atEdge.panX).toBe(halfW)
    expect(atEdge.panY).toBe(-halfH)

    const beyond = clampPinchZoomPan({
      panX: halfW + 200,
      panY: -(halfH + 200),
      scale,
      ...area,
    })
    expect(beyond.panX).toBe(halfW)
    expect(beyond.panY).toBe(-halfH)
  })

  it('allows more pan than the old cover-only clamp', () => {
    const scale = 1.5
    const halfW = (area.spreadOuterW * scale) / 2
    const oldCoverMax = Math.abs(area.pageAreaW / 2 - halfW)
    const mid = clampPinchZoomPan({
      panX: oldCoverMax + 40,
      panY: 0,
      scale,
      ...area,
    })
    expect(Math.abs(mid.panX)).toBeGreaterThan(oldCoverMax)
  })
})

describe('applyPinchZoomWheelAtClient', () => {
  const initial = defaultPinchZoomState()

  it('keeps anchor stable when zooming in', () => {
    const anchorX = 500
    const anchorY = 400
    const next = applyPinchZoomWheelAtClient({
      state: initial,
      anchorX,
      anchorY,
      deltaY: -40,
      spreadOuterW: 600,
      spreadOuterH: 400,
      pageAreaW: 1000,
      pageAreaH: 800,
    })
    expect(next.scale).toBeGreaterThan(1)
    const centerX = 500
    const centerY = 400
    const localX = (anchorX - centerX - initial.panX) / initial.scale
    const localY = (anchorY - centerY - initial.panY) / initial.scale
    expect(anchorX).toBeCloseTo(centerX + next.panX + localX * next.scale, 4)
    expect(anchorY).toBeCloseTo(centerY + next.panY + localY * next.scale, 4)
  })

  it('allows mild shrink below fit and clamps at min scale', () => {
    let state = initial
    for (let i = 0; i < 40; i++) {
      state = applyPinchZoomWheelAtClient({
        state,
        anchorX: 500,
        anchorY: 400,
        deltaY: 2000,
        spreadOuterW: 600,
        spreadOuterH: 400,
        pageAreaW: 1000,
        pageAreaH: 800,
      })
    }
    expect(state.scale).toBe(BOOK_PINCH_ZOOM_MIN_SCALE)
    expect(isPinchZoomActive(state)).toBe(true)
    expect(state.panX).toBe(0)
    expect(state.panY).toBe(0)
  })

  it('button steps skip the trackpad delta clamp', () => {
    const clamped = applyPinchZoomWheelAtClient({
      state: initial,
      anchorX: 500,
      anchorY: 400,
      deltaY: -120,
      spreadOuterW: 600,
      spreadOuterH: 400,
      pageAreaW: 1000,
      pageAreaH: 800,
    })
    const button = applyPinchZoomWheelAtClient({
      state: initial,
      anchorX: 500,
      anchorY: 400,
      deltaY: -120,
      spreadOuterW: 600,
      spreadOuterH: 400,
      pageAreaW: 1000,
      pageAreaH: 800,
      clampWheelDelta: false,
    })
    expect(button.scale).toBeGreaterThan(clamped.scale)
  })

  it('resting fit is inactive', () => {
    expect(isPinchZoomActive(defaultPinchZoomState())).toBe(false)
  })
})

describe('reclampPinchZoomState', () => {
  it('keeps scale and reclamps pan when the reading area shrinks', () => {
    const next = reclampPinchZoomState({
      state: { scale: 2, panX: 900, panY: 0 },
      spreadOuterW: 600,
      spreadOuterH: 400,
      pageAreaW: 1000,
      pageAreaH: 800,
    })
    expect(next.scale).toBe(2)
    expect(next.panX).toBe(600)
    expect(next.panY).toBe(0)
  })

  it('centers pan when scale is at fit', () => {
    expect(
      reclampPinchZoomState({
        state: { scale: 1, panX: 12, panY: -8 },
        spreadOuterW: 600,
        spreadOuterH: 400,
        pageAreaW: 1000,
        pageAreaH: 800,
      }),
    ).toEqual(defaultPinchZoomState())
  })
})
