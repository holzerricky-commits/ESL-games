import type {
  AnnotationCommand,
  ArrowAnnotationCommand,
  CalloutAnnotationCommand,
  EllipseAnnotationCommand,
  LineAnnotationCommand,
  RectAnnotationCommand,
  StampAnnotationCommand,
  StampVariant,
  StickyAnnotationCommand,
  StrokeAnnotationCommand,
  StrokeTool,
  TextAnnotationCommand,
} from '@/lib/books/annotation-command-types'

export type BookAnnotationTool = 'pen' | 'marker' | 'eraser' | 'eraser-line'

/** Toolbar / pointer mode (strokes + rich tools). Laser is never persisted. */
export type BookAnnotationInteractionMode =
  | BookAnnotationTool
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'stamp'
  | 'text'
  | 'sticky'
  | 'callout'
  | 'laser'

/** Seven thickness steps (multiplier on base marker / eraser widths). */
export const ANNOTATION_STROKE_WIDTH_STEPS = [0.5, 0.66, 0.8, 1, 1.2, 1.42, 1.68] as const

/** Pen level 1 — thin (unchanged). */
const ANNOTATION_PEN_STROKE_MIN = 0.32
/** Pen level 7 — very thick (unchanged). */
const ANNOTATION_PEN_STROKE_MAX = 6.8
/** Constant ratio between consecutive levels (geometric = perceptually even). */
const ANNOTATION_PEN_STROKE_RATIO = (ANNOTATION_PEN_STROKE_MAX / ANNOTATION_PEN_STROKE_MIN) ** (1 / 6)

/**
 * Pen-only multipliers on base line width (2.5 CSS px). Levels 1 and 7 fixed; 2–6 fill a geometric progression.
 */
export const ANNOTATION_PEN_STROKE_WIDTH_STEPS = [
  ANNOTATION_PEN_STROKE_MIN,
  ANNOTATION_PEN_STROKE_MIN * ANNOTATION_PEN_STROKE_RATIO ** 1,
  ANNOTATION_PEN_STROKE_MIN * ANNOTATION_PEN_STROKE_RATIO ** 2,
  ANNOTATION_PEN_STROKE_MIN * ANNOTATION_PEN_STROKE_RATIO ** 3,
  ANNOTATION_PEN_STROKE_MIN * ANNOTATION_PEN_STROKE_RATIO ** 4,
  ANNOTATION_PEN_STROKE_MIN * ANNOTATION_PEN_STROKE_RATIO ** 5,
  ANNOTATION_PEN_STROKE_MAX,
] as const

/** Popover preview dot diameters (px); same geometric law between 3 and 19 as pen multipliers. */
const ANNOTATION_PEN_PREVIEW_MIN = 3
const ANNOTATION_PEN_PREVIEW_MAX = 19
const ANNOTATION_PEN_PREVIEW_RATIO = (ANNOTATION_PEN_PREVIEW_MAX / ANNOTATION_PEN_PREVIEW_MIN) ** (1 / 6)

export const ANNOTATION_PEN_THICKNESS_PREVIEW_DOTS = [
  ANNOTATION_PEN_PREVIEW_MIN,
  ANNOTATION_PEN_PREVIEW_MIN * ANNOTATION_PEN_PREVIEW_RATIO ** 1,
  ANNOTATION_PEN_PREVIEW_MIN * ANNOTATION_PEN_PREVIEW_RATIO ** 2,
  ANNOTATION_PEN_PREVIEW_MIN * ANNOTATION_PEN_PREVIEW_RATIO ** 3,
  ANNOTATION_PEN_PREVIEW_MIN * ANNOTATION_PEN_PREVIEW_RATIO ** 4,
  ANNOTATION_PEN_PREVIEW_MIN * ANNOTATION_PEN_PREVIEW_RATIO ** 5,
  ANNOTATION_PEN_PREVIEW_MAX,
] as const

export type AnnotationStrokeThicknessStep = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** @deprecated use ANNOTATION_STROKE_WIDTH_STEPS */
export const ANNOTATION_STROKE_WIDTH_SCALES = ANNOTATION_STROKE_WIDTH_STEPS
/** @deprecated use AnnotationStrokeThicknessStep */
export type AnnotationStrokeWidthPreset = AnnotationStrokeThicknessStep

