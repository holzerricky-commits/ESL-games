import type { StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

/** Pen uses curved joins; marker stays polyline so wide bands do not self-fill like opaque ink. */
export function strokeToolUsesSmoothCurves(tool: StrokeAnnotationCommand['tool']): boolean {
  return tool === 'pen'
}

/**
 * Trace a polyline with round caps; pen uses midpoint quadratics when n ≥ 3.
 * Final segment curves into the last sample (less kink on lift than a bare lineTo).
 */
export function traceStrokePoints(
  ctx: CanvasRenderingContext2D,
  tool: StrokeAnnotationCommand['tool'],
  points: readonly [number, number][],
  sx: (nx: number) => number,
  sy: (ny: number) => number,
  drawCapDot?: (x: number, y: number) => void,
): void {
  const n = points.length
  if (n === 0) return

  if (n === 1) {
    if (tool !== 'marker' && drawCapDot) {
      drawCapDot(sx(points[0]![0]), sy(points[0]![1]))
    }
    return
  }

  ctx.beginPath()
  ctx.moveTo(sx(points[0]![0]), sy(points[0]![1]))

  if (strokeToolUsesSmoothCurves(tool) && n >= 3) {
    for (let i = 1; i < n - 1; i++) {
      const x = sx(points[i]![0])
      const y = sy(points[i]![1])
      const mx = (x + sx(points[i + 1]![0])) / 2
      const my = (y + sy(points[i + 1]![1])) / 2
      ctx.quadraticCurveTo(x, y, mx, my)
    }
    const lx = sx(points[n - 1]![0])
    const ly = sy(points[n - 1]![1])
    const px = sx(points[n - 2]![0])
    const py = sy(points[n - 2]![1])
    ctx.quadraticCurveTo(px, py, lx, ly)
  } else {
    for (let i = 1; i < n; i++) {
      ctx.lineTo(sx(points[i]![0]), sy(points[i]![1]))
    }
  }

  ctx.stroke()
}
