/**
 * Shared math for challenge map node positions and path polylines.
 * Node layout stores per-tile local yPct (0–100); path segments use global canvas y (yCanvasPct).
 */

export const MAP_TILE_ASPECT_RATIO = 1024 / 687

/** Anchor positions within one tile (same as legacy map). */
export const MAP_PATH_ANCHORS: Array<{ xPct: number; yPct: number }> = [
  { xPct: 53, yPct: 8 },
  { xPct: 41, yPct: 20 },
  { xPct: 62, yPct: 33 },
  { xPct: 36, yPct: 48 },
  { xPct: 57, yPct: 63 },
  { xPct: 40, yPct: 79 },
  { xPct: 52, yPct: 92 },
]

export const NODES_PER_TILE = MAP_PATH_ANCHORS.length

export type MapNodeLayout = Record<string, { xPct: number; yPct: number }>

export interface MapPathPoint {
  xPct: number
  yCanvasPct: number
}

export interface MapPathSegment {
  points: MapPathPoint[]
}

export type MapPathSegments = Record<string, MapPathSegment>

export interface CanvasMetrics {
  tileHeight: number
  canvasHeight: number
  tileCount: number
  nodesPerTile: number
}

export function computeCanvasMetrics(
  containerWidth: number,
  nodeCount: number,
  compact: boolean,
): CanvasMetrics {
  const nodesPerTile = NODES_PER_TILE
  const tileCount = Math.max(1, Math.ceil(Math.max(1, nodeCount) / nodesPerTile))
  const tileHeight = Math.max(compact ? 380 : 520, containerWidth * MAP_TILE_ASPECT_RATIO)
  const canvasHeight = tileCount * tileHeight
  return { tileHeight, canvasHeight, tileCount, nodesPerTile }
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** Intro entry before quest 1 — keep on the map (0–100%) so the teacher can always grab the handle. */
export function clampMapPathStartPoint(p: MapPathPoint): MapPathPoint {
  if (!p || typeof p !== 'object') return { xPct: 50, yCanvasPct: 10 }
  const x = typeof p.xPct === 'number' && Number.isFinite(p.xPct) ? p.xPct : 50
  const y = typeof p.yCanvasPct === 'number' && Number.isFinite(p.yCanvasPct) ? p.yCanvasPct : 10
  return {
    xPct: clampPct(x),
    yCanvasPct: clampPct(y),
  }
}

const MAX_START_SEGMENT_POINTS = 48

function defaultIntroStartBeforeFirstQuest(firstNode: MapPathPoint): MapPathPoint {
  return {
    xPct: clampPct(firstNode.xPct),
    yCanvasPct: clampPct(Math.max(4, Math.min(92, firstNode.yCanvasPct - 6))),
  }
}

/**
 * Resolved polyline for the walk from entry → quest 1. Last point always matches `firstNode`.
 */
export function resolveMapPathStartSegment(
  segmentRaw: { points?: MapPathPoint[] } | undefined,
  legacyStart: MapPathPoint | null | undefined,
  firstNode: MapPathPoint,
): MapPathPoint[] {
  const def = defaultIntroStartBeforeFirstQuest(firstNode)
  const pts = segmentRaw?.points
  if (pts && pts.length >= 2) {
    const clamped = pts.filter(isValidPoint).map((p) => ({
      xPct: clampPct(p.xPct),
      yCanvasPct: clampPct(p.yCanvasPct),
    }))
    const trimmed = clamped.slice(0, MAX_START_SEGMENT_POINTS)
    if (trimmed.length < 2) return [def, firstNode]
    const mid = trimmed.slice(1, -1)
    return [trimmed[0], ...mid, firstNode]
  }
  if (legacyStart && Number.isFinite(legacyStart.xPct) && Number.isFinite(legacyStart.yCanvasPct)) {
    return [clampMapPathStartPoint(legacyStart), firstNode]
  }
  return [def, firstNode]
}

/** Persisted shape: same as resolved, clamped; last point must match current first node. */
export function sanitizeMapPathStartSegmentForSave(points: MapPathPoint[], firstNode: MapPathPoint): MapPathPoint[] {
  const resolved = resolveMapPathStartSegment({ points }, undefined, firstNode)
  return resolved.map((p) => ({ xPct: clampPct(p.xPct), yCanvasPct: clampPct(p.yCanvasPct) }))
}

/**
 * Node center position in canvas coordinates (matches ChallengeMapCanvas zigzag/linear).
 */
export function nodeIndexToCanvasPoint(
  index: number,
  nodesLength: number,
  quizId: string,
  nodeLayout: MapNodeLayout | undefined,
  layout: 'linear' | 'zigzag',
  metrics: CanvasMetrics,
): MapPathPoint {
  const { tileHeight, canvasHeight, nodesPerTile } = metrics
  if (nodesLength <= 0) return { xPct: 50, yCanvasPct: 50 }

  if (layout === 'linear') {
    const yCanvasPct = ((index + 1) / (nodesLength + 1)) * 100
    return { xPct: 50, yCanvasPct: clampPct(yCanvasPct) }
  }

  const custom = nodeLayout?.[quizId]
  const tileIndex = Math.floor(index / nodesPerTile)
  const anchorIndex = index % nodesPerTile
  const anchor = MAP_PATH_ANCHORS[anchorIndex]

  const xPct = custom ? custom.xPct : anchor.xPct
  const localY = custom ? custom.yPct : anchor.yPct
  const topPx = tileIndex * tileHeight + (localY / 100) * tileHeight
  const yCanvasPct = (topPx / canvasHeight) * 100

  return { xPct: clampPct(xPct), yCanvasPct: clampPct(yCanvasPct) }
}

export function buildDefaultSegmentPoints(
  fromIndex: number,
  toIndex: number,
  fromQuizId: string,
  toQuizId: string,
  assignedQuizIds: string[],
  nodeLayout: MapNodeLayout | undefined,
  layout: 'linear' | 'zigzag',
  metrics: CanvasMetrics,
): MapPathPoint[] {
  const n = assignedQuizIds.length
  const a = nodeIndexToCanvasPoint(fromIndex, n, fromQuizId, nodeLayout, layout, metrics)
  const b = nodeIndexToCanvasPoint(toIndex, n, toQuizId, nodeLayout, layout, metrics)
  return [a, b]
}

const MAX_POINTS_PER_SEGMENT = 48

function isValidPoint(p: unknown): p is MapPathPoint {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return typeof o.xPct === 'number' && typeof o.yCanvasPct === 'number'
}

/** Valid segment keys: fromQuizId for each consecutive pair (not last quiz). */
export function validOutgoingSegmentKeys(assignedQuizIds: string[]): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i < assignedQuizIds.length - 1; i += 1) {
    out.add(assignedQuizIds[i])
  }
  return out
}

