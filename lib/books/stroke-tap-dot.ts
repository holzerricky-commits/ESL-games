/** Squared norm distance below which a stroke counts as a tap (matches book-page TAP_MOVE_EPS). */
export const STROKE_TAP_MAX_DIST_SQ = 0.006 * 0.006

/** Tiny norm offset so split/commit pipelines keep two distinct points for a dot. */
export const STROKE_DOT_NORM_EPS = 1e-5

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

/**
 * Ensure commit/split always receives a real dot or polyline (never dropped as “one point”).
 */
export function ensureStrokeCommitPoints(
  points: readonly [number, number][],
): [number, number][] {
  if (points.length === 0) return []
  const first = points[0]!
  if (points.length === 1 || maxDistSqFromFirst(points) < STROKE_TAP_MAX_DIST_SQ) {
    return strokeDotPairAt(first)
  }
  return points.map((p) => [p[0], p[1]] as [number, number])
}

export function isStrokeTap(points: readonly [number, number][]): boolean {
  if (points.length < 2) return true
  return maxDistSqFromFirst(points) < STROKE_TAP_MAX_DIST_SQ
}
