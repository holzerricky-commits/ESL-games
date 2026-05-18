/** Epsilon for float compares and duplicate-point suppression (client px space). */
export const SPREAD_STROKE_SPLIT_EPS = 1e-6

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export type PageRect = Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height' | 'right'>

/**
 * Vertical seam between two page boxes in client space (handles overlap from spread gutter).
 */
export function seamClientX(leftRect: PageRect, rightRect: PageRect): number {
  return (leftRect.right + rightRect.left) / 2
}

/**
 * Map a client point into normalized [0,1]^2 for one page slot (same semantics as BookPageAnnotationLayer clientToNorm).
 */
export function clientPointToPageNorm(rect: PageRect, cx: number, cy: number): [number, number] {
  const w = rect.width
  const h = rect.height
  if (!(w > 0) || !(h > 0)) return [0, 0]
  const nx = clamp01((cx - rect.left) / w)
  const ny = clamp01((cy - rect.top) / h)
  return [nx, ny]
}

function sideOfSeam(x: number, seamX: number): 'L' | 'M' | 'R' {
  if (x < seamX - SPREAD_STROKE_SPLIT_EPS) return 'L'
  if (x > seamX + SPREAD_STROKE_SPLIT_EPS) return 'R'
  return 'M'
}

/** Intersection of segment A–B with vertical line x = seamX; null if line does not cross inside the open segment (exclusive endpoints on seam handled elsewhere). */
export function intersectSegmentWithVerticalLine(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  seamX: number,
): [number, number] | null {
  const dx = bx - ax
  if (Math.abs(dx) < SPREAD_STROKE_SPLIT_EPS) {
    if (Math.abs(ax - seamX) < SPREAD_STROKE_SPLIT_EPS) return [seamX, ay]
    return null
  }
  const t = (seamX - ax) / dx
  if (t < -SPREAD_STROKE_SPLIT_EPS || t > 1 + SPREAD_STROKE_SPLIT_EPS) return null
  const tt = Math.max(0, Math.min(1, t))
  return [seamX, ay + tt * (by - ay)]
}

function pushDistinct(chain: [number, number][], p: readonly [number, number]) {
  const last = chain[chain.length - 1]
  if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > SPREAD_STROKE_SPLIT_EPS) {
    chain.push([p[0], p[1]])
  }
}

/**
 * Split a polyline in client coordinates at a vertical seam.
 * Points on the seam are duplicated on both sides so each chain stays connected.
 */
export function splitPolylineAtVerticalSeam(
  points: readonly (readonly [number, number])[],
  seamX: number,
): { left: [number, number][]; right: [number, number][] } {
  const left: [number, number][] = []
  const right: [number, number][] = []
  if (points.length < 2) return { left, right }

  const p0 = points[0]
  const s0 = sideOfSeam(p0[0], seamX)
  if (s0 === 'L') pushDistinct(left, p0)
  else if (s0 === 'R') pushDistinct(right, p0)
  else {
    pushDistinct(left, p0)
    pushDistinct(right, p0)
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const sp = sideOfSeam(prev[0], seamX)
    const sc = sideOfSeam(cur[0], seamX)

    if (sp === 'L' && sc === 'L') {
      pushDistinct(left, cur)
    } else if (sp === 'R' && sc === 'R') {
      pushDistinct(right, cur)
    } else if (sp === 'M' && sc === 'M') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'L' && sc === 'M') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'M' && sc === 'L') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'R' && sc === 'M') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'M' && sc === 'R') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'L' && sc === 'R') {
      const hit = intersectSegmentWithVerticalLine(prev[0], prev[1], cur[0], cur[1], seamX)
      if (hit) {
        pushDistinct(left, hit)
        pushDistinct(right, hit)
      }
      pushDistinct(right, cur)
    } else if (sp === 'R' && sc === 'L') {
      const hit = intersectSegmentWithVerticalLine(prev[0], prev[1], cur[0], cur[1], seamX)
      if (hit) {
        pushDistinct(right, hit)
        pushDistinct(left, hit)
      }
      pushDistinct(left, cur)
    }
  }

  return { left, right }
}

/**
 * Split a client-space polyline across the spread seam and map each side into normalized page coordinates.
 */
