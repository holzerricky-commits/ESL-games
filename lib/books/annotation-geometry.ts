import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

/** Base proximity in normalized page space; multiplied by each eraser-line command's `widthScale`. */
export const ERASER_LINE_BASE_THRESHOLD = 0.026

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

/** Squared distance from point (px,py) to segment (x1,y1)-(x2,y2). */
function pointToSegDistSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const vx = x2 - x1
  const vy = y2 - y1
  const len2 = vx * vx + vy * vy
  if (len2 < 1e-18) return dist2(px, py, x1, y1)
  let t = ((px - x1) * vx + (py - y1) * vy) / len2
  t = Math.max(0, Math.min(1, t))
  const qx = x1 + t * vx
  const qy = y1 + t * vy
  return dist2(px, py, qx, qy)
}

/** Minimum squared distance between two polylines (segment–segment). */
export function polylineMinDistSq(a: [number, number][], b: [number, number][]): number {
  let min = Infinity
  for (let i = 0; i < a.length - 1; i++) {
    const [ax1, ay1] = a[i]
    const [ax2, ay2] = a[i + 1]
    for (const [bx, by] of b) {
      min = Math.min(min, pointToSegDistSq(bx, by, ax1, ay1, ax2, ay2))
    }
  }
  for (let j = 0; j < b.length - 1; j++) {
    const [bx1, by1] = b[j]
    const [bx2, by2] = b[j + 1]
    for (const [ax, ay] of a) {
      min = Math.min(min, pointToSegDistSq(ax, ay, bx1, by1, bx2, by2))
    }
  }
  for (let i = 0; i < a.length - 1; i++) {
    const [ax1, ay1] = a[i]
    const [ax2, ay2] = a[i + 1]
    for (let j = 0; j < b.length - 1; j++) {
      const [bx1, by1] = b[j]
      const [bx2, by2] = b[j + 1]
      min = Math.min(min, segmentToSegmentDistSq(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2))
    }
  }
  return min === Infinity ? 0 : min
}

function segmentToSegmentDistSq(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
): number {
  return Math.min(
    pointToSegDistSq(ax1, ay1, bx1, by1, bx2, by2),
    pointToSegDistSq(ax2, ay2, bx1, by1, bx2, by2),
    pointToSegDistSq(bx1, by1, ax1, ay1, ax2, ay2),
    pointToSegDistSq(bx2, by2, ax1, ay1, ax2, ay2),
  )
}

export function penOrMarkerHitByEraserLine(
  stroke: Pick<StrokeAnnotationCommand, 'tool' | 'points'>,
  eraserPts: [number, number][],
  thresholdNorm: number,
): boolean {
  if (stroke.tool !== 'pen' && stroke.tool !== 'marker') return false
  if (eraserPts.length < 2 || stroke.points.length < 2) return false
  const threshSq = thresholdNorm * thresholdNorm
  return polylineMinDistSq(stroke.points, eraserPts) <= threshSq
}

/**
 * Indices of pen/marker stroke commands removed by eraser-line geometry (same stack semantics as legacy flatten).
 */
export function computeEraserLineDeadStrokeIndices(commands: AnnotationCommand[]): Set<number> {
  const dead = new Set<number>()
  type StackEntry = { index: number; stroke: StrokeAnnotationCommand }
  const stack: StackEntry[] = []

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]
    if (cmd.kind !== 'stroke') continue

    if (cmd.tool === 'pen' || cmd.tool === 'marker' || cmd.tool === 'eraser') {
      stack.push({ index: i, stroke: cmd })
      continue
    }

    if (cmd.tool !== 'eraser-line' || cmd.points.length < 2) continue
    const scale = cmd.widthScale != null && Number.isFinite(cmd.widthScale) ? cmd.widthScale : 1
    const threshold = ERASER_LINE_BASE_THRESHOLD * scale

    for (let s = stack.length - 1; s >= 0; s--) {
      const entry = stack[s]
      if (entry.stroke.tool !== 'pen' && entry.stroke.tool !== 'marker') continue
      if (penOrMarkerHitByEraserLine(entry.stroke, cmd.points, threshold)) {
        dead.add(entry.index)
        stack.splice(s, 1)
      }
    }
  }

  return dead
}
