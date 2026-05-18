import type {
  AnnotationLineDashStyle,
  ShapeFillMode,
  StampVariant,
  TextAnnotationVisualStyle,
} from '@/lib/books/annotation-command-types'
import {
  type AnnotationColorSource,
  isAnnotationColorSource,
  isValidCustomHex,
  normalizeCustomHex,
} from '@/lib/books/annotation-custom-color'
import {
  ANNOTATION_MARKER_SWATCHES,
  ANNOTATION_PEN_SWATCHES,
  ANNOTATION_TEXT_FILL_SWATCHES,
  DEFAULT_PEN_SWATCH_ID,
  DEFAULT_STAMP_QUESTION_COLOR,
  DEFAULT_STICKY_FILL_COLOR,
  DEFAULT_TEXT_COLOR,
  getPenSwatch,
  isValidStickyFillColor,
  isValidTextStrokeColor,
} from '@/lib/books/annotation-palettes'
import type {
  AnnotationStrokeThicknessStep,
  BookAnnotationInteractionMode,
} from '@/lib/books/annotation-storage'
import {
  DEFAULT_EYEDROPPER_VARIANT,
  isEyedropperVariant,
  type EyedropperVariant,
} from '@/lib/books/eyedropper-variant'

const STORAGE_KEY = 'esl_student_annotation_tool_prefs_v1'

export type StudentAnnotationToolPrefs = {
  annotationMode?: BookAnnotationInteractionMode
  penSwatchId?: string
  penColorSource?: AnnotationColorSource
  penCustomHex?: string
  penThicknessStep?: AnnotationStrokeThicknessStep
  penLineDashStyle?: AnnotationLineDashStyle
  /** @deprecated Migrated to `textColor`. */
  textSwatchId?: string
  textColor?: string
  textVisualStyle?: TextAnnotationVisualStyle
  textFillColor?: string
  shapeStrokeSwatchId?: string
  shapeLineDashStyle?: AnnotationLineDashStyle
  shapeStrokeEnabled?: boolean
  shapeFillMode?: ShapeFillMode
  shapeFillColor?: string
  stickyFillColor?: string
  markerColor?: string
  markerColorSource?: AnnotationColorSource
  markerCustomHex?: string
  markerThicknessStep?: AnnotationStrokeThicknessStep
  markerLineDashStyle?: AnnotationLineDashStyle
  eraserPixelThicknessStep?: AnnotationStrokeThicknessStep
  eraserLineThicknessStep?: AnnotationStrokeThicknessStep
  stampVariant?: StampVariant
  stampQuestionColor?: string
  eyedropperVariant?: EyedropperVariant
}

const PEN_SWATCH_IDS = new Set(ANNOTATION_PEN_SWATCHES.map((s) => s.id))
const MARKER_COLORS = new Set(ANNOTATION_MARKER_SWATCHES.map((c) => c.toLowerCase()))
const TEXT_FILL_COLORS = new Set(ANNOTATION_TEXT_FILL_SWATCHES.map((c) => c.toLowerCase()))
const LINE_DASH: AnnotationLineDashStyle[] = ['solid', 'dashed', 'dotted']

const ANNOTATION_MODES: BookAnnotationInteractionMode[] = [
  'pen',
  'marker',
  'eraser',
  'eraser-line',
  'line',
  'rect',
  'ellipse',
  'triangle',
  'arrow',
  'stamp',
  'text',
  'sticky',
  'callout',
  'laser',
  'eyedropper',
]

const STAMP_VARIANTS: StampVariant[] = ['check', 'cross', 'question', 'star', 'heart']
const TEXT_VISUAL_STYLES: TextAnnotationVisualStyle[] = ['plain', 'filled']
const SHAPE_FILL_MODES: ShapeFillMode[] = ['none', 'transparent', 'solid']

function isThicknessStep(v: unknown): v is AnnotationStrokeThicknessStep {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6
}

