import type { AnnotationCommand, AnnotationLineDashStyle, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'
import { applyPenStrokeStyle, resolvePenInkPatternOrigin, type PenInkPatternOrigin } from '@/lib/books/pen-ink'

const PEN_LINE_WIDTH = 2.5
const DEFAULT_PEN_COLOR = '#2a1d12'
const MARKER_LINE_WIDTH = 22
const MARKER_ALPHA = 0.38
const DEFAULT_MARKER_COLOR = '#eab308'
const ERASER_LINE_WIDTH = 18

const DEFAULT_SHAPE_STROKE_PX = 2.25

function strokeWidthPx(cmdScale: number | undefined, base: number): number {
  const scale = cmdScale != null && Number.isFinite(cmdScale) ? cmdScale : 1
  return base * scale
}

/** Apply dash pattern for outline; call `ctx.setLineDash([])` after stroke to reset. */
export function applyAnnotationLineDash(
  ctx: CanvasRenderingContext2D,
  style: AnnotationLineDashStyle | undefined,
  lineWidthPx: number,
): void {
  const lw = Math.max(1, lineWidthPx)
  if (!style || style === 'solid') {
    ctx.setLineDash([])
    return
  }
  if (style === 'dashed') {
    ctx.setLineDash([lw * 3.5, lw * 2.2])
    return
  }
  ctx.setLineDash([lw * 0.15, lw * 2.1])
}

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  cmd: Pick<
    StrokeAnnotationCommand,
    | 'tool'
    | 'points'
    | 'widthScale'
    | 'color'
    | 'penInkStyle'
    | 'lineDashStyle'
    | 'penInkPatternPhaseX'
    | 'penInkPatternPhaseY'
  >,
  widthPx: number,
  heightPx: number,
  pagePatternOrigin?: PenInkPatternOrigin,
): void {
  const { tool, points } = cmd
  if (tool === 'eraser-line' || points.length < 2) return

  const scale = cmd.widthScale != null && Number.isFinite(cmd.widthScale) ? cmd.widthScale : 1

  const sx = (nx: number) => nx * widthPx
  const sy = (ny: number) => ny * heightPx

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#000'
    ctx.lineWidth = ERASER_LINE_WIDTH * scale
  } else if (tool === 'marker') {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = MARKER_ALPHA
    ctx.strokeStyle = cmd.color ?? DEFAULT_MARKER_COLOR
    ctx.lineWidth = MARKER_LINE_WIDTH * scale
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    applyPenStrokeStyle(
      ctx,
      cmd.penInkStyle,
      cmd.color ?? DEFAULT_PEN_COLOR,
      resolvePenInkPatternOrigin(pagePatternOrigin, cmd),
    )
    ctx.lineWidth = PEN_LINE_WIDTH * scale
  }

  const outlinePx =
    tool === 'marker' ? MARKER_LINE_WIDTH * scale : tool === 'pen' ? PEN_LINE_WIDTH * scale : ERASER_LINE_WIDTH * scale
  if (tool === 'pen' || tool === 'marker') {
    applyAnnotationLineDash(ctx, cmd.lineDashStyle, outlinePx)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  ctx.beginPath()
  if (tool === 'pen' && points.length >= 3) {
    ctx.moveTo(sx(points[0][0]), sy(points[0][1]))
    for (let i = 1; i < points.length - 1; i++) {
      const x = sx(points[i][0])
      const y = sy(points[i][1])
      const mx = (x + sx(points[i + 1][0])) / 2
      const my = (y + sy(points[i + 1][1])) / 2
      ctx.quadraticCurveTo(x, y, mx, my)
    }
    const last = points[points.length - 1]
    ctx.lineTo(sx(last[0]), sy(last[1]))
  } else {
    ctx.moveTo(sx(points[0][0]), sy(points[0][1]))
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(sx(points[i][0]), sy(points[i][1]))
    }
  }
  ctx.stroke()
  if (tool === 'pen' || tool === 'marker') {
    ctx.setLineDash([])
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

function normLineToPx(
  a: [number, number],
  b: [number, number],
  widthPx: number,
  heightPx: number,
): { ax: number; ay: number; bx: number; by: number } {
  return {
    ax: a[0] * widthPx,
    ay: a[1] * heightPx,
    bx: b[0] * widthPx,
    by: b[1] * heightPx,
  }
}

function drawStampSymbol(
  ctx: CanvasRenderingContext2D,
  variant: string,
  cx: number,
  cy: number,
  r: number,
  color: string,
): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1.5, r * 0.14)

  if (variant === 'check') {
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.45, cy)
    ctx.lineTo(cx - r * 0.05, cy + r * 0.42)
    ctx.lineTo(cx + r * 0.48, cy - r * 0.38)
    ctx.stroke()
  } else if (variant === 'cross') {
    const d = r * 0.42
    ctx.beginPath()
    ctx.moveTo(cx - d, cy - d)
    ctx.lineTo(cx + d, cy + d)
    ctx.moveTo(cx + d, cy - d)
    ctx.lineTo(cx - d, cy + d)
    ctx.stroke()
  } else if (variant === 'question') {
    ctx.font = `bold ${r * 1.15}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', cx, cy + r * 0.05)
  } else if (variant === 'heart') {
    const s = r * 0.42
    ctx.beginPath()
    ctx.moveTo(cx, cy + s * 0.95)
    ctx.bezierCurveTo(cx - s * 1.1, cy + s * 0.15, cx - s * 0.55, cy - s * 0.55, cx, cy - s * 0.15)
    ctx.bezierCurveTo(cx + s * 0.55, cy - s * 0.55, cx + s * 1.1, cy + s * 0.15, cx, cy + s * 0.95)
    ctx.closePath()
    ctx.fill()
  } else {
    const spikes = 5
    const outer = r * 0.48
    const inner = r * 0.2
    ctx.beginPath()
    for (let i = 0; i < spikes * 2; i++) {
      const rad = (i * Math.PI) / spikes - Math.PI / 2
      const rr = i % 2 === 0 ? outer : inner
      const x = cx + Math.cos(rad) * rr
      const y = cy + Math.sin(rad) * rr
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Draw one persisted annotation command. Skips `text` / `sticky` (DOM layer) and `eraser-line` (geometry-only).
 */
export function drawAnnotationCommand(
  ctx: CanvasRenderingContext2D,
  cmd: AnnotationCommand,
  widthPx: number,
  heightPx: number,
  pagePatternOrigin?: PenInkPatternOrigin,
): void {
  switch (cmd.kind) {
    case 'stroke': {
      if (cmd.tool !== 'eraser-line') {
        drawStrokePath(ctx, cmd, widthPx, heightPx, pagePatternOrigin)
      }
      break
    }
    case 'line': {
      const { ax, ay, bx, by } = normLineToPx(cmd.a, cmd.b, widthPx, heightPx)
      const lw = strokeWidthPx(cmd.widthScale, DEFAULT_SHAPE_STROKE_PX)
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.strokeStyle = cmd.color
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      applyAnnotationLineDash(ctx, cmd.lineDashStyle, lw)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
      break
    }
    case 'rect': {
      const x = cmd.x * widthPx
      const y = cmd.y * heightPx
      const w = cmd.w * widthPx
      const h = cmd.h * heightPx
      const lw = strokeWidthPx(cmd.strokeWidthScale, DEFAULT_SHAPE_STROKE_PX)
      const legacyFill = cmd.fillColor != null && cmd.fillAlpha != null && cmd.fillAlpha > 0
      const showFill = cmd.fillVisible === false ? false : legacyFill
      const showStroke = cmd.strokeVisible !== false
      ctx.save()
      if (showFill && cmd.fillColor != null && cmd.fillAlpha != null && cmd.fillAlpha > 0) {
        const a = cmd.fillAlpha
        const hex = cmd.fillColor
        const rr = parseInt(hex.slice(1, 3), 16)
        const gg = parseInt(hex.slice(3, 5), 16)
        const bb = parseInt(hex.slice(5, 7), 16)
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${a})`
        ctx.fillRect(x, y, w, h)
      }
      if (showStroke) {
        ctx.strokeStyle = cmd.strokeColor
        ctx.lineWidth = lw
        ctx.lineCap = 'butt'
        applyAnnotationLineDash(ctx, cmd.lineDashStyle, lw)
        ctx.strokeRect(x, y, w, h)
        ctx.setLineDash([])
      }
      ctx.restore()
      break
    }
    case 'ellipse': {
      const x = cmd.x * widthPx
      const y = cmd.y * heightPx
      const w = Math.max(1, cmd.w * widthPx)
      const h = Math.max(1, cmd.h * heightPx)
      const cx = x + w / 2
      const cy = y + h / 2
      const rx = w / 2
      const ry = h / 2
      const lw = strokeWidthPx(cmd.strokeWidthScale, DEFAULT_SHAPE_STROKE_PX)
      const legacyFill = cmd.fillColor != null && cmd.fillAlpha != null && cmd.fillAlpha > 0
      const showFill = cmd.fillVisible === false ? false : legacyFill
      const showStroke = cmd.strokeVisible !== false
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      if (showFill && cmd.fillColor != null && cmd.fillAlpha != null && cmd.fillAlpha > 0) {
        const a = cmd.fillAlpha
        const hex = cmd.fillColor
        const rr = parseInt(hex.slice(1, 3), 16)
        const gg = parseInt(hex.slice(3, 5), 16)
        const bb = parseInt(hex.slice(5, 7), 16)
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${a})`
        ctx.fill()
      }
      if (showStroke) {
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.strokeStyle = cmd.strokeColor
        ctx.lineWidth = lw
        ctx.lineCap = 'round'
        applyAnnotationLineDash(ctx, cmd.lineDashStyle, lw)
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.restore()
      break
    }
    case 'triangle': {
      const x = cmd.x * widthPx
      const y = cmd.y * heightPx
      const w = cmd.w * widthPx
      const h = cmd.h * heightPx
      const lw = strokeWidthPx(cmd.strokeWidthScale, DEFAULT_SHAPE_STROKE_PX)
      const legacyFill = cmd.fillColor != null && cmd.fillAlpha != null && cmd.fillAlpha > 0
      const showFill = cmd.fillVisible === false ? false : legacyFill
      const showStroke = cmd.strokeVisible !== false
      const topX = x + w / 2
      const topY = y
      const blX = x
      const blY = y + h
      const brX = x + w
      const brY = y + h
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(topX, topY)
      ctx.lineTo(blX, blY)
      ctx.lineTo(brX, brY)
      ctx.closePath()
      if (showFill && cmd.fillColor != null && cmd.fillAlpha != null && cmd.fillAlpha > 0) {
        const a = cmd.fillAlpha
        const hex = cmd.fillColor
        const rr = parseInt(hex.slice(1, 3), 16)
        const gg = parseInt(hex.slice(3, 5), 16)
        const bb = parseInt(hex.slice(5, 7), 16)
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${a})`
        ctx.fill()
      }
      if (showStroke) {
        ctx.beginPath()
        ctx.moveTo(topX, topY)
        ctx.lineTo(blX, blY)
        ctx.lineTo(brX, brY)
        ctx.closePath()
        ctx.strokeStyle = cmd.strokeColor
        ctx.lineWidth = lw
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        applyAnnotationLineDash(ctx, cmd.lineDashStyle, lw)
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.restore()
      break
    }
    case 'arrow': {
      const { ax, ay, bx, by } = normLineToPx(cmd.from, cmd.to, widthPx, heightPx)
      const dx = bx - ax
      const dy = by - ay
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const headLen = (cmd.headLengthNorm ?? 0.035) * Math.min(widthPx, heightPx)
      const hw = headLen * 0.45
      const bxShaft = bx - ux * headLen
      const byShaft = by - uy * headLen
      const px = -uy
      const py = ux
      const lw = strokeWidthPx(cmd.widthScale, DEFAULT_SHAPE_STROKE_PX)

      ctx.save()
      ctx.strokeStyle = cmd.color
      ctx.fillStyle = cmd.color
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      applyAnnotationLineDash(ctx, cmd.lineDashStyle, lw)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bxShaft, byShaft)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(bxShaft + px * hw, byShaft + py * hw)
      ctx.lineTo(bxShaft - px * hw, byShaft - py * hw)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      break
    }
    case 'stamp': {
      const cx = cmd.center[0] * widthPx
      const cy = cmd.center[1] * heightPx
      const base = Math.min(widthPx, heightPx)
      const r = (cmd.scale ?? 1) * base * 0.06
      drawStampSymbol(ctx, cmd.variant, cx, cy, r, cmd.color)
      break
    }
    case 'callout': {
      const cx = cmd.center[0] * widthPx
      const cy = cmd.center[1] * heightPx
      const base = Math.min(widthPx, heightPx)
      const r = (cmd.scale ?? 1) * base * 0.04
      ctx.save()
      ctx.fillStyle = cmd.color
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = Math.max(1, r * 0.08)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${r * 1.05}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(cmd.index), cx, cy + r * 0.02)
      ctx.restore()
      break
    }
    case 'text':
    case 'sticky':
      break
    default:
      break
  }
}

export function drawLaserTrail(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  widthPx: number,
  heightPx: number,
): void {
  if (points.length < 2) return
  const sx = (nx: number) => nx * widthPx
  const sy = (ny: number) => ny * heightPx
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 0.55
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(sx(points[0][0]), sy(points[0][1]))
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(sx(points[i][0]), sy(points[i][1]))
  }
  ctx.stroke()
  ctx.restore()
}