/**
 * Clamp points, drop invalid keys, ensure at least two points per segment using node positions.
 */
export function sanitizeMapPathSegments(
  raw: MapPathSegments | undefined,
  assignedQuizIds: string[],
  nodeLayout: MapNodeLayout | undefined,
  layout: 'linear' | 'zigzag',
  containerWidth: number,
  compact: boolean,
): MapPathSegments {
  const n = assignedQuizIds.length
  if (n < 2) return {}
  const metrics = computeCanvasMetrics(containerWidth, n, compact)
  const allowed = validOutgoingSegmentKeys(assignedQuizIds)
  const out: MapPathSegments = {}

  for (const fromId of allowed) {
    const fromIndex = assignedQuizIds.indexOf(fromId)
    if (fromIndex < 0 || fromIndex >= n - 1) continue
    const toId = assignedQuizIds[fromIndex + 1]
    const toIndex = fromIndex + 1
    const defaults = buildDefaultSegmentPoints(fromIndex, toIndex, fromId, toId, assignedQuizIds, nodeLayout, layout, metrics)
    const seg = raw?.[fromId]
    let points: MapPathPoint[] = []
    if (seg?.points && Array.isArray(seg.points)) {
      points = seg.points.filter(isValidPoint).map((p) => ({
        xPct: clampPct(p.xPct),
        yCanvasPct: clampPct(p.yCanvasPct),
      }))
    }
    if (points.length < 2) {
      out[fromId] = { points: defaults }
      continue
    }
    points = points.slice(0, MAX_POINTS_PER_SEGMENT)
    out[fromId] = { points: syncSegmentEndpoints(points, defaults[0], defaults[1]) }
  }

  return out
}

/** Replace first and last point with current node positions; keep middle waypoints. */
export function syncSegmentEndpoints(
  points: MapPathPoint[],
  start: MapPathPoint,
  end: MapPathPoint,
): MapPathPoint[] {
  if (points.length < 2) return [start, end]
  if (points.length === 2) return [start, end]
  return [start, ...points.slice(1, -1), end]
}

/**
 * After node layout changes, re-apply endpoint sync for all segments (caller provides container width).
 */