const ANNOTATION_STORAGE_KEY_V1 = 'esl_book_annotations_v1'
const ANNOTATION_STORAGE_KEY_V2 = 'esl_book_annotations_v2'

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
  if (v === 'check' || v === 'cross' || v === 'question' || v === 'star') return v
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
      const cmd: StrokeAnnotationCommand = {
        kind: 'stroke',
        id,
        tool,
        points,
        ...(widthScale != null ? { widthScale } : {}),
        ...(color ? { color } : {}),
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
      out.push({
        kind: 'line',
        id,
        a: [clamp01(rec.a[0]), clamp01(rec.a[1])],
        b: [clamp01(rec.b[0]), clamp01(rec.b[1])],
        color: c,
        ...(widthScale != null ? { widthScale } : {}),
      } satisfies LineAnnotationCommand)
      continue
    }

    if (kind === 'rect' || kind === 'ellipse') {
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
      const base = {
        id,
        x: box.x,
        y: box.y,
        w: Math.max(0, box.w),
        h: Math.max(0, box.h),
        strokeColor: sc,
        ...(strokeWidthScale != null ? { strokeWidthScale } : {}),
        ...(fillColor ? { fillColor } : {}),
        ...(fillAlpha != null ? { fillAlpha } : {}),
      }
      if (kind === 'rect') {
        out.push({ kind: 'rect', ...base } satisfies RectAnnotationCommand)
      } else {
        out.push({ kind: 'ellipse', ...base } satisfies EllipseAnnotationCommand)
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
      out.push({
        kind: 'arrow',
        id,
        from: [clamp01(rec.from[0]), clamp01(rec.from[1])],
        to: [clamp01(rec.to[0]), clamp01(rec.to[1])],
        color: c,
        ...(widthScale != null ? { widthScale } : {}),
        ...(headLengthNorm != null ? { headLengthNorm } : {}),
      } satisfies ArrowAnnotationCommand)
      continue
    }

    if (kind === 'stamp') {
      const variant = parseStampVariant(rec.variant)
      if (!variant || !isFinitePair(rec.center)) continue
      let scale: number | undefined
      if (typeof rec.scale === 'number' && Number.isFinite(rec.scale)) {
        scale = Math.max(0.2, Math.min(8, rec.scale))
      }
      out.push({
        kind: 'stamp',
        id,
        variant,
        center: [clamp01(rec.center[0]), clamp01(rec.center[1])],
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
      out.push({
        kind: 'text',
        id,
        x: clamp01(rec.x),
        y: clamp01(rec.y),
        text,
        fontSizeNorm,
        color: col,
        ...(maxWidthNorm != null ? { maxWidthNorm } : {}),
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
      out.push({
        kind: 'sticky',
        id,
        x: box.x,
        y: box.y,
        w: Math.max(0.02, box.w),
        h: Math.max(0.02, box.h),
        text,
        fontSizeNorm,
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

function migrateV1StorageToV2Once(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(ANNOTATION_STORAGE_KEY_V2) != null) return
    const v1raw = localStorage.getItem(ANNOTATION_STORAGE_KEY_V1)
    if (!v1raw) {
      localStorage.setItem(ANNOTATION_STORAGE_KEY_V2, '{}')
      return
    }
    const parsed = JSON.parse(v1raw) as unknown
    const v2 = deepMigrateV1RootToV2(parsed)
    localStorage.setItem(ANNOTATION_STORAGE_KEY_V2, JSON.stringify(v2))
  } catch {
    try {
      localStorage.setItem(ANNOTATION_STORAGE_KEY_V2, '{}')
    } catch {
      /* ignore */
    }
  }
}

export function readAnnotationsRoot(): BookAnnotationsRoot {
  if (typeof window === 'undefined') return {}
  migrateV1StorageToV2Once()
  try {
    const raw = localStorage.getItem(ANNOTATION_STORAGE_KEY_V2)
    if (!raw) return {}
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

export function getAnnotationsForPage(
  studentId: string,
  bookId: string,
  unitId: string,
  pageNumber: number,
  channel: AnnotationStorageChannel = 'pdf',
): AnnotationCommand[] {
  const root = readAnnotationsRoot()
  const pageKey = annotationStoragePageKey(pageNumber, channel)
  const raw = root[studentId]?.[bookId]?.[unitId]?.[pageKey]
  return sanitizeAnnotationCommands(raw)
}

export function setAnnotationsForPage(
  studentId: string,
  bookId: string,
  unitId: string,
  pageNumber: number,
  commands: AnnotationCommand[],
  channel: AnnotationStorageChannel = 'pdf',
): void {
  const root: BookAnnotationsRoot = { ...readAnnotationsRoot() }
  const pageKey = annotationStoragePageKey(pageNumber, channel)
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
