import type { TwoPointShapeDraftKind } from '@/lib/books/two-point-shape-preview'
import {
  lockStraightStrokeAxis,
  resolveStraightStrokeAxis,
  type StraightStrokeAxis,
} from '@/lib/books/stroke-straight-line'

export type HoldShapeKind = Extract<TwoPointShapeDraftKind, 'line' | 'rect' | 'ellipse' | 'triangle'>

export type HoldShapeDraft = {
  kind: HoldShapeKind
  anchor: [number, number]
  current: [number, number]
  lineAxis: StraightStrokeAxis | null
  /** Closed shapes: ignore micro-movement at the pause point until resize is intentional. */
  pausePoint?: [number, number] | null
}

/** Squared norm distance before a closed hold-shape starts resizing after pause. */
export const HOLD_SHAPE_RESIZE_ARM_DIST_SQ = 8e-5

/** Minimum bbox edge (norm) for a recognizable shape. */
export const HOLD_SHAPE_MIN_SIZE = 0.012

/** Best candidate must meet this score (0–1). */
export const HOLD_SHAPE_MIN_CONFIDENCE = 0.52

type BBox = { x: number; y: number; w: number; h: number; cx: number; cy: number; diag: number }

type ShapeCandidate = { kind: HoldShapeKind; score: number }

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function computeBBox(points: readonly [number, number][]): BBox {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const [x, y] of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const w = Math.max(0, maxX - minX)
  const h = Math.max(0, maxY - minY)
  return {
    x: minX,
    y: minY,
    w,
    h,
    cx: minX + w / 2,
    cy: minY + h / 2,
    diag: Math.hypot(w, h),
  }
}

function polylineLength(points: readonly [number, number][]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1]!, points[i]!)
  }
  return len
}

function pointLineDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq))
  return dist(p, [a[0] + t * dx, a[1] + t * dy])
}

function perpendicularDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number],
): number {
  return pointLineDistance(point, lineStart, lineEnd)
}

function rdp(points: readonly [number, number][], epsilon: number): [number, number][] {
  if (points.length <= 2) return [...points]
  const start = points[0]!
  const end = points[points.length - 1]!
  let maxDist = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i]!, start, end)
    if (d > maxDist) {
      maxDist = d
      index = i
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon)
    const right = rdp(points.slice(index), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [start, end]
}

/** RDP on a closed loop by cutting away from the duplicate closure point. */
function simplifiedClosedLoopCorners(
  points: readonly [number, number][],
  epsilon: number,
): [number, number][] {
  if (points.length < 4) return [...points]
  const mid = Math.floor(points.length / 2)
  const open: [number, number][] = [...points.slice(mid), ...points.slice(0, mid + 1)]
  const simplified = rdp(open, epsilon)
  if (simplified.length >= 3) return simplified
  return rdp(points.slice(0, -1), epsilon)
}

function isClosedLoop(points: readonly [number, number][], bbox: BBox): boolean {
  if (points.length < 6) return false
  const gap = dist(points[0]!, points[points.length - 1]!)
  return gap <= Math.max(0.02, bbox.diag * 0.22)
}

function cornerAngles(corners: readonly [number, number][]): number[] {
  const angles: number[] = []
  const n = corners.length
  if (n < 3) return angles
  for (let i = 0; i < n; i++) {
    const prev = corners[(i + n - 1) % n]!
    const cur = corners[i]!
    const next = corners[(i + 1) % n]!
    const v1x = prev[0] - cur[0]
    const v1y = prev[1] - cur[1]
    const v2x = next[0] - cur[0]
    const v2y = next[1] - cur[1]
    const dot = v1x * v2x + v1y * v2y
    const m1 = Math.hypot(v1x, v1y)
    const m2 = Math.hypot(v2x, v2y)
    if (m1 < 1e-8 || m2 < 1e-8) continue
    const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)))
    angles.push((Math.acos(cos) * 180) / Math.PI)
  }
  return angles
}

function angleNearScore(angle: number, target: number, tolerance: number): number {
  const d = Math.abs(angle - target)
  return Math.max(0, 1 - d / tolerance)
}

function rectEdgeScore(points: readonly [number, number][], bbox: BBox): number {
  if (bbox.w < 1e-6 || bbox.h < 1e-6) return 0
  const tol = Math.max(0.012, Math.min(bbox.w, bbox.h) * 0.22)
  let near = 0
  for (const [x, y] of points) {
    const dLeft = Math.abs(x - bbox.x)
    const dRight = Math.abs(x - (bbox.x + bbox.w))
    const dTop = Math.abs(y - bbox.y)
    const dBottom = Math.abs(y - (bbox.y + bbox.h))
    if (Math.min(dLeft, dRight, dTop, dBottom) <= tol) near += 1
  }
  return near / points.length
}

