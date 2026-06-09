import { describe, expect, it, vi } from 'vitest'
import { MARKER_STROKE_ALPHA, drawMarkerStrokePath } from '@/lib/books/marker-stroke-paint'

describe('marker-stroke-paint', () => {
  it('uses full opacity for committed flat marker (multiply is on the canvas element)', () => {
    expect(MARKER_STROKE_ALPHA).toBe(1)
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      strokeStyle: '',
      fillStyle: '',
      lineCap: 'butt',
      lineJoin: 'miter',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D

    drawMarkerStrokePath(ctx, [[0, 0], [0.5, 0.5]], '#ffeb3b', 22, 100, 100, 'solid')
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('uses multiply composite on later live segments for overlap darken', () => {
    const composites: string[] = []
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      globalAlpha: 1,
      get globalCompositeOperation() {
        return composites[composites.length - 1] ?? 'source-over'
      },
      set globalCompositeOperation(v: string) {
        composites.push(v)
      },
      strokeStyle: '',
      fillStyle: '',
      lineCap: 'round',
      lineJoin: 'round',
      lineWidth: 22,
    } as unknown as CanvasRenderingContext2D

    drawMarkerStrokePath(
      ctx,
      [
        [0, 0],
        [0.2, 0.1],
        [0.4, 0.2],
      ],
      '#ffeb3b',
      22,
      100,
      100,
      'solid',
      { accumulateOverlap: true },
    )
    expect(composites).toContain('multiply')
  })
})
