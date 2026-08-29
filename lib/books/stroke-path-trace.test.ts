import { describe, expect, it, vi } from 'vitest'
import { strokeToolUsesSmoothCurves, traceStrokePoints } from '@/lib/books/stroke-path-trace'

function mockCtx() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    lineWidth: 2.5,
    lineCap: 'round' as CanvasLineCap,
    lineJoin: 'round' as CanvasLineJoin,
  }
}

describe('stroke-path-trace', () => {
  it('uses smooth curves for pen only (not wide marker bands)', () => {
    expect(strokeToolUsesSmoothCurves('pen')).toBe(true)
    expect(strokeToolUsesSmoothCurves('marker')).toBe(false)
    expect(strokeToolUsesSmoothCurves('eraser-line')).toBe(false)
  })

  it('traces marker with line segments', () => {
    const ctx = mockCtx() as unknown as CanvasRenderingContext2D

    traceStrokePoints(
      ctx,
      'marker',
      [
        [0, 0],
        [0.25, 0.1],
        [0.5, 0.2],
      ],
      (nx) => nx * 100,
      (ny) => ny * 100,
    )

    expect(ctx.bezierCurveTo).not.toHaveBeenCalled()
    expect(ctx.quadraticCurveTo).not.toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalled()
  })

  it('traces pen with cubics', () => {
    const ctx = mockCtx() as unknown as CanvasRenderingContext2D

    traceStrokePoints(
      ctx,
      'pen',
      [
        [0, 0],
        [0.25, 0.1],
        [0.5, 0.2],
        [0.75, 0.15],
      ],
      (nx) => nx * 100,
      (ny) => ny * 100,
    )

    expect(ctx.bezierCurveTo).toHaveBeenCalled()
    expect(ctx.quadraticCurveTo).not.toHaveBeenCalled()
    expect(ctx.lineTo).not.toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })

  it('tapers solid pen with one stroke per span', () => {
    const widths: number[] = []
    const ctx = mockCtx() as unknown as CanvasRenderingContext2D
    Object.defineProperty(ctx, 'lineWidth', {
      set(v: number) {
        widths.push(v)
      },
      get() {
        return widths[widths.length - 1] ?? 2.5
      },
    })

    traceStrokePoints(
      ctx,
      'pen',
      [
        [0.05, 0.5],
        [0.2, 0.5],
        [0.5, 0.5],
        [0.95, 0.5],
      ],
      (nx) => nx * 400,
      (ny) => ny * 400,
      undefined,
      { taperWidthPx: 3 },
    )

    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(3)
    expect(ctx.stroke).toHaveBeenCalledTimes(3)
    expect(Math.min(...widths)).toBeLessThan(3)
    expect(Math.max(...widths)).toBeLessThanOrEqual(3)
  })

  it('uses line segments for eraser-line', () => {
    const ctx = mockCtx() as unknown as CanvasRenderingContext2D

    traceStrokePoints(
      ctx,
      'eraser-line',
      [
        [0, 0],
        [0.25, 0.1],
        [0.5, 0.2],
      ],
      (nx) => nx * 100,
      (ny) => ny * 100,
    )

    expect(ctx.bezierCurveTo).not.toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalled()
  })
})
