import type { StrokeTool } from '@/lib/books/annotation-command-types'
import {
  ERASER_LINE_WIDTH,
  MARKER_LINE_WIDTH,
  PEN_LINE_WIDTH,
} from '@/lib/books/annotation-draw'
import type { EyedropperVariant } from '@/lib/books/eyedropper-variant'
import type { BookAnnotationInteractionMode } from '@/lib/books/annotation-storage'
import { penProfileDrawStyle, type PenStrokeProfile } from '@/lib/books/pen-stroke-profile'
import { strokeToolForToolbarMode, strokeWidthScaleForStrokeTool } from '@/lib/books/annotation-stroke-utils'

const MIN_CURSOR_PX = 3
const MAX_CURSOR_PX = 96
/** Hairline dual-contrast outline around the true stroke disc. */
const PEN_BORDER_WHITE_PX = 1
const PEN_BORDER_BLACK_PX = 1

const cursorCache = new Map<string, string>()

/** Thin white outline on the ink edge (no gap between fill and ring). */
const INK_RING_STROKE_PX = 1

/** Pen cursor diameter matches canvas lineWidth; brush uses widest soft pass. */
export function penCursorWidthPx(
  penStrokeWidthScale: number,
  penStrokeProfile?: PenStrokeProfile,
): number {
  const base = PEN_LINE_WIDTH * penStrokeWidthScale
  const style = penProfileDrawStyle(penStrokeProfile)
  const maxFactor =
    style.softPasses?.reduce((m, p) => Math.max(m, p.widthFactor), 1) ?? 1
  return base * maxFactor
}

export type AnnotationToolCursorWidths = {
  strokeWidthScale: number
  eraserLineStrokeWidthScale: number
  penStrokeWidthScale: number
}

export function strokeWidthPxForTool(
  tool: StrokeTool,
  widths: AnnotationToolCursorWidths,
  penStrokeProfile?: PenStrokeProfile,
): number {
  const scale = strokeWidthScaleForStrokeTool(tool, widths)
  switch (tool) {
    case 'marker':
      return MARKER_LINE_WIDTH * scale
    case 'pen':
      return penCursorWidthPx(scale, penStrokeProfile)
    case 'eraser':
    case 'eraser-line':
      return ERASER_LINE_WIDTH * scale
    default:
      return MARKER_LINE_WIDTH * scale
  }
}

function clampCursorPx(px: number): number {
  return Math.max(MIN_CURSOR_PX, Math.min(MAX_CURSOR_PX, Math.round(px)))
}

function cursorCss(svg: string, hotX: number, hotY: number, fallback = 'crosshair'): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`
}

/** Vertical bar: height = marker stroke width, width = height / 3. */
function buildMarkerCursor(w: number, color: string): { svg: string; hotX: number; hotY: number } {
  const barH = clampCursorPx(w)
  const barW = Math.max(2, Math.round(barH / 3))
  const pad = 2
  const svgW = barW + pad * 2
  const svgH = barH + pad * 2
  const x = pad
  const y = pad
  const cornerRx = Math.max(1, Math.min(3, Math.round(barW * 0.35)))
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">` +
    `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="${cornerRx}" ry="${cornerRx}" fill="${color}" stroke="#ffffff" stroke-width="${INK_RING_STROKE_PX}"/>` +
    `</svg>`
  return { svg, hotX: Math.round(svgW / 2), hotY: Math.round(svgH / 2) }
}

/** Filled disc sized to stroke width; ink color fill + thin white stroke on the edge. */
function buildInkDotCursor(
  w: number,
  fill: string,
): { svg: string; hotX: number; hotY: number } {
  const d = clampCursorPx(w)
  const r = d / 2
  const pad = Math.ceil(INK_RING_STROKE_PX / 2) + 1
  const svgW = d + pad * 2
  const svgH = d + pad * 2
  const cx = svgW / 2
  const cy = svgH / 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#ffffff" stroke-width="${INK_RING_STROKE_PX}"/>` +
    `</svg>`
  return { svg, hotX: Math.round(cx), hotY: Math.round(cy) }
}

/** Filled disc at true stroke size, with a thin white + black edge so it stays findable. */
function buildPenCursor(w: number, color: string): { svg: string; hotX: number; hotY: number } {
  const d = clampCursorPx(w)
  const r = d / 2
  const pad = PEN_BORDER_WHITE_PX + PEN_BORDER_BLACK_PX + 1
  const svgW = d + pad * 2
  const svgH = svgW
  const cx = svgW / 2
  const cy = svgH / 2
  const blackR = r + PEN_BORDER_BLACK_PX / 2
  const whiteR = r + PEN_BORDER_BLACK_PX + PEN_BORDER_WHITE_PX / 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">` +
    `<circle cx="${cx}" cy="${cy}" r="${whiteR}" fill="none" stroke="#ffffff" stroke-width="${PEN_BORDER_WHITE_PX}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${blackR}" fill="none" stroke="#000000" stroke-width="${PEN_BORDER_BLACK_PX}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>` +
    `</svg>`
  return { svg, hotX: Math.round(cx), hotY: Math.round(cy) }
}

function buildRubberEraserCursor(w: number): { svg: string; hotX: number; hotY: number } {
  return buildInkDotCursor(w, '#f1f5f9')
}

