import type { TextAnnotationCommand } from '@/lib/books/annotation-command-types'
import {
  annotationTextCssWeight,
  annotationTextFontFamily,
  getAnnotationTextFont,
  type AnnotationTextFontId,
  type AnnotationTextFontWeight,
} from '@/lib/books/annotation-text-fonts'
import {
  resolveTextLabelFieldLayout,
  textLabelNeedsPageMaxWidth,
  filledPillStackHeightPx,
  filledPillRowMinPx,
} from '@/lib/books/filled-text-layout'
import {
  textLabelStackHeightPx,
} from '@/lib/books/text-label-field-layout'
import {
  FILLED_EDIT_CHROME_INSET_PX,
  FILLED_TEXT_MEASURE_PAD_PX,
  PLAIN_TEXT_MEASURE_PAD_PX,
  textLabelBBoxLeft,
  textLabelLineHeightPx,
  textLabelBlockHeightNorm,
} from '@/lib/books/text-label-layout'

export {
  FILLED_TEXT_MEASURE_PAD_PX,
  FILLED_TEXT_PAD_X_PX,
  PLAIN_TEXT_MEASURE_PAD_PX,
  TEXT_LABEL_LINE_HEIGHT_RATIO,
  TEXT_LABEL_PAD_X_PX,
  TEXT_LABEL_PAD_Y_PX,
} from '@/lib/books/text-label-layout'

/** Minimum content width in pixels for an empty or single-glyph line. */
export const PLAIN_TEXT_MIN_WIDTH_PX = 8

/** Placement chrome for a brand-new empty label (fraction of page width). */
export const TEXT_LABEL_PLACEMENT_MIN_WIDTH_NORM = 0.06

/** Tight chrome minimum width in normalized space when page width is unknown. */
export const TEXT_LABEL_TIGHT_MIN_WIDTH_NORM = 0.002

export type TextLabelBoundsMode = 'placement' | 'tight'

export type TextLabelMeasureInput = Pick<
  TextAnnotationCommand,
  | 'x'
  | 'y'
  | 'yAnchor'
  | 'textAlign'
  | 'text'
  | 'fontSizeNorm'
  | 'fontId'
  | 'fontWeight'
  | 'maxWidthNorm'
  | 'visualStyle'
>

export type NormRect = { x: number; y: number; w: number; h: number }

/** Fallback average glyph width as a fraction of font size (Node / unloaded fonts). */
export const DEFAULT_TEXT_LABEL_AVG_CHAR_WIDTH_RATIO = 0.48

let measureCanvas: HTMLCanvasElement | null = null

function getMeasureCanvasContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
  }
  return measureCanvas.getContext('2d')
}

/** Same cap as the plain-text textarea in the DOM layer. */
export function plainTextMaxWidthPx(
  xNorm: number,
  maxWidthNorm: number | undefined,
  overlayWidthPx: number,
): number {
  const roomFromAnchor = overlayWidthPx * (1 - xNorm) - 4
  const cap = maxWidthNorm != null ? maxWidthNorm * overlayWidthPx : roomFromAnchor
  return Math.max(PLAIN_TEXT_MIN_WIDTH_PX, Math.min(roomFromAnchor, cap))
}

export function textLabelFontSizePx(fontSizeNorm: number, heightPx: number): number {
  return Math.max(10, Math.round(fontSizeNorm * heightPx))
}

function avgCharWidthRatioForFont(fontId?: AnnotationTextFontId): number {
  return getAnnotationTextFont(fontId).avgCharWidthRatio ?? DEFAULT_TEXT_LABEL_AVG_CHAR_WIDTH_RATIO
}

/** Measure one line width in pixels (no wrapping). */
export function measurePlainTextLineWidthPx(
  line: string,
  fontId: AnnotationTextFontId | undefined,
  fontSizePx: number,
  fontWeight?: AnnotationTextFontWeight,
): number {
  const sample = line.length > 0 ? line : ' '
  const fontFamily = annotationTextFontFamily(fontId)
  const cssWeight = annotationTextCssWeight(fontId, fontWeight)
  const ctx = getMeasureCanvasContext()
  if (ctx) {
    ctx.font = `${cssWeight} ${fontSizePx}px ${fontFamily}`
    return ctx.measureText(sample).width
  }
  const ratio = avgCharWidthRatioForFont(fontId)
  return sample.length * fontSizePx * ratio
}