function isLineDash(v: unknown): v is AnnotationLineDashStyle {
  return typeof v === 'string' && (LINE_DASH as readonly string[]).includes(v)
}

function isAnnotationMode(v: unknown): v is BookAnnotationInteractionMode {
  return typeof v === 'string' && (ANNOTATION_MODES as readonly string[]).includes(v)
}

function isStampVariant(v: unknown): v is StampVariant {
  return typeof v === 'string' && (STAMP_VARIANTS as readonly string[]).includes(v)
}

function isTextVisualStyle(v: unknown): v is TextAnnotationVisualStyle {
  return typeof v === 'string' && (TEXT_VISUAL_STYLES as readonly string[]).includes(v)
}

function isShapeFillMode(v: unknown): v is ShapeFillMode {
  return typeof v === 'string' && (SHAPE_FILL_MODES as readonly string[]).includes(v)
}

export function isValidPenSwatchId(id: unknown): id is string {
  return typeof id === 'string' && PEN_SWATCH_IDS.has(id)
}

export function isValidMarkerColor(color: unknown): color is string {
  return typeof color === 'string' && MARKER_COLORS.has(color.toLowerCase())
}

function isValidTextFillColor(color: unknown): color is string {
  return typeof color === 'string' && TEXT_FILL_COLORS.has(color.toLowerCase())
}

function isValidShapeFillColor(color: unknown): color is string {
  return isValidMarkerColor(color)
}

function isValidStampQuestionColor(color: unknown): color is string {
  return isValidTextStrokeColor(color)
}

export function normalizeStudentAnnotationToolPrefs(raw: unknown): StudentAnnotationToolPrefs {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: StudentAnnotationToolPrefs = {}
  if (isAnnotationMode(o.annotationMode)) out.annotationMode = o.annotationMode
  if (isValidPenSwatchId(o.penSwatchId)) out.penSwatchId = o.penSwatchId
  if (isAnnotationColorSource(o.penColorSource)) out.penColorSource = o.penColorSource
  if (isValidCustomHex(o.penCustomHex)) out.penCustomHex = normalizeCustomHex(o.penCustomHex)
  if (isThicknessStep(o.penThicknessStep)) out.penThicknessStep = o.penThicknessStep
  if (isLineDash(o.penLineDashStyle)) out.penLineDashStyle = o.penLineDashStyle
  if (isValidPenSwatchId(o.textSwatchId)) out.textSwatchId = o.textSwatchId
  if (isValidTextStrokeColor(o.textColor)) out.textColor = o.textColor
  if (isTextVisualStyle(o.textVisualStyle)) out.textVisualStyle = o.textVisualStyle
  if (isValidTextFillColor(o.textFillColor)) out.textFillColor = o.textFillColor
  if (isValidPenSwatchId(o.shapeStrokeSwatchId)) out.shapeStrokeSwatchId = o.shapeStrokeSwatchId
  if (isLineDash(o.shapeLineDashStyle)) out.shapeLineDashStyle = o.shapeLineDashStyle
  if (typeof o.shapeStrokeEnabled === 'boolean') out.shapeStrokeEnabled = o.shapeStrokeEnabled
  if (isShapeFillMode(o.shapeFillMode)) out.shapeFillMode = o.shapeFillMode
  if (isValidShapeFillColor(o.shapeFillColor)) out.shapeFillColor = o.shapeFillColor
  if (isValidStickyFillColor(o.stickyFillColor)) out.stickyFillColor = o.stickyFillColor
  if (isValidMarkerColor(o.markerColor)) out.markerColor = o.markerColor
  if (isAnnotationColorSource(o.markerColorSource)) out.markerColorSource = o.markerColorSource
  if (isValidCustomHex(o.markerCustomHex)) out.markerCustomHex = normalizeCustomHex(o.markerCustomHex)
  if (isThicknessStep(o.markerThicknessStep)) out.markerThicknessStep = o.markerThicknessStep
  if (isLineDash(o.markerLineDashStyle)) out.markerLineDashStyle = o.markerLineDashStyle
  if (isThicknessStep(o.eraserPixelThicknessStep)) out.eraserPixelThicknessStep = o.eraserPixelThicknessStep
  if (isThicknessStep(o.eraserLineThicknessStep)) out.eraserLineThicknessStep = o.eraserLineThicknessStep
  if (isStampVariant(o.stampVariant)) out.stampVariant = o.stampVariant
  if (isValidStampQuestionColor(o.stampQuestionColor)) out.stampQuestionColor = o.stampQuestionColor
  if (isEyedropperVariant(o.eyedropperVariant)) out.eyedropperVariant = o.eyedropperVariant
  return out
}

function localStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function readRoot(): Record<string, StudentAnnotationToolPrefs> {
  if (!localStorageAvailable()) return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const root = parsed as Record<string, unknown>
    const out: Record<string, StudentAnnotationToolPrefs> = {}
    for (const [studentId, value] of Object.entries(root)) {
      if (typeof studentId !== 'string' || !studentId) continue
      out[studentId] = normalizeStudentAnnotationToolPrefs(value)
    }
    return out
  } catch {
    return {}
  }
}

function writeRoot(root: Record<string, StudentAnnotationToolPrefs>): void {
  if (!localStorageAvailable()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root))
  } catch {
    /* quota / private mode */
  }
}

export function readStudentAnnotationToolPrefs(studentId: string): StudentAnnotationToolPrefs {
  if (!studentId) return {}
  return readRoot()[studentId] ?? {}
}

export function patchStudentAnnotationToolPrefs(
  studentId: string,
  patch: StudentAnnotationToolPrefs,
): void {
  if (!studentId) return
  const normalized = normalizeStudentAnnotationToolPrefs(patch)
  if (Object.keys(normalized).length === 0) return
  const root = readRoot()
  root[studentId] = { ...root[studentId], ...normalized }
  writeRoot(root)
}

export function removeStudentAnnotationToolPrefs(studentId: string): void {
  if (!studentId || !localStorageAvailable()) return
  const root = readRoot()
  if (!(studentId in root)) return
  delete root[studentId]
  writeRoot(root)
}

const DEFAULT_PEN_CUSTOM_HEX = getPenSwatch(DEFAULT_PEN_SWATCH_ID).color
const DEFAULT_MARKER_CUSTOM_HEX = ANNOTATION_MARKER_SWATCHES[0]
const DEFAULT_TEXT_FILL_COLOR = ANNOTATION_TEXT_FILL_SWATCHES[0]
const DEFAULT_SHAPE_FILL_COLOR = ANNOTATION_MARKER_SWATCHES[0]

/** Resolved pen defaults for toolbar hydration. */
export function resolvePenToolPrefsFromStorage(studentId: string): {
  penSwatchId: string
  penColorSource: AnnotationColorSource
  penCustomHex: string
  penThicknessStep: AnnotationStrokeThicknessStep
  penLineDashStyle: AnnotationLineDashStyle
} {
  const saved = readStudentAnnotationToolPrefs(studentId)
  const penSwatchId = isValidPenSwatchId(saved.penSwatchId) ? saved.penSwatchId! : DEFAULT_PEN_SWATCH_ID
  const penCustomHex = isValidCustomHex(saved.penCustomHex)
    ? normalizeCustomHex(saved.penCustomHex)
    : getPenSwatch(penSwatchId).color
  const penColorSource: AnnotationColorSource =
    saved.penColorSource === 'custom' && isValidCustomHex(saved.penCustomHex) ? 'custom' : 'swatch'
  return {
    penSwatchId,
    penColorSource,
    penCustomHex,
    penThicknessStep: isThicknessStep(saved.penThicknessStep) ? saved.penThicknessStep : 3,
    penLineDashStyle: isLineDash(saved.penLineDashStyle) ? saved.penLineDashStyle : 'solid',
  }
}

