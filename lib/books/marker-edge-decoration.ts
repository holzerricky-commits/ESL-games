import type { AnnotationLineDashStyle } from '@/lib/books/annotation-command-types'

/** Continuous upper-edge silhouette for decorated highlighter strokes. */
export type MarkerEdgeDecoration =
  | 'wave'
  | 'scallop'
  | 'flame'
  | 'mountain'
  | 'heart'
  | 'sparkle'
  | 'bubble'
  | 'bolt'
  | 'flare'
  | 'default'

const MARKER_DECORATION_BY_HEX: Readonly<Record<string, MarkerEdgeDecoration>> = {
  '#ffff00': 'flare',
  '#fff59d': 'flare',
  '#ffeb3b': 'flare',
  '#ff9800': 'flame',
  '#ff5252': 'heart',
  '#ff4081': 'scallop',
  '#e040fb': 'sparkle',
  '#448aff': 'wave',
  '#00e5ff': 'bubble',
  '#69f0ae': 'mountain',
  '#c6ff00': 'bolt',
  '#ffd740': 'flare',
}

export function markerEdgeDecorationForColor(hex: string): MarkerEdgeDecoration {
  const norm = hex.trim().toLowerCase()
  return MARKER_DECORATION_BY_HEX[norm] ?? 'default'
}

type CenterSample = { x: number; y: number; tx: number; ty: number; dist: number }
type EdgePoint = { x: number; y: number }

/** Perpendicular pointing toward the top of the screen (smaller y). */
export function upperEdgeNormal(tx: number, ty: number): { nx: number; ny: number } {
  const len = Math.hypot(tx, ty) || 1
  const nx1 = -ty / len
  const ny1 = tx / len
  const nx2 = ty / len
  const ny2 = -tx / len
  if (ny1 < ny2) return { nx: nx1, ny: ny1 }
  if (ny2 < ny1) return { nx: nx2, ny: ny2 }
  return ny1 <= 0 ? { nx: nx1, ny: ny1 } : { nx: nx2, ny: ny2 }
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function densifyCenterlinePx(
  points: [number, number][],
  sx: (nx: number) => number,
  sy: (ny: number) => number,
  stepPx: number,
): CenterSample[] {
  if (points.length < 2) return []
  const out: CenterSample[] = []
  let px = sx(points[0][0])
  let py = sy(points[0][1])
  let dist = 0

  for (let i = 1; i < points.length; i++) {
    const qx = sx(points[i][0])
    const qy = sy(points[i][1])
    const dx = qx - px
    const dy = qy - py
    const segLen = Math.hypot(dx, dy)
    if (segLen < 1e-6) {
      px = qx
      py = qy
      continue
    }
    const tx = dx / segLen
    const ty = dy / segLen
    const steps = Math.max(1, Math.ceil(segLen / stepPx))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const x = px + dx * t
      const y = py + dy * t
      if (out.length > 0) {
        const prev = out[out.length - 1]!
        dist += Math.hypot(x - prev.x, y - prev.y)
      }
      out.push({ x, y, tx, ty, dist })
    }
    px = qx
    py = qy
  }
  const last = points[points.length - 1]
  const lx = sx(last[0])
  const ly = sy(last[1])
  if (out.length === 0 || out[out.length - 1]!.x !== lx || out[out.length - 1]!.y !== ly) {
    const prev = out[out.length - 1]
    if (prev) dist += Math.hypot(lx - prev.x, ly - prev.y)
    out.push({
      x: lx,
      y: ly,
      tx: out.length > 0 ? out[out.length - 1]!.tx : 1,
      ty: out.length > 0 ? out[out.length - 1]!.ty : 0,
      dist,
    })
  }
  return out
}

/** Extra outward bump along the upper normal (px). */
function profileBump(
  kind: MarkerEdgeDecoration,
  dist: number,
  amplitude: number,
  seed: number,
): number {
  const t = dist / Math.max(amplitude * 2.4, 8)
  switch (kind) {
    case 'wave':
      return amplitude * 0.55 * Math.sin(t * Math.PI * 2)
    case 'scallop':
    case 'heart': {
      const period = amplitude * 1.35
      const phase = ((dist % period) / period) * Math.PI * 2
      const scallop = (1 - Math.cos(phase)) * 0.5
      return amplitude * (kind === 'heart' ? 0.42 : 0.62) * scallop
    }
    case 'bubble': {
      const period = amplitude * 2.2
      const phase = ((dist % period) / period) * Math.PI * 2
      return amplitude * 0.48 * (1 - Math.cos(phase)) * 0.5
    }
    case 'flame': {
      const wave = Math.sin(t * Math.PI * 4.5) * 0.35
      const cell = Math.floor(t * 5)
      const jitter = hash01(seed + cell * 1.7) * 0.65 + hash01(seed + cell * 2.9) * 0.35
      const spike = Math.pow(Math.abs(Math.sin(t * Math.PI * 7)), 0.55) * jitter
      return amplitude * (0.25 + wave + spike * 0.75)
    }
    case 'mountain': {
      const slow = Math.sin(t * Math.PI * 1.4) * 0.35
      const cell = Math.floor(t * 3.2)
      const peak = hash01(seed + cell * 3.1)
      const jag = Math.pow(Math.abs(Math.sin(t * Math.PI * 3.8 + peak * 2)), 0.7)
      return amplitude * (0.2 + slow + jag * (0.45 + peak * 0.55))
    }
    case 'bolt': {
      const period = amplitude * 1.1
      const phase = (dist % period) / period
      const tri = phase < 0.5 ? phase * 2 : (1 - phase) * 2
      return amplitude * (tri * 0.85 - 0.2)
    }
    case 'sparkle': {
      const period = amplitude * 1.25
      const phase = ((dist % period) / period) * Math.PI * 2
      const star = Math.abs(Math.sin(phase * 2)) * 0.5 + Math.abs(Math.sin(phase * 5)) * 0.25
      return amplitude * 0.5 * star
    }
    case 'flare': {
      const ray = Math.pow(Math.abs(Math.sin(t * Math.PI * 6)), 0.35)
      const envelope = 0.35 + Math.sin(t * Math.PI * 1.2) * 0.15
      return amplitude * ray * envelope
    }
    default:
      return amplitude * 0.35 * Math.sin(t * Math.PI * 2)
  }
}

