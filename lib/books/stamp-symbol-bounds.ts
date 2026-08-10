import type { StampAnnotationCommand } from '@/lib/books/annotation-command-types'

/** Matches `drawAnnotationCommand` stamp radius: `scale * min(pageW, pageH) * factor`. */
export const STAMP_DRAW_RADIUS_FACTOR = 0.06

export type NormRect = { x: number; y: number; w: number; h: number }

function stampStrokeHalfWidthPx(rPx: number): number {
  return Math.max(1.5, rPx * 0.14) / 2
}

/** Tight axis-aligned bounds for a stamp symbol in normalized page space. */
export function stampSymbolBoundsNorm(
  cmd: Pick<StampAnnotationCommand, 'center' | 'scale' | 'variant'>,
  widthPx: number,
  heightPx: number,
): NormRect {
  const scale = cmd.scale ?? 1
  const base = Math.min(widthPx, heightPx)
  const rPx = scale * base * STAMP_DRAW_RADIUS_FACTOR
  const hw = stampStrokeHalfWidthPx(rPx)

  const cxPx = cmd.center[0] * widthPx
  const cyPx = cmd.center[1] * heightPx

  let minX = cxPx
  let maxX = cxPx
  let minY = cyPx
  let maxY = cyPx

  switch (cmd.variant) {
    case 'check': {
      minX = cxPx - rPx * 0.45 - hw
      maxX = cxPx + rPx * 0.48 + hw
      minY = cyPx - rPx * 0.38 - hw
      maxY = cyPx + rPx * 0.42 + hw
      break
    }
    case 'cross': {
      const d = rPx * 0.42 + hw
      minX = cxPx - d
      maxX = cxPx + d
      minY = cyPx - d
      maxY = cyPx + d
      break
    }
    case 'question': {
      const fontPx = rPx * 1.15
      const halfW = fontPx * 0.28 + hw
      const halfH = fontPx * 0.52 + hw
      const cyText = cyPx + rPx * 0.05
      minX = cxPx - halfW
      maxX = cxPx + halfW
      minY = cyText - halfH
      maxY = cyText + halfH
      break
    }
    case 'heart': {
      const s = rPx * 0.42
      minX = cxPx - s * 1.1 - hw
      maxX = cxPx + s * 1.1 + hw
      minY = cyPx - s * 0.55 - hw
      maxY = cyPx + s * 0.95 + hw
      break
    }
    case 'star':
    default: {
      const outer = rPx * 0.48 + hw
      minX = cxPx - outer
      maxX = cxPx + outer
      minY = cyPx - outer
      maxY = cyPx + outer
      break
    }
  }

  return {
    x: minX / widthPx,
    y: minY / heightPx,
    w: (maxX - minX) / widthPx,
    h: (maxY - minY) / heightPx,
  }
}

/** Circular eraser hit radius in min-dimension normalized space. */
export function stampEraserHitRadiusNorm(scale: number): number {
  return scale * STAMP_DRAW_RADIUS_FACTOR
}