export function syncAllSegmentEndpoints(
  segments: MapPathSegments,
  assignedQuizIds: string[],
  nodeLayout: MapNodeLayout | undefined,
  layout: 'linear' | 'zigzag',
  containerWidth: number,
  compact: boolean,
): MapPathSegments {
  const n = assignedQuizIds.length
  if (n < 2) return {}
  const metrics = computeCanvasMetrics(containerWidth, n, compact)
  const out: MapPathSegments = {}
  for (let i = 0; i < n - 1; i += 1) {
    const fromId = assignedQuizIds[i]
    const toId = assignedQuizIds[i + 1]
    const defaults = buildDefaultSegmentPoints(i, i + 1, fromId, toId, assignedQuizIds, nodeLayout, layout, metrics)
    const seg = segments[fromId]
    const points = seg?.points?.length ? seg.points : defaults
    const merged = syncSegmentEndpoints(points, defaults[0], defaults[1])
    out[fromId] = { points: merged.map((p) => ({ xPct: clampPct(p.xPct), yCanvasPct: clampPct(p.yCanvasPct) })) }
  }
  return out
}

/** Convert canvas point to SVG coordinates (0..100 x, 0..canvasHeight y in user units if we use viewBox 0 0 100 canvasHeight). */
export function canvasPointToSvgPercent(
  p: MapPathPoint,
  canvasHeightPx: number,
): { x: number; y: number } {
  return {
    x: p.xPct,
    y: (p.yCanvasPct / 100) * canvasHeightPx,
  }
}

/** Distance in normalized map units (x,y both 0–100 scale). */
export function distanceMapPoints(a: MapPathPoint, b: MapPathPoint): number {
  const dx = a.xPct - b.xPct
  const dy = a.yCanvasPct - b.yCanvasPct
  return Math.hypot(dx, dy)
}

export function polylineLength(points: MapPathPoint[]): number {
  if (points.length < 2) return 0
  let sum = 0
  for (let i = 1; i < points.length; i += 1) {
    sum += distanceMapPoints(points[i - 1], points[i])
  }
  return sum
}

/** Point at distance along polyline from start; distance clamped to [0, totalLength]. */
export function pointAtDistanceAlongPolyline(points: MapPathPoint[], distance: number): MapPathPoint {
  if (points.length === 0) return { xPct: 50, yCanvasPct: 50 }
  if (points.length === 1) return { ...points[0] }
  let remaining = Math.max(0, distance)
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const segLen = distanceMapPoints(a, b)
    if (remaining <= segLen) {
      const t = segLen <= 0 ? 0 : remaining / segLen
      return {
        xPct: a.xPct + (b.xPct - a.xPct) * t,
        yCanvasPct: a.yCanvasPct + (b.yCanvasPct - a.yCanvasPct) * t,
      }
    }
    remaining -= segLen
  }
  return { ...points[points.length - 1] }
}

/**
 * Concatenate segment polylines from step 0 through `toStepIndex` (inclusive node index).
 * Deduplicates shared endpoints between consecutive segments.
 */
export function buildPathToStep(
  assignedQuizIds: string[],
  segments: MapPathSegments,
  toStepIndex: number,
  nodeLayout: MapNodeLayout | undefined,
  layout: 'linear' | 'zigzag',
  metrics: CanvasMetrics,
): MapPathPoint[] {
  if (assignedQuizIds.length === 0 || toStepIndex < 0) return []
  if (toStepIndex === 0) {
    const id = assignedQuizIds[0]
    return [nodeIndexToCanvasPoint(0, assignedQuizIds.length, id, nodeLayout, layout, metrics)]
  }

  const out: MapPathPoint[] = []
  for (let step = 0; step < toStepIndex; step += 1) {
    const fromId = assignedQuizIds[step]
    const toId = assignedQuizIds[step + 1]
    const defaults = buildDefaultSegmentPoints(step, step + 1, fromId, toId, assignedQuizIds, nodeLayout, layout, metrics)
    const seg = segments[fromId]?.points?.length ? segments[fromId].points : defaults
    const piece = seg.length >= 2 ? seg : defaults
    if (out.length === 0) {
      out.push(...piece)
    } else {
      const first = piece[0]
      const last = out[out.length - 1]
      const dup =
        Math.abs(first.xPct - last.xPct) < 0.05 && Math.abs(first.yCanvasPct - last.yCanvasPct) < 0.05
      out.push(...(dup ? piece.slice(1) : piece))
    }
  }
  return out
}
