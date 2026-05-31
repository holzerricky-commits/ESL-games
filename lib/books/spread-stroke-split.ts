/** Epsilon for float compares and duplicate-point suppression (client px space). */
export const SPREAD_STROKE_SPLIT_EPS = 1e-6

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export type PageRect = Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height' | 'right'>

export type SeamSplitPolylineChains = {
  left: [number, number][][]
  right: [number, number][][]
}

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

type ChainState = {
  leftChains: [number, number][][]
  rightChains: [number, number][][]
  left: [number, number][] | null
  right: [number, number][] | null
}

function openLeft(state: ChainState): [number, number][] {
  if (!state.left) {
    state.left = []
    state.leftChains.push(state.left)
  }
  return state.left
}

function openRight(state: ChainState): [number, number][] {
  if (!state.right) {
    state.right = []
    state.rightChains.push(state.right)
  }
  return state.right
}

function closeLeft(state: ChainState): void {
  state.left = null
}

function closeRight(state: ChainState): void {
  state.right = null
}

function pushToBothSides(state: ChainState, p: readonly [number, number]): void {
  pushDistinct(openLeft(state), p)
  pushDistinct(openRight(state), p)
}

/**
 * Split a polyline at a vertical seam into separate chains per page.
 * Each time the stroke leaves a page (crosses the seam), that page's chain is closed so
 * re-entry later does not draw a straight connector between the two crossing points.
 */
export function splitPolylineAtVerticalSeam(
  points: readonly (readonly [number, number])[],
  seamX: number,
): SeamSplitPolylineChains {
  const state: ChainState = { leftChains: [], rightChains: [], left: null, right: null }
  if (points.length < 2) return { left: [], right: [] }

  const p0 = points[0]
  const s0 = sideOfSeam(p0[0], seamX)
  if (s0 === 'L') pushDistinct(openLeft(state), p0)
  else if (s0 === 'R') pushDistinct(openRight(state), p0)
  else pushToBothSides(state, p0)

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const sp = sideOfSeam(prev[0], seamX)
    const sc = sideOfSeam(cur[0], seamX)

    if (sp === 'L' && sc === 'L') {
      pushDistinct(openLeft(state), cur)
    } else if (sp === 'R' && sc === 'R') {
      pushDistinct(openRight(state), cur)
    } else if (sp === 'M' && sc === 'M') {
      pushToBothSides(state, cur)
    } else if (sp === 'L' && sc === 'M') {
      pushToBothSides(state, cur)
    } else if (sp === 'M' && sc === 'L') {
      pushToBothSides(state, cur)
    } else if (sp === 'R' && sc === 'M') {
      pushToBothSides(state, cur)
    } else if (sp === 'M' && sc === 'R') {
      pushToBothSides(state, cur)
    } else if (sp === 'L' && sc === 'R') {
      const hit = intersectSegmentWithVerticalLine(prev[0], prev[1], cur[0], cur[1], seamX)
      if (hit) pushDistinct(openLeft(state), hit)
      closeLeft(state)
      if (hit) pushDistinct(openRight(state), hit)
      else openRight(state)
      pushDistinct(openRight(state), cur)
    } else if (sp === 'R' && sc === 'L') {
      const hit = intersectSegmentWithVerticalLine(prev[0], prev[1], cur[0], cur[1], seamX)
      if (hit) pushDistinct(openRight(state), hit)
      closeRight(state)
      if (hit) pushDistinct(openLeft(state), hit)
      else openLeft(state)
      pushDistinct(openLeft(state), cur)
    }
  }

  return { left: state.leftChains, right: state.rightChains }
}

/** First chain on each side (legacy helper for two-point / single-cross callers). */
export function firstSeamSplitChain(chains: [number, number][][]): [number, number][] {
  return chains[0] ?? []
}

/**
 * Split a client-space polyline across the spread seam and map each side into normalized page coordinates.
 */
export function splitClientPolylineToPageNormalizedChains(
  pts: readonly (readonly [number, number])[],
  leftRect: PageRect,
  rightRect: PageRect,
): { leftNorm: [number, number][][]; rightNorm: [number, number][][] } {
  const seam = seamClientX(leftRect, rightRect)
  const { left: leftClient, right: rightClient } = splitPolylineAtVerticalSeam(pts, seam)
  const leftNorm = leftClient.map((chain) =>
    chain.map(([cx, cy]) => clientPointToPageNorm(leftRect, cx, cy)),
  )
  const rightNorm = rightClient.map((chain) =>
    chain.map(([cx, cy]) => clientPointToPageNorm(rightRect, cx, cy)),
  )
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
): SeamSplitPolylineChains {
  return splitPolylineAtVerticalSeam(points, seamNormX)
}

export type SpreadInkLayout = {
  spreadOverlayWidthPx: number
  spreadPageWidthPx: number
  leftPageOriginXPx: number
  rightPageOriginXPx: number
  seamNormX: number
}

function mapSpreadChainToPageNorm(
  chain: readonly (readonly [number, number])[],
  pageOriginXPx: number,
  layout: SpreadInkLayout,
): [number, number][] {
  return chain.map(([px, py]) =>
    spreadNormPointToPageNorm(px, py, pageOriginXPx, layout.spreadPageWidthPx, layout.spreadOverlayWidthPx),
  )
}

/**
 * Split spread-overlay stroke points and map each side to page-normalized chains.
 * Use the same `draft.points` as live preview so path + effect-ink pattern stay aligned after commit.
 */
export function splitSpreadNormPolylineToPageNormalizedChains(
  spreadNormPts: readonly (readonly [number, number])[],
  layout: SpreadInkLayout,
): { leftNorm: [number, number][][]; rightNorm: [number, number][][] } {
  const { left, right } = splitSpreadNormPolylineAtSeam(spreadNormPts, layout.seamNormX)
  const leftNorm = left.map((chain) => mapSpreadChainToPageNorm(chain, layout.leftPageOriginXPx, layout))
  const rightNorm = right.map((chain) => mapSpreadChainToPageNorm(chain, layout.rightPageOriginXPx, layout))
  return { leftNorm, rightNorm }
}

/** Map spread-overlay norm points through live DOM rects so commit matches live preview geometry. */
export function splitSpreadNormPolylineViaClientRects(
  spreadNormPts: readonly (readonly [number, number])[],
  spreadRect: PageRect,
  leftRect: PageRect,
  rightRect: PageRect,
): { leftNorm: [number, number][][]; rightNorm: [number, number][][] } {
  const w = spreadRect.width
  const h = spreadRect.height
  if (!(w > 0) || !(h > 0) || spreadNormPts.length === 0) {
    return { leftNorm: [], rightNorm: [] }
  }
  const clientPts = spreadNormPts.map(
    ([nx, ny]) =>
      [spreadRect.left + nx * w, spreadRect.top + ny * h] as [number, number],
  )
  return splitClientPolylineToPageNormalizedChains(clientPts, leftRect, rightRect)
}