export function splitClientPolylineToPageNormalizedChains(
  pts: readonly (readonly [number, number])[],
  leftRect: PageRect,
  rightRect: PageRect,
): { leftNorm: [number, number][]; rightNorm: [number, number][] } {
  const seam = seamClientX(leftRect, rightRect)
  const { left: leftClient, right: rightClient } = splitPolylineAtVerticalSeam(pts, seam)
  const leftNorm: [number, number][] = leftClient.map(([cx, cy]) => clientPointToPageNorm(leftRect, cx, cy))
  const rightNorm: [number, number][] = rightClient.map(([cx, cy]) => clientPointToPageNorm(rightRect, cx, cy))
  return { leftNorm, rightNorm }
}

/**
 * Map spread-overlay normalized coords to one page's normalized coords.
 * Spread x runs 0..1 across the full spread overlay; each page slot has a logical X offset.
 */
export function spreadNormPointToPageNorm(
  spreadNx: number,
  spreadNy: number,
  pageOriginXPx: number,
  spreadPageWidthPx: number,
  spreadOverlayWidthPx: number,
): [number, number] {
  if (!(spreadPageWidthPx > 0) || !(spreadOverlayWidthPx > 0)) return [0, 0]
  const spreadX = spreadNx * spreadOverlayWidthPx
  const pageNx = clamp01((spreadX - pageOriginXPx) / spreadPageWidthPx)
  return [pageNx, clamp01(spreadNy)]
}

/** Split a polyline in spread-overlay normalized space (x across full spread, y shared). */
export function splitSpreadNormPolylineAtSeam(
  points: readonly (readonly [number, number])[],
  seamNormX: number,
): { left: [number, number][]; right: [number, number][] } {
  const left: [number, number][] = []
  const right: [number, number][] = []
  if (points.length < 2) return { left, right }

  const p0 = points[0]
  const s0 = sideOfSeam(p0[0], seamNormX)
  if (s0 === 'L') pushDistinct(left, p0)
  else if (s0 === 'R') pushDistinct(right, p0)
  else {
    pushDistinct(left, p0)
    pushDistinct(right, p0)
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const sp = sideOfSeam(prev[0], seamNormX)
    const sc = sideOfSeam(cur[0], seamNormX)

    if (sp === 'L' && sc === 'L') {
      pushDistinct(left, cur)
    } else if (sp === 'R' && sc === 'R') {
      pushDistinct(right, cur)
    } else if (sp === 'M' && sc === 'M') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'L' && sc === 'M') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'M' && sc === 'L') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'R' && sc === 'M') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'M' && sc === 'R') {
      pushDistinct(left, cur)
      pushDistinct(right, cur)
    } else if (sp === 'L' && sc === 'R') {
      const hit = intersectSegmentWithVerticalLine(prev[0], prev[1], cur[0], cur[1], seamNormX)
      if (hit) {
        pushDistinct(left, hit)
        pushDistinct(right, hit)
      }
      pushDistinct(right, cur)
    } else if (sp === 'R' && sc === 'L') {
      const hit = intersectSegmentWithVerticalLine(prev[0], prev[1], cur[0], cur[1], seamNormX)
      if (hit) {
        pushDistinct(right, hit)
        pushDistinct(left, hit)
      }
      pushDistinct(left, cur)
    }
  }

  return { left, right }
}

export type SpreadInkLayout = {
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  leftPageOriginXPx: number
  rightPageOriginXPx: number
  seamNormX: number
}

/**
 * Split spread-overlay stroke points and map each side to page-normalized chains.
 * Use the same `draft.points` as live preview so path + effect-ink pattern stay aligned after commit.
 */
export function splitSpreadNormPolylineToPageNormalizedChains(
  spreadNormPts: readonly (readonly [number, number])[],
  layout: SpreadInkLayout,
): { leftNorm: [number, number][]; rightNorm: [number, number][] } {
  const { left, right } = splitSpreadNormPolylineAtSeam(spreadNormPts, layout.seamNormX)
  const leftNorm: [number, number][] = left.map(([px, py]) =>
    spreadNormPointToPageNorm(px, py, layout.leftPageOriginXPx, layout.spreadPageWidthPx, layout.spreadOverlayWidthPx),
  )
  const rightNorm: [number, number][] = right.map(([px, py]) =>
    spreadNormPointToPageNorm(px, py, layout.rightPageOriginXPx, layout.spreadPageWidthPx, layout.spreadOverlayWidthPx),
  )
  return { leftNorm, rightNorm }
}