function tightMinWidthNorm(widthPx: number): number {
  return Math.max(TEXT_LABEL_TIGHT_MIN_WIDTH_NORM, PLAIN_TEXT_MIN_WIDTH_PX / widthPx)
}

/**
 * Filled label bounds — matches on-page pill stack + edit chrome inset (DOM shell).
 * Uses the same pill layout path as the live editor when DOM is available.
 */
export function measureFilledTextLabelBounds(
  input: TextLabelMeasureInput,
  widthPx: number,
  heightPx: number,
  opts?: {
    mode?: TextLabelBoundsMode
    textOverride?: string
    growOnly?: boolean
    latchedMaxWidth?: boolean
  },
): NormRect {
  const mode = opts?.mode ?? 'tight'
  const text = opts?.textOverride ?? input.text
  const hasContent = text.trim().length > 0
  const fontSizePx = textLabelFontSizePx(input.fontSizeNorm, heightPx)
  const fontFamily = annotationTextFontFamily(input.fontId)
  const cssWeight = annotationTextCssWeight(input.fontId, input.fontWeight)
  const rowMinPx = filledPillRowMinPx(fontSizePx)
  const maxWidthNorm = input.maxWidthNorm ?? 0.88
  const minWidthNorm =
    mode === 'placement' ? TEXT_LABEL_PLACEMENT_MIN_WIDTH_NORM : tightMinWidthNorm(widthPx)

  let fieldWidthPx = PLAIN_TEXT_MIN_WIDTH_PX
  let segmentCount = 1

  if (typeof document !== 'undefined') {
    const layout = resolveTextLabelFieldLayout(
      hasContent ? text : '',
      fontFamily,
      fontSizePx,
      input.x,
      widthPx,
      {
        variant: 'filled',
        maxWidthNorm: input.maxWidthNorm,
        emptyPlaceholder: hasContent ? undefined : text || opts?.textOverride,
        growOnly: opts?.growOnly,
        latchedMaxWidth: opts?.latchedMaxWidth,
        fontWeight: cssWeight,
      },
    )
    fieldWidthPx = layout.fieldWidthPx
    segmentCount = Math.max(1, layout.segments.length)
  } else {
    const lines = text.length > 0 ? text.split('\n') : [' ']
    segmentCount = Math.max(1, lines.length)
    for (const line of lines) {
      fieldWidthPx = Math.max(
        fieldWidthPx,
        measurePlainTextLineWidthPx(line, input.fontId, fontSizePx, input.fontWeight) +
          FILLED_TEXT_MEASURE_PAD_PX,
      )
    }
    const maxWidthPx = plainTextMaxWidthPx(input.x, input.maxWidthNorm, widthPx)
    fieldWidthPx = Math.min(fieldWidthPx, maxWidthPx)
  }

  const stackHeightPx = filledPillStackHeightPx(
    segmentCount,
    rowMinPx,
    hasContent || Boolean(opts?.textOverride?.trim()),
  )
  const outerWidthPx = fieldWidthPx + FILLED_EDIT_CHROME_INSET_PX * 2
  const outerHeightPx = stackHeightPx + FILLED_EDIT_CHROME_INSET_PX * 2
  const w = Math.min(maxWidthNorm, Math.max(minWidthNorm, outerWidthPx / widthPx))
  const h = outerHeightPx / heightPx
  const y = input.yAnchor === 'center' ? input.y - h / 2 : input.y
  const x = textLabelBBoxLeft(input.x, w)
  return { x, y, w, h }
}

/**
 * Plain label bounds — same latch/wrap layout path as the on-page textarea.
 */
