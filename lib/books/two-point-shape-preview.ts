import type { AnnotationLineDashStyle, ShapeFillMode } from '@/lib/books/annotation-command-types'
import { shapeFillAlphaForMode } from '@/lib/books/annotation-command-types'
import { applyAnnotationLineDash, PEN_LINE_WIDTH } from '@/lib/books/annotation-draw'
import {
  appendRoundRectPath,
  appendRoundedTrianglePath,
  shapeCornerRadiusPx,
} from '@/lib/books/shape-rounded-corners'

export type TwoPointShapeDraftKind = 'line' | 'rect' | 'ellipse' | 'triangle' | 'arrow'

export type TwoPointShapeDraft = {
  kind: TwoPointShapeDraftKind
  anchor: [number, number]
  current: [number, number]
}

export type TwoPointShapePreviewOptions = {
  shapeColor: string
  shapeStrokeWidthScale: number
  shapeLineDashStyle: AnnotationLineDashStyle
  shapeStrokeEnabled: boolean
  shapeFillMode: ShapeFillMode
  shapeFillColor: string
  /** Default true. */
  shapeRoundedCorners?: boolean
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function normalizeRect(a: [number, number], b: [number, number]) {
  const x0 = clamp01(Math.min(a[0], b[0]))
  const y0 = clamp01(Math.min(a[1], b[1]))
  const x1 = clamp01(Math.max(a[0], b[0]))
  const y1 = clamp01(Math.max(a[1], b[1]))
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

function shapeFillRgba(hex: string, mode: ShapeFillMode): string | null {
  const alpha = shapeFillAlphaForMode(mode)
  if (alpha == null) return null
  const rr = parseInt(hex.slice(1, 3), 16)
  const gg = parseInt(hex.slice(3, 5), 16)
  const bb = parseInt(hex.slice(5, 7), 16)
  return `rgba(${rr},${gg},${bb},${alpha})`
}

/** Live two-point shape preview in normalized spread/page coordinates. */
export function drawTwoPointShapePreview(
  ctx: CanvasRenderingContext2D,
  draft: TwoPointShapeDraft,
  widthPx: number,
  heightPx: number,
  opts: TwoPointShapePreviewOptions,
): void {
  const {
    shapeColor,
    shapeStrokeWidthScale,
    shapeLineDashStyle,
    shapeStrokeEnabled,
    shapeFillMode,
    shapeFillColor,
    shapeRoundedCorners = true,
  } = opts
  const rounded = shapeRoundedCorners !== false
  const fillPaint = shapeFillRgba(shapeFillColor, shapeFillMode)
  const sx = (nx: number) => nx * widthPx
  const sy = (ny: number) => ny * heightPx
  const { x, y, w, h } = normalizeRect(draft.anchor, draft.current)
  const ax = sx(draft.anchor[0])
  const ay = sy(draft.anchor[1])
  const bx = sx(draft.current[0])
  const by = sy(draft.current[1])
  const lw = Math.max(1, PEN_LINE_WIDTH * (shapeStrokeWidthScale || 1))
  ctx.save()
  ctx.globalAlpha = 0.88
  ctx.lineCap = 'round'
  if (draft.kind === 'line' || draft.kind === 'arrow') {
    ctx.strokeStyle = shapeColor
    ctx.lineWidth = lw
    applyAnnotationLineDash(ctx, shapeLineDashStyle, lw)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.setLineDash([])
    if (draft.kind === 'arrow') {
      const dx = bx - ax
      const dy = by - ay
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const headLen = 0.035 * Math.min(widthPx, heightPx)
      const hw = headLen * 0.45
      const bxShaft = bx - ux * headLen
      const byShaft = by - uy * headLen
      const px = -uy
      const py = ux
      ctx.fillStyle = shapeColor
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(bxShaft + px * hw, byShaft + py * hw)
      ctx.lineTo(bxShaft - px * hw, byShaft - py * hw)
      ctx.closePath()
      ctx.fill()
    }
  } else if (draft.kind === 'rect') {
    const rx = sx(x)
    const ry = sy(y)
    const rw = w * widthPx
    const rh = h * heightPx
    const cornerR = rounded ? shapeCornerRadiusPx(rw, rh) : 0
    const drawRectPath = () => {
      if (rounded) appendRoundRectPath(ctx, rx, ry, rw, rh, cornerR)
      else {
        ctx.beginPath()
        ctx.rect(rx, ry, rw, rh)
      }
    }
    if (fillPaint) {
      drawRectPath()
      ctx.fillStyle = fillPaint
      ctx.fill()
    }
    if (shapeStrokeEnabled) {
      drawRectPath()
      ctx.strokeStyle = shapeColor
      ctx.lineWidth = lw
      ctx.lineCap = rounded ? 'round' : 'butt'
      ctx.lineJoin = rounded ? 'round' : 'miter'
      applyAnnotationLineDash(ctx, shapeLineDashStyle, lw)
      ctx.stroke()
      ctx.setLineDash([])
    }
  } else if (draft.kind === 'triangle') {
    const rx = sx(x)
    const ry = sy(y)
    const rw = w * widthPx
    const rh = h * heightPx
    const topX = rx + rw / 2
    const topY = ry
    const blX = rx
    const blY = ry + rh
    const brX = rx + rw
    const brY = ry + rh
    const cornerR = rounded ? shapeCornerRadiusPx(rw, rh) : 0
    const drawTriPath = () => {
      if (rounded) appendRoundedTrianglePath(ctx, topX, topY, blX, blY, brX, brY, cornerR)
      else {
        ctx.beginPath()
        ctx.moveTo(topX, topY)
        ctx.lineTo(blX, blY)
        ctx.lineTo(brX, brY)
        ctx.closePath()
      }
    }
    if (fillPaint) {
      drawTriPath()
      ctx.fillStyle = fillPaint
      ctx.fill()
    }
    if (shapeStrokeEnabled) {
      drawTriPath()
      ctx.strokeStyle = shapeColor
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      applyAnnotationLineDash(ctx, shapeLineDashStyle, lw)
      ctx.stroke()
      ctx.setLineDash([])
    }
  } else {
    const cx = sx(x) + (w * widthPx) / 2
    const cy = sy(y) + (h * heightPx) / 2
    const rx = (w * widthPx) / 2
    const ry = (h * heightPx) / 2
    if (rx > 0 && ry > 0) {
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
      if (fillPaint) {
        ctx.fillStyle = fillPaint
        ctx.fill()
      }
      if (shapeStrokeEnabled) {
        ctx.beginPath()
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
        ctx.strokeStyle = shapeColor
        ctx.lineWidth = lw
        applyAnnotationLineDash(ctx, shapeLineDashStyle, lw)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }
  ctx.restore()
}
