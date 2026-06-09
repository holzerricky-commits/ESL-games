import type { AnnotationLineDashStyle } from '@/lib/books/annotation-command-types'
import { applyAnnotationLineDash } from '@/lib/books/annotation-draw'
import { strokeDotPairAt } from '@/lib/books/stroke-tap-dot'
import { traceStrokePoints } from '@/lib/books/stroke-path-trace'

/** Full-opacity ink on the marker canvas; saturation comes from CSS `mix-blend-mode: multiply`. */
export const MARKER_STROKE_ALPHA = 1

export function applyMarkerCanvasStrokeStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha = MARKER_STROKE_ALPHA,
): void {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

/**
 * Optional canvas segment multiply for self-crossings (not used for live preview — skews hue vs commit).
 */
export function traceMarkerPointsWithOverlapAccumulate(
  ctx: CanvasRenderingContext2D,
  points: readonly [number, number][],
  sx: (nx: number) => number,
  sy: (ny: number) => number,
  lineDashStyle: AnnotationLineDashStyle | undefined,
  lineWidthPx: number,
  color: string,
): void {
  const pts =
    points.length === 1 ? (strokeDotPairAt(points[0]!) as [number, number][]) : points
  if (pts.length < 2) return

  for (let i = 1; i < pts.length; i++) {
    ctx.globalCompositeOperation = i === 1 ? 'source-over' : 'multiply'
    ctx.globalAlpha = 1
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    applyAnnotationLineDash(ctx, lineDashStyle, lineWidthPx)
    ctx.beginPath()
    ctx.moveTo(sx(pts[i - 1]![0]), sy(pts[i - 1]![1]))
    ctx.lineTo(sx(pts[i]![0]), sy(pts[i]![1]))
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

export type DrawMarkerStrokeOptions = {
  /** Live / trailing preview: darken self-crossings on the marker canvas before CSS multiply. */
  accumulateOverlap?: boolean
}

export function drawMarkerStrokePath(
  ctx: CanvasRenderingContext2D,
  points: readonly [number, number][],
  color: string,
  lineWidthPx: number,
  widthPx: number,
  heightPx: number,
  lineDashStyle: AnnotationLineDashStyle | undefined,
  options?: DrawMarkerStrokeOptions,
): void {
  const sx = (nx: number) => nx * widthPx
  const sy = (ny: number) => ny * heightPx

  applyMarkerCanvasStrokeStyle(ctx, color)
  ctx.lineWidth = lineWidthPx

  if (options?.accumulateOverlap) {
    traceMarkerPointsWithOverlapAccumulate(ctx, points, sx, sy, lineDashStyle, lineWidthPx, color)
    return
  }

  const markerPoints =
    points.length === 1 ? (strokeDotPairAt(points[0]!) as [number, number][]) : points
  applyAnnotationLineDash(ctx, lineDashStyle, lineWidthPx)
  traceStrokePoints(ctx, 'marker', markerPoints, sx, sy)
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}
