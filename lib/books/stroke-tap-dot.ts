/** Fallback squared norm distance when layout CSS size is unknown (matches TAP_MOVE_EPS). */
export const STROKE_TAP_MAX_DIST_SQ = 0.006 * 0.006

/** Screen-pixel movement below which a stroke counts as a tap (period / i-dot). */
export const STROKE_TAP_MAX_PX = 4

/** Tiny norm offset so split/commit pipelines keep two distinct points for a dot. */
export const STROKE_DOT_NORM_EPS = 1e-5

export type StrokeNormLayoutPx = {
  widthPx: number
  heightPx: number
}

/**
 * CSS size of the 0–1 ink coordinate space (use getBoundingClientRect so zoom is included).
 */
export function strokeLayoutPxFromClientRect(
  rect: Pick<DOMRectReadOnly, 'width' | 'height'> | null | undefined,
): StrokeNormLayoutPx | null {
  if (!rect) return null
  if (!(rect.width > 0) || !(rect.height > 0)) return null
  return { widthPx: rect.width, heightPx: rect.height }
}

/**
 * Two points for a visible dot: same anchor + micro offset so seam-split does not collapse to one point.
 */
export function strokeDotPairAt(p: readonly [number, number]): [number, number][] {
  const x = p[0]
  const y = p[1]
  return [
    [x, y],
    [Math.min(1, x + STROKE_DOT_NORM_EPS), y],
  ]
}

function maxDistSqFromFirst(points: readonly [number, number][]): number {
  if (points.length < 2) return 0
  const [fx, fy] = points[0]!
  let maxSq = 0
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    const dx = p[0] - fx
    const dy = p[1] - fy
    const sq = dx * dx + dy * dy
    if (sq > maxSq) maxSq = sq
  }
  return maxSq
}

export function maxScreenDistPxFromFirst(
  points: readonly [number, number][],
  layout: StrokeNormLayoutPx,
): number {
  if (points.length < 2) return 0
  const [fx, fy] = points[0]!
  const w = layout.widthPx
  const h = layout.heightPx
  let max = 0
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    const d = Math.hypot((p[0] - fx) * w, (p[1] - fy) * h)
    if (d > max) max = d
  }
  return max
}

/**
 * Ensure commit/split always receives a real dot or polyline (never dropped as “one point”).
 * Pass the on-screen size of the ink coordinate space so short zoomed-in strokes stay strokes.
 */
export function ensureStrokeCommitPoints(
  points: readonly [number, number][],
  layout?: StrokeNormLayoutPx | null,
): [number, number][] {
  if (points.length === 0) return []
  const first = points[0]!
  if (isStrokeTap(points, layout)) {
    return strokeDotPairAt(first)
  }
  return points.map((p) => [p[0], p[1]] as [number, number])
}

export function isStrokeTap(
  points: readonly [number, number][],
  layout?: StrokeNormLayoutPx | null,
): boolean {
  if (points.length < 2) return true
  if (layout && layout.widthPx > 0 && layout.heightPx > 0) {
    return maxScreenDistPxFromFirst(points, layout) < STROKE_TAP_MAX_PX
  }
  return maxDistSqFromFirst(points) < STROKE_TAP_MAX_DIST_SQ
}