export function resolveMarkerToolPrefsFromStorage(studentId: string): {
  markerColor: string
  markerColorSource: AnnotationColorSource
  markerCustomHex: string
  markerThicknessStep: AnnotationStrokeThicknessStep
  markerLineDashStyle: AnnotationLineDashStyle
} {
  const saved = readStudentAnnotationToolPrefs(studentId)
  const paletteDefault = ANNOTATION_MARKER_SWATCHES[0]
  const markerCustomHex = isValidCustomHex(saved.markerCustomHex)
    ? normalizeCustomHex(saved.markerCustomHex)
    : paletteDefault
  const markerColorSource: AnnotationColorSource =
    saved.markerColorSource === 'custom' && isValidCustomHex(saved.markerCustomHex)
      ? 'custom'
      : 'swatch'
  const markerColor =
    markerColorSource === 'custom'
      ? markerCustomHex
      : isValidMarkerColor(saved.markerColor)
        ? saved.markerColor!
        : paletteDefault
  return {
    markerColor,
    markerColorSource,
    markerCustomHex,
    markerThicknessStep: isThicknessStep(saved.markerThicknessStep) ? saved.markerThicknessStep : 3,
    markerLineDashStyle: isLineDash(saved.markerLineDashStyle) ? saved.markerLineDashStyle : 'solid',
  }
}

export function resolveEraserToolPrefsFromStorage(studentId: string): {
  eraserPixelThicknessStep: AnnotationStrokeThicknessStep
  eraserLineThicknessStep: AnnotationStrokeThicknessStep
} {
  const saved = readStudentAnnotationToolPrefs(studentId)
  return {
    eraserPixelThicknessStep: isThicknessStep(saved.eraserPixelThicknessStep)
      ? saved.eraserPixelThicknessStep
      : 3,
    eraserLineThicknessStep: isThicknessStep(saved.eraserLineThicknessStep)
      ? saved.eraserLineThicknessStep
      : 3,
  }
}

export function resolveStampToolPrefsFromStorage(studentId: string): {
  stampVariant: StampVariant
  stampQuestionColor: string
} {
  const saved = readStudentAnnotationToolPrefs(studentId)
  return {
    stampVariant: isStampVariant(saved.stampVariant) ? saved.stampVariant : 'check',
    stampQuestionColor: isValidStampQuestionColor(saved.stampQuestionColor)
      ? saved.stampQuestionColor!
      : DEFAULT_STAMP_QUESTION_COLOR,
  }
}

export { DEFAULT_PEN_CUSTOM_HEX, DEFAULT_MARKER_CUSTOM_HEX }

/** Resolved text tool prefs; migrates from legacy swatch ids when needed. */
export function resolveTextToolPrefsFromStorage(studentId: string): {
  textColor: string
  textVisualStyle: TextAnnotationVisualStyle
  textFillColor: string
} {
  const saved = readStudentAnnotationToolPrefs(studentId)
  let textColor = DEFAULT_TEXT_COLOR
  if (isValidTextStrokeColor(saved.textColor)) {
    textColor = saved.textColor!
  } else if (isValidPenSwatchId(saved.textSwatchId)) {
    const hex = getPenSwatch(saved.textSwatchId).color
    if (isValidTextStrokeColor(hex)) textColor = hex
  } else if (isValidPenSwatchId(saved.penSwatchId)) {
    const hex = getPenSwatch(saved.penSwatchId).color
    if (isValidTextStrokeColor(hex)) textColor = hex
  }
  return {
    textColor,
    textVisualStyle: isTextVisualStyle(saved.textVisualStyle) ? saved.textVisualStyle : 'plain',
    textFillColor: isValidTextFillColor(saved.textFillColor)
      ? saved.textFillColor!
      : DEFAULT_TEXT_FILL_COLOR,
  }
}

export function resolveStickyToolPrefsFromStorage(studentId: string): { stickyFillColor: string } {
  const saved = readStudentAnnotationToolPrefs(studentId)
  return {
    stickyFillColor: isValidStickyFillColor(saved.stickyFillColor)
      ? saved.stickyFillColor!
      : DEFAULT_STICKY_FILL_COLOR,
  }
}

