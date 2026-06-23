/** Default on: only an explicit `false` turns rounded corners off. */
export function shapeRoundedCornersEnabled(roundedCorners: boolean | undefined): boolean {
  return roundedCorners !== false
}

/** Persist on new shapes; omit when rounded (default). */
export function roundedCornersFieldForCommit(prefEnabled: boolean): { roundedCorners?: false } {
  return prefEnabled ? {} : { roundedCorners: false }
}

/** Corner radius in px for box shapes (rect, triangle). */
export function shapeCornerRadiusPx(w: number, h: number): number {
  const minDim = Math.min(Math.abs(w), Math.abs(h))
  if (minDim <= 0) return 0
  return Math.max(2, Math.min(minDim * 0.07, 14))
}

function clampRadius(r: number, w: number, h: number): number {
  return Math.min(Math.max(0, r), Math.abs(w) / 2, Math.abs(h) / 2)
}

export function appendRoundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = clampRadius(radius, w, h)
  ctx.beginPath()
  if (r <= 0 || w <= 0 || h <= 0) {
    ctx.rect(x, y, w, h)
    return
  }
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  const x2 = x + w
  const y2 = y + h
  ctx.moveTo(x + r, y)
  ctx.lineTo(x2 - r, y)
  ctx.arcTo(x2, y, x2, y + r, r)
  ctx.lineTo(x2, y2 - r)
  ctx.arcTo(x2, y2, x2 - r, y2, r)
  ctx.lineTo(x + r, y2)
  ctx.arcTo(x, y2, x, y2 - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function unit(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy)
  if (len < 1e-8) return [0, 0]
  return [dx / len, dy / len]
}

export function appendRoundedTrianglePath(
  ctx: CanvasRenderingContext2D,
  topX: number,
  topY: number,
  blX: number,
  blY: number,
  brX: number,
  brY: number,
  radius: number,
): void {
  const points: [number, number][] = [
    [topX, topY],
    [blX, blY],
    [brX, brY],
  ]
  if (radius <= 0) {
    ctx.beginPath()
    ctx.moveTo(topX, topY)
    ctx.lineTo(blX, blY)
    ctx.lineTo(brX, brY)
    ctx.closePath()
    return
  }

  ctx.beginPath()
  const n = points.length
  for (let i = 0; i < n; i++) {
    const prev = points[(i + n - 1) % n]!
    const cur = points[i]!
    const next = points[(i + 1) % n]!
    const [u1x, u1y] = unit(cur[0] - prev[0], cur[1] - prev[1])
    const [u2x, u2y] = unit(next[0] - cur[0], next[1] - cur[1])
    const len1 = Math.hypot(cur[0] - prev[0], cur[1] - prev[1])
    const len2 = Math.hypot(next[0] - cur[0], next[1] - cur[1])
    const r = Math.min(radius, len1 / 2, len2 / 2)
    const p1: [number, number] = [cur[0] - u1x * r, cur[1] - u1y * r]
    const p2: [number, number] = [cur[0] + u2x * r, cur[1] + u2y * r]
    if (i === 0) ctx.moveTo(p1[0], p1[1])
    else ctx.lineTo(p1[0], p1[1])
    ctx.quadraticCurveTo(cur[0], cur[1], p2[0], p2[1])
  }
  ctx.closePath()
}