function scoreLine(points: readonly [number, number][], bbox: BBox): number {
  if (points.length < 2 || bbox.diag < HOLD_SHAPE_MIN_SIZE) return 0
  if (isClosedLoop(points, bbox)) return 0
  const a = points[0]!
  const b = points[points.length - 1]!
  const chord = dist(a, b)
  if (chord < HOLD_SHAPE_MIN_SIZE) return 0
  let maxDev = 0
  for (const p of points) {
    maxDev = Math.max(maxDev, pointLineDistance(p, a, b))
  }
  return Math.max(0, 1 - maxDev / (chord * 0.38))
}

function countNearRightAngles(angles: readonly number[], tolerance = 28): number {
  return angles.filter((a) => Math.abs(a - 90) <= tolerance).length
}

function scoreRect(points: readonly [number, number][], bbox: BBox): number {
  if (!isClosedLoop(points, bbox)) return 0
  if (bbox.w < HOLD_SHAPE_MIN_SIZE || bbox.h < HOLD_SHAPE_MIN_SIZE) return 0
  const epsilon = Math.max(0.004, bbox.diag * 0.06)
  const simplified = simplifiedClosedLoopCorners(points, epsilon)
  const cornerCount = simplified.length
  if (cornerCount < 4 || cornerCount > 7) return 0
  const angles = cornerAngles(simplified)
  if (angles.length < 3) return 0
  const rightAngleHits = countNearRightAngles(angles)
  if (rightAngleHits < 3) return 0
  const rightAngles =
    angles.reduce((sum, a) => sum + angleNearScore(a, 90, 38), 0) / angles.length
  const edge = rectEdgeScore(points, bbox)
  const aspectPenalty =
    Math.min(bbox.w, bbox.h) / Math.max(bbox.w, bbox.h, 1e-6) < 0.18 ? 0.75 : 1
  return Math.min(1, (0.45 * rightAngles + 0.55 * edge) * aspectPenalty)
}

function scoreEllipse(points: readonly [number, number][], bbox: BBox): number {
  if (!isClosedLoop(points, bbox)) return 0
  if (bbox.w < HOLD_SHAPE_MIN_SIZE || bbox.h < HOLD_SHAPE_MIN_SIZE) return 0
  const rx = bbox.w / 2
  const ry = bbox.h / 2
  if (rx < 1e-6 || ry < 1e-6) return 0
  let err = 0
  for (const [x, y] of points) {
    const nx = (x - bbox.cx) / rx
    const ny = (y - bbox.cy) / ry
    err += Math.abs(Math.hypot(nx, ny) - 1)
  }
  const fit = Math.max(0, 1 - err / points.length / 0.42)
  const epsilon = Math.max(0.004, bbox.diag * 0.06)
  const cornerCount = simplifiedClosedLoopCorners(points, epsilon).length
  const smoothBonus = cornerCount >= 6 ? 0.12 : cornerCount <= 4 ? -0.18 : 0
  return Math.max(0, Math.min(1, fit + smoothBonus))
}

function scoreTriangle(points: readonly [number, number][], bbox: BBox): number {
  if (!isClosedLoop(points, bbox)) return 0
  if (bbox.w < HOLD_SHAPE_MIN_SIZE || bbox.h < HOLD_SHAPE_MIN_SIZE) return 0
  const epsilon = Math.max(0.004, bbox.diag * 0.07)
  const simplified = simplifiedClosedLoopCorners(points, epsilon)
  const cornerCount = simplified.length
  if (cornerCount < 3 || cornerCount > 5) return 0
  const angles = cornerAngles(simplified)
  if (angles.length < 3) return 0
  if (countNearRightAngles(angles) >= 3) return 0
  const triAngles =
    angles.reduce(
      (sum, a) =>
        sum + Math.max(angleNearScore(a, 60, 34), angleNearScore(a, 72, 30), angleNearScore(a, 90, 28)),
      0,
    ) / angles.length
  const edge = rectEdgeScore(points, bbox) * 0.82
  const cornerBonus = cornerCount === 4 ? 0.08 : 0
  return Math.min(1, 0.52 * triAngles + 0.48 * edge + cornerBonus)
}

