import { describe, expect, it, vi } from 'vitest'
import { strokeToolUsesSmoothCurves, traceStrokePoints } from '@/lib/books/stroke-path-trace'

describe('stroke-path-trace', () => {
  it('uses smooth curves for pen only (not wide marker bands)', () => {
    expect(strokeToolUsesSmoothCurves('pen')).toBe(true)
    expect(strokeToolUsesSmoothCurves('marker')).toBe(false)
    expect(strokeToolUsesSmoothCurves('eraser-line')).toBe(false)
  })

  it('traces marker with line segments', () => {
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D

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

    expect(ctx.quadraticCurveTo).not.toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalled()
  })

  it('traces pen with quadratics when n ≥ 3', () => {
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D

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

    expect(ctx.quadraticCurveTo).toHaveBeenCalled()
    expect(ctx.lineTo).not.toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })

  it('uses line segments for eraser-line', () => {
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D

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

    expect(ctx.quadraticCurveTo).not.toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalled()
  })
})