function buildRibbonEdges(
  center: CenterSample[],
  halfBand: number,
  kind: MarkerEdgeDecoration,
  seed: number,
): { bottom: EdgePoint[]; top: EdgePoint[] } {
  const amplitude = halfBand * 0.72
  const bottom: EdgePoint[] = []
  const top: EdgePoint[] = []

  for (const p of center) {
    const up = upperEdgeNormal(p.tx, p.ty)
    const down = { nx: -up.nx, ny: -up.ny }
    const bump = profileBump(kind, p.dist, amplitude, seed)
    bottom.push({
      x: p.x + down.nx * halfBand,
      y: p.y + down.ny * halfBand,
    })
    top.push({
      x: p.x + up.nx * (halfBand + bump),
      y: p.y + up.ny * (halfBand + bump),
    })
  }

  return { bottom, top }
}

function traceClosedRibbon(ctx: CanvasRenderingContext2D, bottom: EdgePoint[], top: EdgePoint[]): void {
  if (bottom.length < 2 || top.length < 2) return
  ctx.beginPath()
  ctx.moveTo(bottom[0]!.x, bottom[0]!.y)
  for (let i = 1; i < bottom.length; i++) {
    ctx.lineTo(bottom[i]!.x, bottom[i]!.y)
  }
  for (let i = top.length - 1; i >= 0; i--) {
    ctx.lineTo(top[i]!.x, top[i]!.y)
  }
  ctx.closePath()
}

function drawCrestHighlights(
  ctx: CanvasRenderingContext2D,
  top: EdgePoint[],
  halfBand: number,
  kind: MarkerEdgeDecoration,
): void {
  if (top.length < 3) return
  const window = Math.max(2, Math.floor(top.length / 24))
  const crests: EdgePoint[] = []

  for (let i = window; i < top.length - window; i++) {
    const y = top[i]!.y
    let isMin = true
    for (let j = i - window; j <= i + window; j++) {
      if (top[j]!.y < y) {
        isMin = false
        break
      }
    }
    if (isMin) crests.push(top[i]!)
  }

  if (crests.length === 0) return

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = kind === 'wave' || kind === 'mountain' ? 0.42 : 0.28
  ctx.fillStyle = '#ffffff'

  const r = Math.max(1.2, halfBand * 0.14)
  for (const c of crests) {
    if (kind === 'flame' || kind === 'mountain') {
      ctx.beginPath()
      ctx.ellipse(c.x, c.y - r * 0.35, r * 0.9, r * 1.4, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind === 'wave' || kind === 'bubble') {
      ctx.beginPath()
      ctx.arc(c.x, c.y, r * 0.85, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind === 'scallop' || kind === 'heart') {
      ctx.beginPath()
      ctx.arc(c.x, c.y - r * 0.2, r * 0.65, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * Draw a full highlighter band with a themed continuous upper silhouette (reference-style).
 * Replaces the flat stroke + stamp overlay when `markerDecoratedEdge` is set on the command.
 */
export function drawDecoratedMarkerBand(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  color: string,
  markerLineWidthPx: number,
  widthPx: number,
  heightPx: number,
): void {
  if (points.length < 2) return

  const sx = (nx: number) => nx * widthPx
  const sy = (ny: number) => ny * heightPx
  const halfBand = markerLineWidthPx / 2
  const center = densifyCenterlinePx(points, sx, sy, 2)
  if (center.length < 2) return

  const kind = markerEdgeDecorationForColor(color)
  const seed = points[0][0] * 997 + points[0][1] * 131
  const { bottom, top } = buildRibbonEdges(center, halfBand, kind, seed)

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  traceClosedRibbon(ctx, bottom, top)
  ctx.fill()

  if (
    kind === 'wave' ||
    kind === 'flame' ||
    kind === 'mountain' ||
    kind === 'scallop' ||
    kind === 'heart' ||
    kind === 'bubble'
  ) {
    drawCrestHighlights(ctx, top, halfBand, kind)
  }

  ctx.restore()
}

/** @deprecated Use drawDecoratedMarkerBand — kept for call-site compatibility. */
export function drawMarkerUpperEdgeDecoration(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  color: string,
  markerLineWidthPx: number,
  widthPx: number,
  heightPx: number,
  lineDashStyle?: AnnotationLineDashStyle,
): void {
  if (lineDashStyle && lineDashStyle !== 'solid') return
  drawDecoratedMarkerBand(ctx, points, color, markerLineWidthPx, widthPx, heightPx)
}
