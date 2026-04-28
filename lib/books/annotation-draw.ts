import type { AnnotationCommand, StrokeAnnotationCommand } from '@/lib/books/annotation-command-types'

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

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  cmd: Pick<StrokeAnnotationCommand, 'tool' | 'points' | 'widthScale' | 'color'>,
  widthPx: number,
  heightPx: number,
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
    ctx.strokeStyle = cmd.color ?? DEFAULT_PEN_COLOR
    ctx.lineWidth = PEN_LINE_WIDTH * scale
  }

  ctx.beginPath()
  ctx.moveTo(sx(points[0][0]), sy(points[0][1]))
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(sx(points[i][0]), sy(points[i][1]))
  }
  ctx.stroke()

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

export function drawEraserLinePreview(
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
  ctx.globalAlpha = 0.75
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.95)'
  ctx.lineWidth = 3
  ctx.setLineDash([6, 4])
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(sx(points[0][0]), sy(points[0][1]))
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(sx(points[i][0]), sy(points[i][1]))
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
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
): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(30,20,10,0.88)'
  ctx.fillStyle = 'rgba(30,20,10,0.88)'
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
    ctx.font = `bold ${r * 1.05}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', cx, cy + r * 0.06)
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
): void {
  switch (cmd.kind) {
    case 'stroke': {
      if (cmd.tool !== 'eraser-line') {
        drawStrokePath(ctx, cmd, widthPx, heightPx)
      }
      break
    }
    case 'line': {
      const { ax, ay, bx, by } = normLineToPx(cmd.a, cmd.b, widthPx, heightPx)
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.strokeStyle = cmd.color
      ctx.lineWidth = strokeWidthPx(cmd.widthScale, DEFAULT_SHAPE_STROKE_PX)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
      ctx.restore()
      break
    }
    case 'rect': {
      const x = cmd.x * widthPx
      const y = cmd.y * heightPx
      const w = cmd.w * widthPx
      const h = cmd.h * heightPx
      ctx.save()
      if (cmd.fillColor != null && cmd.fillAlpha != null && cmd.fillAlpha > 0) {
        const a = cmd.fillAlpha
        const hex = cmd.fillColor
        const rr = parseInt(hex.slice(1, 3), 16)
        const gg = parseInt(hex.slice(3, 5), 16)
        const bb = parseInt(hex.slice(5, 7), 16)
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${a})`
        ctx.fillRect(x, y, w, h)
      }
      ctx.strokeStyle = cmd.strokeColor
      ctx.lineWidth = strokeWidthPx(cmd.strokeWidthScale, DEFAULT_SHAPE_STROKE_PX)
      ctx.strokeRect(x, y, w, h)
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
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      if (cmd.fillColor != null && cmd.fillAlpha != null && cmd.fillAlpha > 0) {
        const a = cmd.fillAlpha
        const hex = cmd.fillColor
        const rr = parseInt(hex.slice(1, 3), 16)
        const gg = parseInt(hex.slice(3, 5), 16)
        const bb = parseInt(hex.slice(5, 7), 16)
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${a})`
        ctx.fill()
      }
      ctx.strokeStyle = cmd.strokeColor
      ctx.lineWidth = strokeWidthPx(cmd.strokeWidthScale, DEFAULT_SHAPE_STROKE_PX)
      ctx.stroke()
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

      ctx.save()
      ctx.strokeStyle = cmd.color
      ctx.fillStyle = cmd.color
      ctx.lineWidth = strokeWidthPx(cmd.widthScale, DEFAULT_SHAPE_STROKE_PX)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bxShaft, byShaft)
      ctx.stroke()
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
      drawStampSymbol(ctx, cmd.variant, cx, cy, r)
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
