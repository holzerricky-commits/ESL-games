import type { StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  catmullRomNeighbor,
  centripetalCubicControls,
  penTaperWidthFactor,
  type StrokePoint,
} from '@/lib/books/stroke-catmull-rom'

/** Pen uses curved joins; marker stays polyline so wide bands do not self-fill like opaque ink. */
export function strokeToolUsesSmoothCurves(tool: StrokeAnnotationCommand['tool']): boolean {
  return tool === 'pen'
}

export type TraceStrokeOptions = {
  /**
   * Solid opaque pen: vary width along the path (felt-tip lift).
   * Omit for dashes, translucent brush, and effect inks (joins would darken).
   */
  taperWidthPx?: number
}

function toPx(
  points: readonly StrokePoint[],
  sx: (nx: number) => number,
  sy: (ny: number) => number,
): [number, number][] {
  return points.map((p) => [sx(p[0]), sy(p[1])])
}

function polylineLengths(pts: readonly [number, number][]): { seg: number[]; total: number } {
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1])
    seg.push(L)
    total += L
  }
  return { seg, total }
}

function strokePenCubic(
  ctx: CanvasRenderingContext2D,
  pts: readonly [number, number][],
  i: number,
): void {
  const p0 = catmullRomNeighbor(pts, i - 1)
  const p1 = pts[i]!
  const p2 = pts[i + 1]!
  const p3 = catmullRomNeighbor(pts, i + 2)
  const { c1, c2 } = centripetalCubicControls(p0, p1, p2, p3)
  ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
}

function traceSmoothPenPath(
  ctx: CanvasRenderingContext2D,
  pts: readonly [number, number][],
): void {
  ctx.beginPath()
  ctx.moveTo(pts[0]![0], pts[0]![1])
  for (let i = 0; i < pts.length - 1; i++) {
    strokePenCubic(ctx, pts, i)
  }
  ctx.stroke()
}

function traceTaperedPenPath(
  ctx: CanvasRenderingContext2D,
  pts: readonly [number, number][],
  baseWidthPx: number,
): void {
  const { seg, total } = polylineLengths(pts)
  const skipTaper = total < Math.max(8, baseWidthPx * 4)
  let walked = 0
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < pts.length - 1; i++) {
    const midT = total > 0 ? (walked + seg[i]! / 2) / total : 0.5
    ctx.lineWidth = skipTaper ? baseWidthPx : baseWidthPx * penTaperWidthFactor(midT)
    ctx.beginPath()
    ctx.moveTo(pts[i]![0], pts[i]![1])
    strokePenCubic(ctx, pts, i)
    ctx.stroke()
    walked += seg[i]!
  }
}

/**
 * Trace a polyline with round caps; pen uses centripetal Catmull–Rom cubics.
 */
export function traceStrokePoints(
  ctx: CanvasRenderingContext2D,
  tool: StrokeAnnotationCommand['tool'],
  points: readonly [number, number][],
  sx: (nx: number) => number,
  sy: (ny: number) => number,
  drawCapDot?: (x: number, y: number) => void,
  options?: TraceStrokeOptions,
): void {
  const n = points.length
  if (n === 0) return

  if (n === 1) {
    if (tool !== 'marker' && drawCapDot) {
      drawCapDot(sx(points[0]![0]), sy(points[0]![1]))
    }
    return
  }

  if (strokeToolUsesSmoothCurves(tool)) {
    const pts = toPx(points, sx, sy)
    const taper = options?.taperWidthPx
    if (taper != null && taper > 0) {
      traceTaperedPenPath(ctx, pts, taper)
      return
    }
    traceSmoothPenPath(ctx, pts)
    return
  }

  ctx.beginPath()
  ctx.moveTo(sx(points[0]![0]), sy(points[0]![1]))
  for (let i = 1; i < n; i++) {
    ctx.lineTo(sx(points[i]![0]), sy(points[i]![1]))
  }
  ctx.stroke()
}
