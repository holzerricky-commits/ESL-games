export type StrokePoint = readonly [number, number]

const EPS = 1e-8
/** Centripetal Catmull–Rom — no loops on sharp corners (handwriting, a “7”). */
const CR_ALPHA = 0.5

function dist(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function nextKnot(ti: number, pi: StrokePoint, pj: StrokePoint): number {
  return ti + dist(pi, pj) ** CR_ALPHA
}

/**
 * Cubic Bézier controls for the Catmull–Rom span p1 → p2.
 * Duplicate endpoints (p0=p1 or p3=p2) at the path start/end.
 */
export function centripetalCubicControls(
  p0: StrokePoint,
  p1: StrokePoint,
  p2: StrokePoint,
  p3: StrokePoint,
): { c1: [number, number]; c2: [number, number] } {
  const t0 = 0
  const t1 = nextKnot(t0, p0, p1)
  const t2 = nextKnot(t1, p1, p2)
  const t3 = nextKnot(t2, p2, p3)
  const d2 = Math.max(t2 - t1, EPS)
  const d20 = Math.max(t2 - t0, EPS)
  const d31 = Math.max(t3 - t1, EPS)

  return {
    c1: [
      p1[0] + ((p2[0] - p0[0]) / d20) * (d2 / 3),
      p1[1] + ((p2[1] - p0[1]) / d20) * (d2 / 3),
    ],
    c2: [
      p2[0] - ((p3[0] - p1[0]) / d31) * (d2 / 3),
      p2[1] - ((p3[1] - p1[1]) / d31) * (d2 / 3),
    ],
  }
}

export function catmullRomNeighbor(
  points: readonly StrokePoint[],
  index: number,
): StrokePoint {
  if (index <= 0) return points[0]!
  if (index >= points.length - 1) return points[points.length - 1]!
  return points[index]!
}

/** Start ~full, slight thin at the lift — felt-tip, not calligraphy. */
export const PEN_TAPER_START = 0.94
export const PEN_TAPER_END = 0.78
export const PEN_TAPER_FRAC = 0.16

function smoothstep(u: number): number {
  const x = Math.max(0, Math.min(1, u))
  return x * x * (3 - 2 * x)
}

/** Width multiplier along arc-length t in [0, 1]. */
export function penTaperWidthFactor(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  let f = 1
  if (u < PEN_TAPER_FRAC) {
    f *= PEN_TAPER_START + (1 - PEN_TAPER_START) * smoothstep(u / PEN_TAPER_FRAC)
  }
  if (u > 1 - PEN_TAPER_FRAC) {
    f *= PEN_TAPER_END + (1 - PEN_TAPER_END) * smoothstep((1 - u) / PEN_TAPER_FRAC)
  }
  return f
}