function pickBestCandidate(candidates: ShapeCandidate[]): ShapeCandidate | null {
  let best: ShapeCandidate | null = null
  for (const c of candidates) {
    if (c.score < HOLD_SHAPE_MIN_CONFIDENCE) continue
    if (!best || c.score > best.score) best = c
  }
  return best
}

function bboxCorners(bbox: BBox): [number, number][] {
  return [
    [bbox.x, bbox.y],
    [bbox.x + bbox.w, bbox.y],
    [bbox.x + bbox.w, bbox.y + bbox.h],
    [bbox.x, bbox.y + bbox.h],
  ]
}

/** Opposite bbox corners; anchor is nearest corner to where the stroke started. */
function bboxToAnchorCurrentFromStroke(
  bbox: BBox,
  strokeStart: [number, number],
): { anchor: [number, number]; current: [number, number] } {
  const corners = bboxCorners(bbox)
  let anchorIdx = 0
  let minDist = Infinity
  for (let i = 0; i < corners.length; i++) {
    const d = dist(strokeStart, corners[i]!)
    if (d < minDist) {
      minDist = d
      anchorIdx = i
    }
  }
  const oppositeIdx = (anchorIdx + 2) % 4
  return { anchor: corners[anchorIdx]!, current: corners[oppositeIdx]! }
}

/** Test helper: per-shape scores for tuning recognition. */
export function scoreHoldShapeCandidatesForTest(points: readonly [number, number][]): Record<
  HoldShapeKind,
  number
> & { closed: boolean } {
  const bbox = computeBBox(points)
  return {
    line: scoreLine(points, bbox),
    rect: scoreRect(points, bbox),
    ellipse: scoreEllipse(points, bbox),
    triangle: scoreTriangle(points, bbox),
    closed: isClosedLoop(points, bbox),
  }
}

/** Recognize line / rect / ellipse / triangle from a freehand stroke polyline. */
export function recognizeHoldShapeFromStroke(
  points: readonly [number, number][],
): HoldShapeDraft | null {
  if (points.length < 2) return null
  const bbox = computeBBox(points)
  if (bbox.diag < HOLD_SHAPE_MIN_SIZE) return null

  const candidates: ShapeCandidate[] = [
    { kind: 'line', score: scoreLine(points, bbox) },
    { kind: 'rect', score: scoreRect(points, bbox) },
    { kind: 'ellipse', score: scoreEllipse(points, bbox) },
    { kind: 'triangle', score: scoreTriangle(points, bbox) },
  ]
  const best = pickBestCandidate(candidates)
  if (!best) return null

  if (best.kind === 'line') {
    const anchor = points[0]!
    const current = points[points.length - 1]!
    const lineAxis = resolveStraightStrokeAxis(current[0] - anchor[0], current[1] - anchor[1])
    return { kind: 'line', anchor, current, lineAxis }
  }

  const { anchor, current } = bboxToAnchorCurrentFromStroke(bbox, points[0]!)
  return { kind: best.kind, anchor, current, lineAxis: null }
}

/**
 * On hold activation only: snap open lines to the pointer.
 * Closed shapes keep the hand-drawn bbox — do not shrink to the pause point.
 */
export function snapHoldShapeDraftOnActivate(
  draft: HoldShapeDraft,
  pointer: [number, number],
): void {
  if (draft.kind === 'line') {
    updateHoldShapeDraftAtPointer(draft, pointer)
    return
  }
  draft.pausePoint = pointer
}

/** Keep a snapped hold-shape aligned to the pointer while still dragging. */
export function updateHoldShapeDraftAtPointer(
  draft: HoldShapeDraft,
  pointer: [number, number],
): void {
  if (draft.kind === 'line') {
    draft.lineAxis =
      lockStraightStrokeAxis(draft.lineAxis, draft.anchor, pointer) ?? draft.lineAxis
    if (draft.lineAxis === 'horizontal') {
      draft.current = [pointer[0], draft.anchor[1]]
    } else if (draft.lineAxis === 'vertical') {
      draft.current = [draft.anchor[0], pointer[1]]
    } else {
      draft.current = pointer
    }
    return
  }
  if (draft.pausePoint) {
    const dx = pointer[0] - draft.pausePoint[0]
    const dy = pointer[1] - draft.pausePoint[1]
    if (dx * dx + dy * dy < HOLD_SHAPE_RESIZE_ARM_DIST_SQ) return
    draft.pausePoint = null
  }
  draft.current = pointer
}