/** Stroke eraser: tilted block eraser icon (school-style). */
function buildSchoolEraserCursor(): { svg: string; hotX: number; hotY: number } {
  const svgW = 24
  const svgH = 24
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 24 24">` +
    `<g transform="rotate(-32 12 12)">` +
    `<rect x="4.5" y="8.5" width="15" height="7.5" rx="1.25" fill="#fbcfe8" stroke="#ffffff" stroke-width="1.75"/>` +
    `<rect x="4.5" y="8.5" width="5.5" height="7.5" fill="#f9a8d4" opacity="0.85"/>` +
    `<rect x="15.5" y="8.5" width="4" height="7.5" fill="#334155" opacity="0.35"/>` +
    `</g></svg>`
  return { svg, hotX: 12, hotY: 14 }
}

const EYEDROPPER_SAMPLE_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<path d="M20.7 5.6 18.4 3.3a1 1 0 0 0-1.4 0l-3.1 3.1-1.9-1.9-1.5 1.4 1.5 1.5-9 9V21h4.6l9-9 1.5 1.5 1.4-1.5-1.9-1.9 3.1-3.1a1 1 0 0 0 0-1.4ZM6.9 19 5 17.1 13.1 9l1.9 1.9L6.9 19Z" fill="none" stroke="white" stroke-width="3.25" stroke-linejoin="round" stroke-linecap="round"/>` +
  `<path d="M20.7 5.6 18.4 3.3a1 1 0 0 0-1.4 0l-3.1 3.1-1.9-1.9-1.5 1.4 1.5 1.5-9 9V21h4.6l9-9 1.5 1.5 1.4-1.5-1.9-1.9 3.1-3.1a1 1 0 0 0 0-1.4ZM6.9 19 5 17.1 13.1 9l1.9 1.9L6.9 19Z" fill="black"/>` +
  `</svg>`

/** Smart ink: standard pipette plus sparkle at the tip. */
const EYEDROPPER_SMART_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<path d="M20.7 5.6 18.4 3.3a1 1 0 0 0-1.4 0l-3.1 3.1-1.9-1.9-1.5 1.4 1.5 1.5-9 9V21h4.6l9-9 1.5 1.5 1.4-1.5-1.9-1.9 3.1-3.1a1 1 0 0 0 0-1.4ZM6.9 19 5 17.1 13.1 9l1.9 1.9L6.9 19Z" fill="none" stroke="white" stroke-width="3.25" stroke-linejoin="round" stroke-linecap="round"/>` +
  `<path d="M20.7 5.6 18.4 3.3a1 1 0 0 0-1.4 0l-3.1 3.1-1.9-1.9-1.5 1.4 1.5 1.5-9 9V21h4.6l9-9 1.5 1.5 1.4-1.5-1.9-1.9 3.1-3.1a1 1 0 0 0 0-1.4ZM6.9 19 5 17.1 13.1 9l1.9 1.9L6.9 19Z" fill="#0f172a"/>` +
  `<path d="M4.2 4.8 5.6 3.4l1.1 1.1-1.4 1.4-1.1-1.1Z" fill="#fbbf24" stroke="white" stroke-width="0.6"/>` +
  `<path d="M7.2 2.2l1.3 1.3M8.8 1.2l.7 1.9" stroke="#38bdf8" stroke-width="1.1" stroke-linecap="round"/>` +
  `</svg>`

export function resolveEyedropperCursor(variant: EyedropperVariant): string {
  const key = `v5:eyedropper:${variant}`
  const hit = cursorCache.get(key)
  if (hit) return hit
  const svg = variant === 'smart' ? EYEDROPPER_SMART_SVG : EYEDROPPER_SAMPLE_SVG
  const css = cursorCss(svg, 4, 20)
  cursorCache.set(key, css)
  return css
}

export function buildAnnotationToolCursor(params: {
  tool: StrokeTool
  widthPx: number
  color?: string
}): string {
  if (params.tool === 'eraser-line') {
    const key = 'v5:eraser-line:school'
    const hit = cursorCache.get(key)
    if (hit) return hit
    const built = buildSchoolEraserCursor()
    const css = cursorCss(built.svg, built.hotX, built.hotY)
    cursorCache.set(key, css)
    return css
  }

  const w = clampCursorPx(params.widthPx)
  const color = params.color ?? '#171717'
  const cacheKey = `v5:${params.tool}:${w}:${color}`
  const hit = cursorCache.get(cacheKey)
  if (hit) return hit

  let built: { svg: string; hotX: number; hotY: number }
  if (params.tool === 'marker') {
    built = buildMarkerCursor(w, color)
  } else if (params.tool === 'pen') {
    built = buildPenCursor(w, color)
  } else {
    built = buildRubberEraserCursor(w)
  }

  const css = cursorCss(built.svg, built.hotX, built.hotY)
  cursorCache.set(cacheKey, css)
  return css
}

/** Cursor for the active toolbar mode. */
export function resolveAnnotationToolCursor(
  mode: BookAnnotationInteractionMode,
  widths: AnnotationToolCursorWidths,
  options?: {
    color?: string
    penStrokeProfile?: PenStrokeProfile
    eyedropperVariant?: EyedropperVariant
  },
): string | undefined {
  if (mode === 'select') return undefined
  if (mode === 'text') return 'text'
  if (mode === 'eyedropper') {
    return resolveEyedropperCursor(options?.eyedropperVariant ?? 'sample')
  }
  const tool = strokeToolForToolbarMode(mode)
  if (!tool) return undefined
  const widthPx = strokeWidthPxForTool(tool, widths, options?.penStrokeProfile)
  return buildAnnotationToolCursor({
    tool,
    widthPx,
    color: options?.color,
  })
}