export function measurePlainTextLabelBounds(
  input: TextLabelMeasureInput,
  widthPx: number,
  heightPx: number,
  opts?: {
    mode?: TextLabelBoundsMode
    textOverride?: string
    growOnly?: boolean
    latchedMaxWidth?: boolean
  },
): NormRect {
  const mode = opts?.mode ?? 'tight'
  const text = opts?.textOverride ?? input.text
  const hasContent = text.trim().length > 0
  const fontSizePx = textLabelFontSizePx(input.fontSizeNorm, heightPx)
  const fontFamily = annotationTextFontFamily(input.fontId)
  const cssWeight = annotationTextCssWeight(input.fontId, input.fontWeight)
  const lineRowMinPx = textLabelLineHeightPx(fontSizePx)
  const maxWidthNorm = input.maxWidthNorm ?? 0.88
  const minWidthNorm =
    mode === 'placement' ? TEXT_LABEL_PLACEMENT_MIN_WIDTH_NORM : tightMinWidthNorm(widthPx)

  let fieldWidthPx = PLAIN_TEXT_MIN_WIDTH_PX
  let segmentCount = 1

  if (typeof document !== 'undefined') {
    const layout = resolveTextLabelFieldLayout(
      hasContent ? text : '',
      fontFamily,
      fontSizePx,
      input.x,
      widthPx,
      {
        variant: 'plain',
        maxWidthNorm: input.maxWidthNorm,
        emptyPlaceholder: hasContent ? undefined : text || opts?.textOverride,
        growOnly: opts?.growOnly,
        latchedMaxWidth: opts?.latchedMaxWidth,
        fontWeight: cssWeight,
      },
    )
    fieldWidthPx = layout.fieldWidthPx
    segmentCount = Math.max(1, layout.segments.length)
  } else {
    const lines = text.length > 0 ? text.split('\n') : [' ']
    segmentCount = Math.max(1, lines.length)
    for (const line of lines) {
      fieldWidthPx = Math.max(
        fieldWidthPx,
        measurePlainTextLineWidthPx(line, input.fontId, fontSizePx, input.fontWeight) +
          PLAIN_TEXT_MEASURE_PAD_PX,
      )
    }
    const maxWidthPx = plainTextMaxWidthPx(input.x, input.maxWidthNorm, widthPx)
    fieldWidthPx = Math.min(fieldWidthPx, maxWidthPx)
  }

  const stackHeightPx = textLabelStackHeightPx(
    segmentCount,
    lineRowMinPx,
    hasContent || Boolean(opts?.textOverride?.trim()),
    'plain',
  )
  const w = Math.min(maxWidthNorm, Math.max(minWidthNorm, fieldWidthPx / widthPx))
  const h = stackHeightPx / heightPx
  const y = input.yAnchor === 'center' ? input.y - h / 2 : input.y
  const x = textLabelBBoxLeft(input.x, w)
  return { x, y, w, h }
}

/**
 * Measured bounds for a plain (non-filled) text label — same rules as the on-page textarea.
 * Use `placement` for empty new labels; `tight` for hover, edit, and select chrome.
 */
export function measureTextLabelBounds(
  input: TextLabelMeasureInput,
  widthPx: number,
  heightPx: number,
  opts?: {
    mode?: TextLabelBoundsMode
    textOverride?: string
    growOnly?: boolean
    latchedMaxWidth?: boolean
  },
): NormRect {
  if (input.visualStyle === 'filled') {
    return measureFilledTextLabelBounds(input, widthPx, heightPx, opts)
  }

  return measurePlainTextLabelBounds(input, widthPx, heightPx, opts)
}

/** Legacy char-count heuristic — eraser hit tests only (no page dimensions available). */
export function textCommandHeuristicBBox(cmd: TextAnnotationCommand): NormRect {
  const lines = cmd.text.length > 0 ? cmd.text.split('\n') : ['']
  const lineCount = lines.length
  const maxW = cmd.maxWidthNorm ?? 0.88
  const w = Math.min(
    maxW,
    Math.max(0.06, ...lines.map((line) => line.length * cmd.fontSizeNorm * 0.55)),
  )
  const h = textLabelBlockHeightNorm(cmd.fontSizeNorm, lineCount)
  const y = cmd.yAnchor === 'center' ? cmd.y - h / 2 : cmd.y
  const x = textLabelBBoxLeft(cmd.x, w)
  return { x, y, w, h }
}
