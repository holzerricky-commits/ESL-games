import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

/** Base proximity in normalized page space; multiplied by each eraser-line command's `widthScale`. */
export const ERASER_LINE_BASE_THRESHOLD = 0.026

/** Stamp hit radius as fraction of min(page width, height) — matches draw scale. */
const STAMP_RADIUS_NORM = 0.06
const CALLOUT_RADIUS_NORM = 0.04

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

/** Add interior samples so crossing strokes/shapes register hits between vertices. */
function densifyPolyline(pts: [number, number][], stepsPerSegment = 8): [number, number][] {
  if (pts.length < 2) return pts
  const out: [number, number][] = [pts[0]!]
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]!
    const [x2, y2] = pts[i + 1]!
    for (let s = 1; s <= stepsPerSegment; s++) {
      const t = s / stepsPerSegment
      out.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)])
    }
  }
  return out
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

function eraserPolylineHitsPolyline(
  eraserPts: [number, number][],
  targetPts: [number, number][],
  thresholdNorm: number,
): boolean {
  if (eraserPts.length < 2 || targetPts.length < 2) return false
  const threshSq = thresholdNorm * thresholdNorm
  const denseEraser = densifyPolyline(eraserPts)
  return polylineMinDistSq(targetPts, denseEraser) <= threshSq
}

function normRectOutline(x: number, y: number, w: number, h: number): [number, number][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ]
}

function normRectHitByEraserLine(
  eraserPts: [number, number][],
  x: number,
  y: number,
  w: number,
  h: number,
  thresholdNorm: number,
): boolean {
  if (w <= 0 || h <= 0) return false
  if (eraserPolylineHitsPolyline(eraserPts, normRectOutline(x, y, w, h), thresholdNorm)) return true
  for (const [px, py] of densifyPolyline(eraserPts)) {
    if (px >= x && px <= x + w && py >= y && py <= y + h) return true
  }
  return false
}

function normTriangleOutline(x: number, y: number, w: number, h: number): [number, number][] {
  const topX = x + w / 2
  const topY = y
  const blX = x
  const blY = y + h
  const brX = x + w
  const brY = y + h
  return [
    [topX, topY],
    [blX, blY],
    [brX, brY],
    [topX, topY],
  ]
}

function normPointHitByEraserLine(
  eraserPts: [number, number][],
  center: [number, number],
  radiusNorm: number,
  thresholdNorm: number,
): boolean {
  const hitRadius = radiusNorm + thresholdNorm
  const hitSq = hitRadius * hitRadius
  const threshSq = thresholdNorm * thresholdNorm
  if (eraserPts.length >= 2 && polylineMinDistSq([center], eraserPts) <= threshSq) return true
  for (const [px, py] of densifyPolyline(eraserPts)) {
    if (dist2(px, py, center[0], center[1]) <= hitSq) return true
  }
  return false
}

function textCommandBBox(cmd: Extract<AnnotationCommand, { kind: 'text' }>): {
  x: number
  y: number
  w: number
  h: number
} {
  const lines = cmd.text.length > 0 ? cmd.text.split('\n') : ['']
  const lineCount = lines.length
  const maxW = cmd.maxWidthNorm ?? 0.88
  const w = Math.min(
    maxW,
    Math.max(0.06, ...lines.map((line) => line.length * cmd.fontSizeNorm * 0.55)),
  )
  const h = cmd.fontSizeNorm * 1.4 * lineCount
  return { x: cmd.x, y: cmd.y, w, h }
}

export function penOrMarkerHitByEraserLine(
  stroke: Pick<StrokeAnnotationCommand, 'tool' | 'points'>,
  eraserPts: [number, number][],
  thresholdNorm: number,
): boolean {
  if (stroke.tool !== 'pen' && stroke.tool !== 'marker') return false
  return eraserPolylineHitsPolyline(eraserPts, stroke.points, thresholdNorm)
}

