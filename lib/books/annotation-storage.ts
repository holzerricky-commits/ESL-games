import {
  DEFAULT_STAMP_QUESTION_COLOR,
  migrateTextFillColor,
  stampColorForVariant,
} from '@/lib/books/annotation-palettes'
import type {
  AnnotationCommand,
  AnnotationLineDashStyle,
  ArrowAnnotationCommand,
  CalloutAnnotationCommand,
  EllipseAnnotationCommand,
  LineAnnotationCommand,
  RectAnnotationCommand,
  StampAnnotationCommand,
  StampVariant,
  StickyAnnotationCommand,
  TriangleAnnotationCommand,
  StrokeAnnotationCommand,
  StrokeTool,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'
import { isAnnotationTextFontId } from '@/lib/books/annotation-text-fonts'
import { isPenInkStyle, PEN_INK_TILE_PX, type PenInkStyle } from '@/lib/books/pen-ink'
import { normalizeDeg } from '@/lib/books/annotation-rotation'
import { isPenStrokeProfile, type PenStrokeProfile } from '@/lib/books/pen-stroke-profile'

export type BookAnnotationTool = 'pen' | 'marker' | 'eraser' | 'eraser-line'

/** Toolbar / pointer mode (strokes + rich tools). Laser is never persisted. */
export type BookAnnotationInteractionMode =
  | BookAnnotationTool
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'arrow'
  | 'stamp'
  | 'sticker'
  | 'text'
  | 'sticky'
  | 'callout'
  | 'select'
  | 'eyedropper'

/** Seven thickness steps (multiplier on marker / eraser / stamp base widths). */
export const ANNOTATION_STROKE_WIDTH_STEPS = [0.5, 0.66, 0.8, 1, 1.2, 1.42, 1.68] as const

/** Shared base line width for pen ink and shape outlines (CSS px). Keep in sync with `PEN_LINE_WIDTH`. */
export const ANNOTATION_FINE_INK_LINE_BASE_PX = 2.5

/** Must match `MARKER_LINE_WIDTH` in annotation-draw. */
const MARKER_LINE_BASE_PX = 22
/** Must match `ERASER_LINE_WIDTH` in annotation-draw. */
const ERASER_LINE_BASE_PX = 18

const FINE_INK_STROKE_MIN = 0.4
const FINE_INK_STROKE_MAX = 4
const FINE_INK_STROKE_RATIO = (FINE_INK_STROKE_MAX / FINE_INK_STROKE_MIN) ** (1 / 6)

/**
 * Pen + shapes share one multiplier table on {@link ANNOTATION_FINE_INK_LINE_BASE_PX}.
 * Geometric steps ~1–10 px line width (perceptually even).
 */
export const ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS = [
  FINE_INK_STROKE_MIN,
  FINE_INK_STROKE_MIN * FINE_INK_STROKE_RATIO ** 1,
  FINE_INK_STROKE_MIN * FINE_INK_STROKE_RATIO ** 2,
  FINE_INK_STROKE_MIN * FINE_INK_STROKE_RATIO ** 3,
  FINE_INK_STROKE_MIN * FINE_INK_STROKE_RATIO ** 4,
  FINE_INK_STROKE_MIN * FINE_INK_STROKE_RATIO ** 5,
  FINE_INK_STROKE_MAX,
] as const

/** @deprecated Use {@link ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS}. */
export const ANNOTATION_PEN_STROKE_WIDTH_STEPS = ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS

export function fineInkLineWidthPx(widthScale: number): number {
  return ANNOTATION_FINE_INK_LINE_BASE_PX * widthScale
}

function buildFineInkPreviewDots(profileWidthScale = 1): readonly number[] {
  return ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS.map(
    (m) => fineInkLineWidthPx(m * profileWidthScale),
  )
}

/** Preview dot diameter (px) = on-canvas line width for pen / shapes. */
export const ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS = buildFineInkPreviewDots()

/** @deprecated Use {@link ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS}. */
export const ANNOTATION_PEN_THICKNESS_PREVIEW_DOTS = ANNOTATION_FINE_INK_THICKNESS_PREVIEW_DOTS

export function buildFineInkThicknessPreviewDots(profileWidthScale = 1): readonly number[] {
  return buildFineInkPreviewDots(profileWidthScale)
}

/** Preview dots for highlighter thickness (= `MARKER_LINE_WIDTH` × step). */
export const ANNOTATION_MARKER_THICKNESS_PREVIEW_DOTS = ANNOTATION_STROKE_WIDTH_STEPS.map(
  (m) => MARKER_LINE_BASE_PX * m,
) as readonly number[]

/** Preview dots for eraser thickness (= `ERASER_LINE_WIDTH` × step). */
export const ANNOTATION_ERASER_THICKNESS_PREVIEW_DOTS = ANNOTATION_STROKE_WIDTH_STEPS.map(
  (m) => ERASER_LINE_BASE_PX * m,
) as readonly number[]

export type AnnotationStrokeThicknessStep = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** @deprecated use ANNOTATION_STROKE_WIDTH_STEPS */
export const ANNOTATION_STROKE_WIDTH_SCALES = ANNOTATION_STROKE_WIDTH_STEPS
/** @deprecated use AnnotationStrokeThicknessStep */
export type AnnotationStrokeWidthPreset = AnnotationStrokeThicknessStep

export const ANNOTATION_STORAGE_KEY_V1 = 'esl_book_annotations_v1'
export const ANNOTATION_STORAGE_KEY_V2 = 'esl_book_annotations_v2'
/** Set after a successful V1→V2 migrate so an empty v2 is not treated as a failed migrate. */
export const ANNOTATION_STORAGE_V2_MIGRATED_FLAG = 'esl_book_annotations_v2_migrated'

/** Minimal storage surface for V1→V2 migration (browser localStorage or test double). */
export type AnnotationStorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

const ANNOTATION_TEXT_MAX_CHARS = 4000

/** studentId → bookId → unitId → pageKey → commands */
export type BookAnnotationsRoot = Record<
  string,
  Record<string, Record<string, Record<string, AnnotationCommand[]>>>
>

/** `pdf` uses numeric string keys; `whiteboard` uses `wb:{n}` so ink stays separate from PDF markup. */
export type AnnotationStorageChannel = 'pdf' | 'whiteboard'

export function annotationStoragePageKey(pageNumber: number, channel: AnnotationStorageChannel = 'pdf'): string {
  const n = Math.max(1, Math.floor(pageNumber))
  return channel === 'whiteboard' ? `wb:${n}` : String(n)
}

function newAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`
}

function isFinitePair(p: unknown): p is [number, number] {
  if (!Array.isArray(p) || p.length !== 2) return false
  const a = p[0]
  const b = p[1]
  return typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)
}

function isHexColor(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s)
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function sanitizeNormRect(raw: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const nums = ['x', 'y', 'w', 'h'] as const
  const box: Record<string, number> = {}
  for (const k of nums) {
    const v = rec[k]
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    box[k] = clamp01(v)
  }
  if (box.w! <= 0 || box.h! <= 0) return null
  return { x: box.x!, y: box.y!, w: box.w!, h: box.h! }
}

function sanitizeRotationDeg(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  return normalizeDeg(raw)
}

function sanitizePoints(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw)) return null
  const points: [number, number][] = []
  for (const p of raw) {
    if (!isFinitePair(p)) continue
    points.push([clamp01(p[0]), clamp01(p[1])])
  }
  return points.length >= 2 ? points : null
}

function parseStampVariant(v: unknown): StampVariant | null {
  if (
    v === 'check' ||
    v === 'cross' ||
    v === 'question' ||
    v === 'star' ||
    v === 'heart' ||
    v === 'thumbsUp' ||
    v === 'repeat' ||
    v === 'yourTurn' ||
    v === 'newWord'
  ) {
    return v
  }
  return null
}

function parseWritableStickerVariant(v: unknown): import('@/lib/books/annotation-command-types').WritableStickerVariant | null {
  if (v === 'note' || v === 'speech' || v === 'thought' || v === 'caption') return v
  return null
}

function parseStrokeTool(v: unknown): StrokeTool | null {
  if (v === 'pen' || v === 'marker' || v === 'eraser' || v === 'eraser-line') return v
  return null
}

function ensureId(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0 && raw.length <= 128) return raw
  return newAnnotationId()
}

/** Strict validation + clamps; drops invalid entries. */
export function sanitizeAnnotationCommands(raw: unknown): AnnotationCommand[] {
  if (!Array.isArray(raw)) return []
  const out: AnnotationCommand[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const kind = rec.kind
    const id = ensureId(rec.id)

    if (kind === 'stroke') {
      const tool = parseStrokeTool(rec.tool)
      if (!tool) continue
      const points = sanitizePoints(rec.points)
      if (!points) continue
      let widthScale: number | undefined
      if (typeof rec.widthScale === 'number' && Number.isFinite(rec.widthScale)) {
        widthScale = Math.max(0.2, Math.min(10, rec.widthScale))
      }
      const rawColor = rec.color
      const color =
        typeof rawColor === 'string' && isHexColor(rawColor) && (tool === 'pen' || tool === 'marker')
          ? rawColor
          : undefined
      let lineDashStyle: AnnotationLineDashStyle | undefined
      if (rec.lineDashStyle === 'solid' || rec.lineDashStyle === 'dashed' || rec.lineDashStyle === 'dotted') {
        lineDashStyle = rec.lineDashStyle
      }
      let penInkStyle: PenInkStyle | undefined
      if (tool === 'pen' && isPenInkStyle(rec.penInkStyle) && rec.penInkStyle !== 'solid') {
        penInkStyle = rec.penInkStyle
      }
      let penStrokeProfile: PenStrokeProfile | undefined
      if (tool === 'pen' && isPenStrokeProfile(rec.penStrokeProfile)) {
        penStrokeProfile = rec.penStrokeProfile
      }
      let penInkPatternPhaseX: number | undefined
      let penInkPatternPhaseY: number | undefined
      if (penInkStyle) {
        if (typeof rec.penInkPatternPhaseX === 'number' && Number.isFinite(rec.penInkPatternPhaseX)) {
          penInkPatternPhaseX =
            ((rec.penInkPatternPhaseX % PEN_INK_TILE_PX) + PEN_INK_TILE_PX) % PEN_INK_TILE_PX
        }
        if (typeof rec.penInkPatternPhaseY === 'number' && Number.isFinite(rec.penInkPatternPhaseY)) {
          penInkPatternPhaseY =
            ((rec.penInkPatternPhaseY % PEN_INK_TILE_PX) + PEN_INK_TILE_PX) % PEN_INK_TILE_PX
        }
      }
      let figureGroupId: string | undefined
      if (
        (tool === 'pen' || tool === 'marker') &&
        typeof rec.figureGroupId === 'string' &&
        rec.figureGroupId.length > 0 &&
        rec.figureGroupId.length <= 64
      ) {
        figureGroupId = rec.figureGroupId
      }
      const markerDecoratedEdge =
        tool === 'marker' && rec.markerDecoratedEdge === true ? true : undefined
      const rotationBounds =
        tool === 'pen' || tool === 'marker' ? sanitizeNormRect(rec.rotationBounds) : null
      const rotationDeg =
        tool === 'pen' || tool === 'marker' ? sanitizeRotationDeg(rec.rotationDeg) : undefined
      const cmd: StrokeAnnotationCommand = {
        kind: 'stroke',
        id,
        tool,
        points,
        ...(widthScale != null ? { widthScale } : {}),
        ...(color ? { color } : {}),
        ...(penInkStyle ? { penInkStyle } : {}),
        ...(penStrokeProfile ? { penStrokeProfile } : {}),
        ...(penInkPatternPhaseX != null ? { penInkPatternPhaseX } : {}),
        ...(penInkPatternPhaseY != null ? { penInkPatternPhaseY } : {}),
        ...(lineDashStyle ? { lineDashStyle } : {}),
        ...(markerDecoratedEdge ? { markerDecoratedEdge } : {}),
        ...(figureGroupId ? { figureGroupId } : {}),
        ...(rotationBounds ? { rotationBounds } : {}),
        ...(rotationDeg != null && (rotationDeg !== 0 || rotationBounds)
          ? { rotationDeg }
          : {}),
      }
      out.push(cmd)
      continue
    }

    if (kind === 'line') {
      if (!isFinitePair(rec.a) || !isFinitePair(rec.b)) continue
      const c = rec.color
      if (typeof c !== 'string' || !isHexColor(c)) continue
      let widthScale: number | undefined
      if (typeof rec.widthScale === 'number' && Number.isFinite(rec.widthScale)) {
        widthScale = Math.max(0.2, Math.min(10, rec.widthScale))
      }
      let lineDash: AnnotationLineDashStyle | undefined
      if (rec.lineDashStyle === 'solid' || rec.lineDashStyle === 'dashed' || rec.lineDashStyle === 'dotted') {
        lineDash = rec.lineDashStyle
      }
      out.push({
        kind: 'line',
        id,
        a: [clamp01(rec.a[0]), clamp01(rec.a[1])],
        b: [clamp01(rec.b[0]), clamp01(rec.b[1])],
        color: c,
        ...(widthScale != null ? { widthScale } : {}),
        ...(lineDash ? { lineDashStyle: lineDash } : {}),
      } satisfies LineAnnotationCommand)
      continue
    }

    if (kind === 'rect' || kind === 'ellipse' || kind === 'triangle') {
      const nums = ['x', 'y', 'w', 'h'] as const
      const box: Record<string, number> = {}
      let ok = true
      for (const k of nums) {
        const v = rec[k]
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          ok = false
          break
        }
        box[k] = clamp01(v)
      }
      if (!ok) continue
      const sc = rec.strokeColor
      if (typeof sc !== 'string' || !isHexColor(sc)) continue
      let strokeWidthScale: number | undefined
      if (typeof rec.strokeWidthScale === 'number' && Number.isFinite(rec.strokeWidthScale)) {
        strokeWidthScale = Math.max(0.2, Math.min(10, rec.strokeWidthScale))
      }
      let fillAlpha: number | undefined
      if (typeof rec.fillAlpha === 'number' && Number.isFinite(rec.fillAlpha)) {
        fillAlpha = Math.max(0, Math.min(1, rec.fillAlpha))
      }
      const fc = rec.fillColor
      const fillColor = typeof fc === 'string' && isHexColor(fc) ? fc : undefined
      const legacyFill = !!(fillColor && fillAlpha != null && fillAlpha > 0)
      const strokeVisible = rec.strokeVisible !== false
      const canFill = rec.fillVisible === false ? false : legacyFill
      if (!strokeVisible && !canFill) continue
      let lineDash: AnnotationLineDashStyle | undefined
      if (rec.lineDashStyle === 'solid' || rec.lineDashStyle === 'dashed' || rec.lineDashStyle === 'dotted') {
        lineDash = rec.lineDashStyle
      }
      const roundedCorners = rec.roundedCorners === false ? false : undefined
      const rotationDeg = sanitizeRotationDeg(rec.rotationDeg)
      const base = {
        id,
        x: box.x,
        y: box.y,
        w: Math.max(0, box.w),
        h: Math.max(0, box.h),
        strokeColor: sc,
        ...(strokeVisible === false ? { strokeVisible: false as const } : {}),
        ...(rec.fillVisible === false ? { fillVisible: false as const } : {}),
        ...(strokeWidthScale != null ? { strokeWidthScale } : {}),
        ...(fillColor ? { fillColor } : {}),
        ...(fillAlpha != null ? { fillAlpha } : {}),
        ...(lineDash ? { lineDashStyle: lineDash } : {}),
        ...(roundedCorners === false ? { roundedCorners: false as const } : {}),
        ...(rotationDeg != null && rotationDeg !== 0 ? { rotationDeg } : {}),
      }
      if (kind === 'rect') {
        out.push({ kind: 'rect', ...base } satisfies RectAnnotationCommand)
      } else if (kind === 'ellipse') {
        out.push({ kind: 'ellipse', ...base } satisfies EllipseAnnotationCommand)
      } else {
        out.push({ kind: 'triangle', ...base } satisfies TriangleAnnotationCommand)
      }
      continue
    }

    if (kind === 'arrow') {
      if (!isFinitePair(rec.from) || !isFinitePair(rec.to)) continue
      const c = rec.color
      if (typeof c !== 'string' || !isHexColor(c)) continue
      let widthScale: number | undefined
      if (typeof rec.widthScale === 'number' && Number.isFinite(rec.widthScale)) {
        widthScale = Math.max(0.2, Math.min(10, rec.widthScale))
      }
      let headLengthNorm: number | undefined
      if (typeof rec.headLengthNorm === 'number' && Number.isFinite(rec.headLengthNorm)) {
        headLengthNorm = Math.max(0.005, Math.min(0.2, rec.headLengthNorm))
      }
      let lineDash: AnnotationLineDashStyle | undefined
      if (rec.lineDashStyle === 'solid' || rec.lineDashStyle === 'dashed' || rec.lineDashStyle === 'dotted') {
        lineDash = rec.lineDashStyle
      }
      out.push({
        kind: 'arrow',
        id,
        from: [clamp01(rec.from[0]), clamp01(rec.from[1])],
        to: [clamp01(rec.to[0]), clamp01(rec.to[1])],
        color: c,
        ...(widthScale != null ? { widthScale } : {}),
        ...(headLengthNorm != null ? { headLengthNorm } : {}),
        ...(lineDash ? { lineDashStyle: lineDash } : {}),
      } satisfies ArrowAnnotationCommand)
      continue
    }

    if (kind === 'stamp') {
      const variant = parseStampVariant(rec.variant)
      if (!variant || !isFinitePair(rec.center)) continue
      const rawColor = rec.color
      const questionFallback =
        typeof rawColor === 'string' && isHexColor(rawColor) ? rawColor : DEFAULT_STAMP_QUESTION_COLOR
      const color = stampColorForVariant(variant, questionFallback)
      let scale: number | undefined
      if (typeof rec.scale === 'number' && Number.isFinite(rec.scale)) {
        scale = Math.max(0.2, Math.min(8, rec.scale))
      }
      out.push({
        kind: 'stamp',
        id,
        variant,
        center: [clamp01(rec.center[0]), clamp01(rec.center[1])],
        color,
        ...(scale != null ? { scale } : {}),
      } satisfies StampAnnotationCommand)
      continue
    }

    if (kind === 'callout') {
      const idx = rec.index
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 1 || idx > 999) continue
      const col = rec.color
      if (typeof col !== 'string' || !isHexColor(col)) continue
      if (!isFinitePair(rec.center)) continue
      let scale: number | undefined
      if (typeof rec.scale === 'number' && Number.isFinite(rec.scale)) {
        scale = Math.max(0.2, Math.min(8, rec.scale))
      }
      out.push({
        kind: 'callout',
        id,
        index: idx,
        center: [clamp01(rec.center[0]), clamp01(rec.center[1])],
        color: col,
        ...(scale != null ? { scale } : {}),
      } satisfies CalloutAnnotationCommand)
      continue
    }

    if (kind === 'text') {
      const tx = rec.text
      if (typeof tx !== 'string') continue
      const text = tx.slice(0, ANNOTATION_TEXT_MAX_CHARS)
      const col = rec.color
      if (typeof col !== 'string' || !isHexColor(col)) continue
      if (typeof rec.x !== 'number' || typeof rec.y !== 'number' || !Number.isFinite(rec.x) || !Number.isFinite(rec.y))
        continue
      let fontSizeNorm: number = 0.028
      if (typeof rec.fontSizeNorm === 'number' && Number.isFinite(rec.fontSizeNorm)) {
        fontSizeNorm = Math.max(0.008, Math.min(0.12, rec.fontSizeNorm))
      }
      let maxWidthNorm: number | undefined
      if (typeof rec.maxWidthNorm === 'number' && Number.isFinite(rec.maxWidthNorm)) {
        maxWidthNorm = Math.max(0.05, Math.min(1, rec.maxWidthNorm))
      }
      let visualStyle: 'plain' | 'filled' | undefined
      if (rec.visualStyle === 'filled' || rec.visualStyle === 'plain') {
        visualStyle = rec.visualStyle
      }
      let fillColor: string | undefined
      if (typeof rec.fillColor === 'string' && isHexColor(rec.fillColor)) {
        fillColor = migrateTextFillColor(rec.fillColor)
      }
      let yAnchor: TextAnnotationCommand['yAnchor']
      if (rec.yAnchor === 'center' || rec.yAnchor === 'top') {
        yAnchor = rec.yAnchor
      }
      let fontId: TextAnnotationCommand['fontId']
      if (isAnnotationTextFontId(rec.fontId)) fontId = rec.fontId
      out.push({
        kind: 'text',
        id,
        x: clamp01(rec.x),
        y: clamp01(rec.y),
        text,
        fontSizeNorm,
        color: col,
        ...(maxWidthNorm != null ? { maxWidthNorm } : {}),
        ...(visualStyle != null ? { visualStyle } : {}),
        ...(fillColor != null ? { fillColor } : {}),
        ...(yAnchor != null ? { yAnchor } : {}),
        ...(fontId != null ? { fontId } : {}),
      } satisfies TextAnnotationCommand)
      continue
    }

    if (kind === 'sticky') {
      const tx = rec.text
      if (typeof tx !== 'string') continue
      const text = tx.slice(0, ANNOTATION_TEXT_MAX_CHARS)
      const nums = ['x', 'y', 'w', 'h'] as const
      const box: Record<string, number> = {}
      let ok = true
      for (const k of nums) {
        const v = rec[k]
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          ok = false
          break
        }
        box[k] = clamp01(v)
      }
      if (!ok) continue
      let fontSizeNorm: number = 0.024
      if (typeof rec.fontSizeNorm === 'number' && Number.isFinite(rec.fontSizeNorm)) {
        fontSizeNorm = Math.max(0.008, Math.min(0.1, rec.fontSizeNorm))
      }
      let fillColor: string | undefined
      if (typeof rec.fillColor === 'string' && isHexColor(rec.fillColor)) {
        fillColor = rec.fillColor
      }
      let stickyFontId: StickyAnnotationCommand['fontId']
      if (isAnnotationTextFontId(rec.fontId)) stickyFontId = rec.fontId
      out.push({
        kind: 'sticky',
        id,
        x: box.x,
        y: box.y,
        w: Math.max(0.02, box.w),
        h: Math.max(0.02, box.h),
        text,
        fontSizeNorm,
        ...(fillColor != null ? { fillColor } : {}),
        ...(stickyFontId != null ? { fontId: stickyFontId } : {}),
        ...(parseWritableStickerVariant(rec.writableVariant)
          ? { writableVariant: parseWritableStickerVariant(rec.writableVariant)! }
          : {}),
      } satisfies StickyAnnotationCommand)
      continue
    }
  }

  return out
}

/** Legacy v1 row: flat stroke without `kind`. */
function migrateLegacyStrokeRow(item: Record<string, unknown>): StrokeAnnotationCommand | null {
  const tool = parseStrokeTool(item.tool)
  if (!tool) return null
  const points = sanitizePoints(item.points)
  if (!points) return null
  let widthScale: number | undefined
  if (typeof item.widthScale === 'number' && Number.isFinite(item.widthScale)) {
    widthScale = Math.max(0.2, Math.min(10, item.widthScale))
  }
  const rawColor = item.color
  const color =
    typeof rawColor === 'string' && isHexColor(rawColor) && (tool === 'pen' || tool === 'marker')
      ? rawColor
      : undefined
  return {
    kind: 'stroke',
    id: newAnnotationId(),
    tool,
    points,
    ...(widthScale != null ? { widthScale } : {}),
    ...(color ? { color } : {}),
  }
}

function migratePageArrayV1(raw: unknown): AnnotationCommand[] {
  if (!Array.isArray(raw)) return []
  const out: AnnotationCommand[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (typeof rec.kind === 'string') {
      const one = sanitizeAnnotationCommands([rec])
      out.push(...one)
      continue
    }
    const stroke = migrateLegacyStrokeRow(rec)
    if (stroke) out.push(stroke)
  }
  return sanitizeAnnotationCommands(out)
}

function deepMigrateV1RootToV2(v1: unknown): BookAnnotationsRoot {
  const out: BookAnnotationsRoot = {}
  if (!v1 || typeof v1 !== 'object') return out
  for (const [sid, books] of Object.entries(v1 as Record<string, unknown>)) {
    if (!books || typeof books !== 'object') continue
    const bookOut: Record<string, Record<string, Record<string, AnnotationCommand[]>>> = {}
    for (const [bid, units] of Object.entries(books as Record<string, unknown>)) {
      if (!units || typeof units !== 'object') continue
      const unitOut: Record<string, Record<string, AnnotationCommand[]>> = {}
      for (const [uid, pages] of Object.entries(units as Record<string, unknown>)) {
        if (!pages || typeof pages !== 'object') continue
        const pageOut: Record<string, AnnotationCommand[]> = {}
        for (const [pageKey, arr] of Object.entries(pages as Record<string, unknown>)) {
          pageOut[pageKey] = migratePageArrayV1(arr)
        }
        if (Object.keys(pageOut).length) unitOut[uid] = pageOut
      }
      if (Object.keys(unitOut).length) bookOut[bid] = unitOut
    }
    if (Object.keys(bookOut).length) out[sid] = bookOut
  }
  return out
}

/**
 * Migrate legacy `esl_book_annotations_v1` into v2.
 *
 * Critical: never write an empty v2 marker on failure — that permanently orphans
 * still-valid v1 data (v2 presence short-circuits future retries). Also free v1
 * only after v2 is written successfully so a quota failure cannot wipe ink.
 */
export function migrateAnnotationsStorageV1ToV2(storage: AnnotationStorageLike): void {
  const migratedFlag = storage.getItem(ANNOTATION_STORAGE_V2_MIGRATED_FLAG) === '1'
  const v2existing = storage.getItem(ANNOTATION_STORAGE_KEY_V2)
  if (v2existing != null) {
    const v1stillPresent = storage.getItem(ANNOTATION_STORAGE_KEY_V1)
    let v2Empty = false
    let v2Corrupt = false
    try {
      const parsed = JSON.parse(v2existing) as unknown
      v2Empty = !!parsed && typeof parsed === 'object' && Object.keys(parsed as object).length === 0
    } catch {
      v2Corrupt = true
    }

    // Older builds wrote `{}` on migrate failure while leaving v1 intact — remove the poison
    // marker and fall through so v1 can be migrated again (only when we never recorded success).
    if (v1stillPresent && !migratedFlag && (v2Empty || v2Corrupt)) {
      try {
        storage.removeItem(ANNOTATION_STORAGE_KEY_V2)
      } catch {
        return
      }
    } else {
      // Successful migrate left v1 behind — free the duplicate copy.
      if (v1stillPresent && !v2Corrupt) {
        try {
          storage.removeItem(ANNOTATION_STORAGE_KEY_V1)
        } catch {
          /* ignore */
        }
      }
      if (!migratedFlag) {
        try {
          storage.setItem(ANNOTATION_STORAGE_V2_MIGRATED_FLAG, '1')
        } catch {
          /* ignore */
        }
      }
      return
    }
  }

  const v1raw = storage.getItem(ANNOTATION_STORAGE_KEY_V1)
  if (!v1raw) {
    try {
      storage.setItem(ANNOTATION_STORAGE_KEY_V2, '{}')
    } catch {
      /* quota — leave unset so a later load can retry */
      return
    }
    try {
      storage.setItem(ANNOTATION_STORAGE_V2_MIGRATED_FLAG, '1')
    } catch {
      /* ignore */
    }
    return
  }

  let v2json: string
  try {
    const parsed = JSON.parse(v1raw) as unknown
    const v2 = deepMigrateV1RootToV2(parsed)
    v2json = JSON.stringify(v2)
  } catch {
    // Corrupt v1: do not poison v2 with {}. Keep v1 for manual recovery.
    return
  }

  // Free v1 first so nearly-full localStorage can accept v2, then restore v1 if v2 write fails.
  storage.removeItem(ANNOTATION_STORAGE_KEY_V1)
  try {
    storage.setItem(ANNOTATION_STORAGE_KEY_V2, v2json)
  } catch {
    try {
      storage.setItem(ANNOTATION_STORAGE_KEY_V1, v1raw)
    } catch {
      /* last resort: both writes failed; caller still has in-memory session */
    }
    // Leave v2 unset so the next read retries migration.
    return
  }
  try {
    storage.setItem(ANNOTATION_STORAGE_V2_MIGRATED_FLAG, '1')
  } catch {
    /* v2 is durable; flag can be filled in on a later load */
  }
}

function migrateV1StorageToV2Once(): void {
  if (typeof window === 'undefined') return
  migrateAnnotationsStorageV1ToV2(window.localStorage)
}

export function readAnnotationsRoot(): BookAnnotationsRoot {
  if (typeof window === 'undefined') return {}
  migrateV1StorageToV2Once()
  try {
    const raw = localStorage.getItem(ANNOTATION_STORAGE_KEY_V2)
    if (!raw) {
      // Migration may have restored v1 after a failed v2 write — surface v1 so ink still loads.
      const v1raw = localStorage.getItem(ANNOTATION_STORAGE_KEY_V1)
      if (!v1raw) return {}
      try {
        return deepMigrateV1RootToV2(JSON.parse(v1raw) as unknown)
      } catch {
        return {}
      }
    }
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as BookAnnotationsRoot
  } catch {
    return {}
  }
}

export function writeAnnotationsRoot(map: BookAnnotationsRoot): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ANNOTATION_STORAGE_KEY_V2, JSON.stringify(map))
  } catch {
    // Quota or private mode — ignore
  }
}

/** Remove all persisted book annotations for one student (e.g. when deleting the student). */
export function removeAnnotationsForStudent(studentId: string): void {
  const root = readAnnotationsRoot()
  if (!(studentId in root)) return
  const next: BookAnnotationsRoot = { ...root }
  delete next[studentId]
  writeAnnotationsRoot(next)
}

export function getAnnotationsForStorageKey(
  studentId: string,
  bookId: string,
  unitId: string,
  storagePageKey: string,
): AnnotationCommand[] {
  const root = readAnnotationsRoot()
  const raw = root[studentId]?.[bookId]?.[unitId]?.[storagePageKey]
  return sanitizeAnnotationCommands(raw)
}

export function setAnnotationsForStorageKey(
  studentId: string,
  bookId: string,
  unitId: string,
  storagePageKey: string,
  commands: AnnotationCommand[],
): void {
  const root: BookAnnotationsRoot = { ...readAnnotationsRoot() }
  const pageKey = storagePageKey
  const clean = sanitizeAnnotationCommands(commands)

  const student = { ...(root[studentId] ?? {}) }
  const book = { ...(student[bookId] ?? {}) }
  const unit = { ...(book[unitId] ?? {}) }

  if (clean.length === 0) {
    delete unit[pageKey]
  } else {
    unit[pageKey] = clean
  }

  if (Object.keys(unit).length === 0) {
    delete book[unitId]
  } else {
    book[unitId] = unit
  }

  if (Object.keys(book).length === 0) {
    delete student[bookId]
  } else {
    student[bookId] = book
  }

  if (Object.keys(student).length === 0) {
    delete root[studentId]
  } else {
    root[studentId] = student
  }

  writeAnnotationsRoot(root)
}

export function getAnnotationsForPage(
  studentId: string,
  bookId: string,
  unitId: string,
  pageNumber: number,
  channel: AnnotationStorageChannel = 'pdf',
): AnnotationCommand[] {
  const pageKey = annotationStoragePageKey(pageNumber, channel)
  return getAnnotationsForStorageKey(studentId, bookId, unitId, pageKey)
}

export function setAnnotationsForPage(
  studentId: string,
  bookId: string,
  unitId: string,
  pageNumber: number,
  commands: AnnotationCommand[],
  channel: AnnotationStorageChannel = 'pdf',
): void {
  const pageKey = annotationStoragePageKey(pageNumber, channel)
  setAnnotationsForStorageKey(studentId, bookId, unitId, pageKey, commands)
}