export function resolveShapeToolPrefsFromStorage(studentId: string): {
  shapeStrokeSwatchId: string
  shapeLineDashStyle: AnnotationLineDashStyle
  shapeStrokeEnabled: boolean
  shapeFillMode: ShapeFillMode
  shapeFillColor: string
} {
  const saved = readStudentAnnotationToolPrefs(studentId)
  const penFallback = isValidPenSwatchId(saved.penSwatchId) ? saved.penSwatchId! : DEFAULT_PEN_SWATCH_ID
  return {
    shapeStrokeSwatchId: isValidPenSwatchId(saved.shapeStrokeSwatchId)
      ? saved.shapeStrokeSwatchId!
      : penFallback,
    shapeLineDashStyle: isLineDash(saved.shapeLineDashStyle) ? saved.shapeLineDashStyle : 'solid',
    shapeStrokeEnabled:
      typeof saved.shapeStrokeEnabled === 'boolean' ? saved.shapeStrokeEnabled : true,
    shapeFillMode: isShapeFillMode(saved.shapeFillMode) ? saved.shapeFillMode : 'none',
    shapeFillColor: isValidShapeFillColor(saved.shapeFillColor)
      ? saved.shapeFillColor!
      : DEFAULT_SHAPE_FILL_COLOR,
  }
}

export function resolveAnnotationModeFromStorage(
  studentId: string,
): BookAnnotationInteractionMode {
  const saved = readStudentAnnotationToolPrefs(studentId)
  return isAnnotationMode(saved.annotationMode) ? saved.annotationMode : 'pen'
}

export function resolveEyedropperVariantFromStorage(studentId: string): EyedropperVariant {
  const saved = readStudentAnnotationToolPrefs(studentId)
  return isEyedropperVariant(saved.eyedropperVariant) ? saved.eyedropperVariant : DEFAULT_EYEDROPPER_VARIANT
}

/** All toolbar prefs for one student (hydrate controller from this). */
export function resolveAnnotationToolPrefsFromStorage(studentId: string) {
  return {
    annotationMode: resolveAnnotationModeFromStorage(studentId),
    eyedropperVariant: resolveEyedropperVariantFromStorage(studentId),
    ...resolvePenToolPrefsFromStorage(studentId),
    ...resolveMarkerToolPrefsFromStorage(studentId),
    ...resolveEraserToolPrefsFromStorage(studentId),
    ...resolveStampToolPrefsFromStorage(studentId),
    ...resolveTextToolPrefsFromStorage(studentId),
    ...resolveStickyToolPrefsFromStorage(studentId),
    ...resolveShapeToolPrefsFromStorage(studentId),
  }
}

export type ResolvedAnnotationToolPrefs = ReturnType<typeof resolveAnnotationToolPrefsFromStorage>

/** Build a normalized patch from live toolbar state (for persistence). */
export function buildStudentAnnotationToolPrefsPatch(
  state: ResolvedAnnotationToolPrefs,
): StudentAnnotationToolPrefs {
  return normalizeStudentAnnotationToolPrefs(state)
}

/**
 * Returns true when a save with `defaults` would overwrite meaningful stored prefs
 * (hydrate/save race regression guard).
 */
export function wouldDefaultPatchClobberStoredPrefs(
  studentId: string,
  defaults: StudentAnnotationToolPrefs,
): boolean {
  const stored = readStudentAnnotationToolPrefs(studentId)
  if (Object.keys(stored).length === 0) return false
  const normalizedDefaults = normalizeStudentAnnotationToolPrefs(defaults)
  for (const key of Object.keys(stored) as (keyof StudentAnnotationToolPrefs)[]) {
    const storedVal = stored[key]
    if (storedVal === undefined) continue
    const defaultVal = normalizedDefaults[key]
    if (defaultVal !== undefined && defaultVal !== storedVal) {
      return true
    }
  }
  return false
}