export function commandHitByEraserLine(
  cmd: AnnotationCommand,
  eraserPts: [number, number][],
  thresholdNorm: number,
): boolean {
  if (eraserPts.length < 2) return false

  switch (cmd.kind) {
    case 'stroke': {
      if (cmd.tool === 'eraser-line') return false
      if (cmd.points.length < 2) return false
      return eraserPolylineHitsPolyline(eraserPts, cmd.points, thresholdNorm)
    }
    case 'line':
      return eraserPolylineHitsPolyline(eraserPts, [cmd.a, cmd.b], thresholdNorm)
    case 'arrow':
      return eraserPolylineHitsPolyline(eraserPts, [cmd.from, cmd.to], thresholdNorm)
    case 'rect':
      return normRectHitByEraserLine(eraserPts, cmd.x, cmd.y, cmd.w, cmd.h, thresholdNorm)
    case 'ellipse':
      return normRectHitByEraserLine(eraserPts, cmd.x, cmd.y, cmd.w, cmd.h, thresholdNorm)
    case 'triangle':
      return (
        eraserPolylineHitsPolyline(eraserPts, normTriangleOutline(cmd.x, cmd.y, cmd.w, cmd.h), thresholdNorm) ||
        normRectHitByEraserLine(eraserPts, cmd.x, cmd.y, cmd.w, cmd.h, thresholdNorm)
      )
    case 'stamp':
      return normPointHitByEraserLine(
        eraserPts,
        cmd.center,
        (cmd.scale ?? 1) * STAMP_RADIUS_NORM,
        thresholdNorm,
      )
    case 'callout':
      return normPointHitByEraserLine(
        eraserPts,
        cmd.center,
        (cmd.scale ?? 1) * CALLOUT_RADIUS_NORM,
        thresholdNorm,
      )
    case 'text': {
      const box = textCommandBBox(cmd)
      return normRectHitByEraserLine(eraserPts, box.x, box.y, box.w, box.h, thresholdNorm)
    }
    case 'sticky':
      return normRectHitByEraserLine(eraserPts, cmd.x, cmd.y, cmd.w, cmd.h, thresholdNorm)
    default:
      return false
  }
}

type StackEntry = { index: number; cmd: AnnotationCommand }

function applyEraserLineToStack(
  stack: StackEntry[],
  dead: Set<number>,
  points: [number, number][],
  widthScale: number | undefined,
): void {
  if (points.length < 2) return
  const scale = widthScale != null && Number.isFinite(widthScale) ? widthScale : 1
  const threshold = ERASER_LINE_BASE_THRESHOLD * scale
  for (let s = stack.length - 1; s >= 0; s--) {
    const entry = stack[s]
    if (commandHitByEraserLine(entry.cmd, points, threshold)) {
      dead.add(entry.index)
      stack.splice(s, 1)
    }
  }
}

function isStackableEraserTarget(cmd: AnnotationCommand): boolean {
  if (cmd.kind === 'stroke') {
    return cmd.tool === 'pen' || cmd.tool === 'marker' || cmd.tool === 'eraser'
  }
  return true
}

/**
 * Indices of annotation commands hidden by eraser-line geometry (stack order, same as render).
 * @param trailingDraftEraser Optional in-progress eraser-line for live preview while dragging.
 */
export function computeEraserLineDeadIndices(
  commands: AnnotationCommand[],
  trailingDraftEraser?: Pick<StrokeAnnotationCommand, 'tool' | 'points' | 'widthScale'> | null,
): Set<number> {
  const dead = new Set<number>()
  const stack: StackEntry[] = []

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]
    if (cmd.kind === 'stroke' && cmd.tool === 'eraser-line' && cmd.points.length >= 2) {
      applyEraserLineToStack(stack, dead, cmd.points, cmd.widthScale)
      continue
    }
    if (isStackableEraserTarget(cmd)) {
      stack.push({ index: i, cmd })
    }
  }

  if (
    trailingDraftEraser &&
    trailingDraftEraser.tool === 'eraser-line' &&
    trailingDraftEraser.points.length >= 2
  ) {
    applyEraserLineToStack(stack, dead, trailingDraftEraser.points, trailingDraftEraser.widthScale)
  }

  return dead
}

/** @deprecated Use {@link computeEraserLineDeadIndices} — name kept for call sites. */
export function computeEraserLineDeadStrokeIndices(
  commands: AnnotationCommand[],
  trailingDraftEraser?: Pick<StrokeAnnotationCommand, 'tool' | 'points' | 'widthScale'> | null,
): Set<number> {
  return computeEraserLineDeadIndices(commands, trailingDraftEraser)
}
