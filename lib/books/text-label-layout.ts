/**
 * Shared layout tokens for on-page text labels.
 * DOM fields (Phase 2+) and selection chrome must use the same values.
 */

import type { CSSProperties } from 'react'
import type { TextAnnotationAlign, WritableStickerVariant } from '@/lib/books/annotation-command-types'
import { isCenteredWritableStickerVariant } from '@/lib/books/sticker-tool'

/** Line-height multiplier for each text line in bbox / field layout. */
export const TEXT_LABEL_LINE_HEIGHT_RATIO = 1.3

/** Minimum empty field width in px — matches `PLAIN_TEXT_MIN_WIDTH_PX` in text-label-measure. */
export const TEXT_LABEL_EMPTY_FIELD_MIN_WIDTH_PX = 8

/** Tight min width norm when page width is unknown (matches text-label-measure). */
export const TEXT_LABEL_TIGHT_MIN_WIDTH_NORM = 0.002

/** Horizontal inset per side (plain labels). */
export const TEXT_LABEL_PAD_X_PX = 3

/** Vertical inset per side — symmetric space above and below ink / caret. */
export const TEXT_LABEL_PAD_Y_PX = 4

/** Vertical inset per side for filled/pill labels. */
export const FILLED_TEXT_PAD_Y_PX = 4

/** Horizontal inset per side for filled/pill labels. */
export const FILLED_TEXT_PAD_X_PX = 8

/** Gap between filled label ink/pills and the edit selection ring (px). */
export const FILLED_EDIT_CHROME_INSET_PX = 2

/** Hairline so white/pale fills still read as a box on cream pages. */
export const FILLED_TEXT_PILL_EDGE_SHADOW = 'inset 0 0 0 1px rgba(15, 23, 42, 0.14)'

/** Extra height per filled pill row for script-font descenders (not applied to textarea line-height). */
export const FILLED_TEXT_ROW_SLACK_PX = 2

/** Total horizontal padding (both sides) added to measured plain ink width. */
export const PLAIN_TEXT_MEASURE_PAD_PX = TEXT_LABEL_PAD_X_PX * 2

/** Total horizontal padding (both sides) added to measured filled ink width. */
export const FILLED_TEXT_MEASURE_PAD_PX = FILLED_TEXT_PAD_X_PX * 2

/** @deprecated Import TEXT_LABEL_LINE_HEIGHT_RATIO — kept for annotation-geometry re-export. */
export const TEXT_ANNOTATION_LINE_HEIGHT_RATIO = TEXT_LABEL_LINE_HEIGHT_RATIO

export type TextLabelFieldVariant = 'plain' | 'filled'

export function textLabelPadXPx(variant: TextLabelFieldVariant = 'plain'): number {
  return variant === 'filled' ? FILLED_TEXT_PAD_X_PX : TEXT_LABEL_PAD_X_PX
}

export function textLabelPadYPx(variant: TextLabelFieldVariant = 'plain'): number {
  return variant === 'filled' ? FILLED_TEXT_PAD_Y_PX : TEXT_LABEL_PAD_Y_PX
}

/** Pixel line height for one row in the field (matches bbox line block). */
export function textLabelLineHeightPx(fontSizePx: number): number {
  return Math.ceil(fontSizePx * TEXT_LABEL_LINE_HEIGHT_RATIO)
}

/** Pill row min-height — line block plus descender slack for filled backgrounds. */
export function filledPillRowMinPx(fontSizePx: number): number {
  return textLabelLineHeightPx(fontSizePx) + FILLED_TEXT_ROW_SLACK_PX
}

export function textLabelAlignOrDefault(align?: TextAnnotationAlign): TextAnnotationAlign {
  return align ?? 'left'
}

/** Clamp stored bbox left edge to the page. */
export function textLabelBBoxLeft(storedLeftX: number, widthNorm: number): number {
  let x = storedLeftX
  if (x < 0) x = 0
  if (x + widthNorm > 1) x = Math.max(0, 1 - widthNorm)
  return x
}

/** Clamp stored bbox top edge to the page. */
export function textLabelBBoxTop(storedTopY: number, heightNorm: number): number {
  let y = storedTopY
  if (y < 0) y = 0
  if (y + heightNorm > 1) y = Math.max(0, 1 - heightNorm)
  return y
}

/** Clamp stored vertical center so the full bbox height fits on the page. */
export function textLabelBBoxCenter(storedCenterY: number, heightNorm: number): number {
  let y = storedCenterY
  const half = heightNorm / 2
  if (half <= 0) return Math.max(0, Math.min(1, y))
  if (y - half < 0) y = half
  if (y + half > 1) y = Math.max(half, 1 - half)
  return y
}

/** Pixel offset from bbox top-left to the typing caret / first ink. */
export function textLabelCaretInsetPx(variant: TextLabelFieldVariant = 'plain'): { x: number; y: number } {
  const chrome = variant === 'filled' ? FILLED_EDIT_CHROME_INSET_PX : 0
  return {
    x: chrome + textLabelPadXPx(variant),
    y: chrome + textLabelPadYPx(variant),
  }
}

/** Normalized width of the empty live field — used to anchor center/right carets on click. */
export function textLabelEmptyAlignBoxWidthNorm(
  widthPx: number,
  variant: TextLabelFieldVariant = 'plain',
): number {
  const tightMin =
    widthPx > 0
      ? Math.max(
          TEXT_LABEL_TIGHT_MIN_WIDTH_NORM,
          TEXT_LABEL_EMPTY_FIELD_MIN_WIDTH_PX / widthPx,
        )
      : TEXT_LABEL_TIGHT_MIN_WIDTH_NORM
  if (variant === 'filled') {
    const outerPx = TEXT_LABEL_EMPTY_FIELD_MIN_WIDTH_PX + FILLED_EDIT_CHROME_INSET_PX * 2
    return widthPx > 0 ? outerPx / widthPx : tightMin
  }
  return tightMin
}

/** Recompute stored left edge when a center-aligned label grows in width. */
export function textLabelCenterGrowLeft(
  storedLeftX: number,
  prevWidthNorm: number,
  nextWidthNorm: number,
): number {
  const centerX = storedLeftX + prevWidthNorm / 2
  return textLabelBBoxLeft(centerX - nextWidthNorm / 2, nextWidthNorm)
}

export type TextLabelPlacementFromClickOpts = {
  clickX: number
  clickY: number
  align: TextAnnotationAlign
  widthPx: number
  heightPx: number
  variant?: TextLabelFieldVariant
  /** Width of the empty live field for caret anchoring; defaults to tight box width. */
  alignBoxWidthNorm?: number
  /** Optional wide bbox for legacy placement measure; omit for new labels. */
  placementWidthNorm?: number
  /** One-line bbox height for edge clamp; derived from fontSizeNorm when omitted. */
  fontSizeNorm?: number
  minHeightNorm?: number
}

/**
 * Convert a click point into stored placement: horizontal caret on click, first-line mid on click.
 * Stores top-anchored `y` (click center minus half one-line height) so Enter/wrap grows downward only.
 */
export function textLabelPlacementFromClick(opts: TextLabelPlacementFromClickOpts): {
  x: number
  y: number
  yAnchor: 'top'
} {
  const variant = opts.variant ?? 'plain'
  const alignW =
    opts.alignBoxWidthNorm ?? textLabelEmptyAlignBoxWidthNorm(opts.widthPx, variant)
  const clampW = opts.placementWidthNorm ?? alignW
  const { x: insetX } = textLabelCaretInsetPx(variant)
  const insetXNorm = opts.widthPx > 0 ? insetX / opts.widthPx : 0
  const { clickX, clickY, align } = opts

  let x: number
  if (align === 'center') {
    x = clickX - alignW / 2
  } else if (align === 'right') {
    x = clickX - alignW + insetXNorm
  } else {
    x = clickX - insetXNorm
  }

  const minHeightNorm =
    opts.minHeightNorm ??
    (opts.fontSizeNorm != null && opts.heightPx > 0
      ? textLabelBlockHeightNorm(opts.fontSizeNorm, 1, opts.heightPx, variant)
      : 0)

  const centerY = textLabelBBoxCenter(clickY, minHeightNorm)
  const topY = minHeightNorm > 0 ? centerY - minHeightNorm / 2 : clickY

  return {
    x: textLabelBBoxLeft(x, clampW),
    y: textLabelBBoxTop(topY, minHeightNorm),
    yAnchor: 'top',
  }
}

/**
 * Convert a click point + tool alignment into the stored left edge for a new label.
 * Uses placement min width so center/right clicks position the empty field correctly.
 */
export function textLabelPlacementXFromClick(
  clickX: number,
  align: TextAnnotationAlign,
  placementWidthNorm: number,
): number {
  const w = placementWidthNorm
  const x =
    align === 'center' ? clickX - w / 2 : align === 'right' ? clickX - w : clickX
  return textLabelBBoxLeft(x, w)
}

/** @deprecated Use {@link textLabelBBoxLeft} — `x` is always the bbox left edge; align is in-box only. */
export function textLabelBBoxXFromAnchor(
  storedLeftX: number,
  widthNorm: number,
  _align: TextAnnotationAlign = 'left',
): number {
  return textLabelBBoxLeft(storedLeftX, widthNorm)
}

export function filledTextInkInsetCSS(): {
  top: string
  left: string
  right: string
  bottom: string
} {
  return {
    top: `${FILLED_TEXT_PAD_Y_PX}px`,
    left: `${FILLED_TEXT_PAD_X_PX}px`,
    right: `${FILLED_TEXT_PAD_X_PX}px`,
    bottom: `${FILLED_TEXT_PAD_Y_PX}px`,
  }
}

/** Symmetric field padding — use on textarea and ghost/mirror layers. */
export function textLabelFieldPaddingCSS(variant: TextLabelFieldVariant = 'plain'): {
  paddingTop: string
  paddingBottom: string
  paddingLeft: string
  paddingRight: string
} {
  const padX = textLabelPadXPx(variant)
  const padY = textLabelPadYPx(variant)
  return {
    paddingTop: `${padY}px`,
    paddingBottom: `${padY}px`,
    paddingLeft: `${padX}px`,
    paddingRight: `${padX}px`,
  }
}

/**
 * Pill-stack offset — top/bottom only so left/right inset lives inside the fill
 * (bars are ink width plus horizontal pad).
 */
export function filledTextPillStackPaddingCSS(): {
  paddingTop: string
  paddingBottom: string
  paddingLeft: string
  paddingRight: string
} {
  return {
    paddingTop: `${FILLED_TEXT_PAD_Y_PX}px`,
    paddingBottom: `${FILLED_TEXT_PAD_Y_PX}px`,
    paddingLeft: '0px',
    paddingRight: '0px',
  }
}

/** Horizontal padding from computed textarea styles (for live width fitting). */
export function textLabelHorizontalPadFromComputedStyle(cs: CSSStyleDeclaration): number {
  return (
    (parseFloat(cs.paddingLeft) || 0) +
    (parseFloat(cs.paddingRight) || 0) +
    (parseFloat(cs.borderLeftWidth) || 0) +
    (parseFloat(cs.borderRightWidth) || 0)
  )
}

/** Extra width so the last glyph does not soft-wrap from subpixel measure drift. */
export const TEXT_LABEL_WIDTH_FIT_SLACK_PX = 2

/** Additional width while typing so a fast keystroke never outruns the box. */
export const TEXT_LABEL_WIDTH_TYPING_SLACK_PX = 4

/**
 * Neutral placeholder ink — not faded pen color.
 * Readable on light PDF pages regardless of pen (white, yellow, red, etc.).
 */
export const TEXT_LABEL_PLACEHOLDER_COLOR = 'rgba(71, 85, 105, 0.62)'

/** CSS custom property set on annotation textareas for ::placeholder styling. */
export const ANNOTATION_PLACEHOLDER_COLOR_CSS_VAR = '--annotation-placeholder-color'

export function textLabelPlaceholderColor(): string {
  return TEXT_LABEL_PLACEHOLDER_COLOR
}

/** Inline color + CSS var for ghost layers and native textarea placeholders. */
export function textLabelPlaceholderFieldCSS(): {
  color: string
  [ANNOTATION_PLACEHOLDER_COLOR_CSS_VAR]: string
} {
  const color = textLabelPlaceholderColor()
  return { color, [ANNOTATION_PLACEHOLDER_COLOR_CSS_VAR]: color }
}

/** Ghost placeholder layer — single styling path for all editors. */
export function textLabelPlaceholderMirrorStyle(base: CSSProperties): CSSProperties {
  return { ...base, ...textLabelPlaceholderFieldCSS() }
}

/** Caret + placeholder CSS var for editable annotation textareas. */
export function textLabelEditableFieldChromeCSS(
  inkColor: string,
  opts?: { hideCaret?: boolean; hideInk?: boolean },
): Pick<CSSProperties, 'caretColor' | 'color'> & {
  [ANNOTATION_PLACEHOLDER_COLOR_CSS_VAR]: string
} {
  return {
    [ANNOTATION_PLACEHOLDER_COLOR_CSS_VAR]: textLabelPlaceholderColor(),
    caretColor: opts?.hideCaret ? 'transparent' : caretColorForInk(inkColor),
    ...(opts?.hideInk ? { color: 'transparent' } : {}),
  }
}

/** Writable sticky body — same padding + line height as plain labels. */
export function writableStickyBodyFontSizePx(
  baseFontSizePx: number,
  variant: WritableStickerVariant,
): number {
  if (variant === 'caption' || variant === 'speech' || variant === 'thought') {
    return Math.max(10, baseFontSizePx - 1)
  }
  return baseFontSizePx
}

/** Min height for the sticky typing field. */
export function writableStickyFieldMinHeightPx(
  _variant: WritableStickerVariant,
  _baseFontSizePx: number,
  bodyMinPx: number,
): number {
  return bodyMinPx
}

export function writableStickyBodyMirrorStyle(
  fontFamily: string,
  baseFontSizePx: number,
  textColor: string,
  variant: WritableStickerVariant,
  minHeightPx: number,
  fontWeight?: CSSProperties['fontWeight'],
): CSSProperties {
  const fontSize = writableStickyBodyFontSizePx(baseFontSizePx, variant)
  const lineHeightPx = textLabelLineHeightPx(fontSize)
  const isBubble = variant === 'speech' || variant === 'thought'
  return {
    fontFamily,
    fontSize,
    color: textColor,
    ...(fontWeight != null ? { fontWeight } : {}),
    textAlign: isCenteredWritableStickerVariant(variant) ? 'center' : 'start',
    ...(isBubble ? { padding: 0 } : textLabelFieldPaddingCSS('plain')),
    ...annotationTextFieldNoScrollCSS(),
    lineHeight: `${lineHeightPx}px`,
    minHeight: isBubble ? undefined : minHeightPx,
    maxWidth: '100%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  }
}

/** Caret on light pen inks (white, yellow) — dark so it stays visible on the PDF. */
export const TEXT_LABEL_LIGHT_INK_CARET_COLOR = '#1c1917'

/** Relative luminance above which the typing caret switches to {@link TEXT_LABEL_LIGHT_INK_CARET_COLOR}. */
export const TEXT_LABEL_INK_LUMINANCE_CARET_THRESHOLD = 0.68

function hexColorLuminance(hex: string): number | null {
  const norm = hex.trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(norm)) return null
  const r = parseInt(norm.slice(1, 3), 16)
  const g = parseInt(norm.slice(3, 5), 16)
  const b = parseInt(norm.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Dark caret when ink is light; otherwise caret matches ink (or body text on stickies). */
export function caretColorForInk(inkColor: string): string {
  const luminance = hexColorLuminance(inkColor)
  if (luminance != null && luminance > TEXT_LABEL_INK_LUMINANCE_CARET_THRESHOLD) {
    return TEXT_LABEL_LIGHT_INK_CARET_COLOR
  }
  return inkColor
}

export function textLabelCaretFieldCSS(inkColor: string): Pick<CSSProperties, 'caretColor'> {
  return { caretColor: caretColorForInk(inkColor) }
}

/** Opacity for the filled-label “tray” while empty and editing (before first keystroke). */
export const FILLED_TEXT_EMPTY_TRAY_ALPHA = 0.38

/** Faint pill background from the chosen fill swatch — signals “filled style” before typing. */
export function filledTextEmptyTrayColor(fillHex: string): string {
  const norm = fillHex.trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(norm)) {
    return `rgba(226, 232, 240, ${FILLED_TEXT_EMPTY_TRAY_ALPHA})`
  }
  const r = parseInt(norm.slice(1, 3), 16)
  const g = parseInt(norm.slice(3, 5), 16)
  const b = parseInt(norm.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${FILLED_TEXT_EMPTY_TRAY_ALPHA})`
}

/** Never show scrollbars inside on-page annotation text fields. */
export function annotationTextFieldNoScrollCSS(): Pick<
  CSSProperties,
  'overflowX' | 'overflowY' | 'scrollbarWidth'
> {
  return {
    overflowX: 'hidden',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
  }
}

/** Normalized vertical padding (top + bottom) for a given overlay height. */
export function textLabelVerticalPadNorm(
  heightPx: number,
  variant: TextLabelFieldVariant = 'plain',
): number {
  if (heightPx <= 0) return 0
  return (2 * textLabelPadYPx(variant)) / heightPx
}

/**
 * Normalized block height: line block + optional symmetric vertical pad.
 * Pass `heightPx` when sizing selection chrome; omit for legacy heuristics without page size.
 */
export function textLabelBlockHeightNorm(
  fontSizeNorm: number,
  lineCount: number,
  heightPx?: number,
  variant: TextLabelFieldVariant = 'plain',
): number {
  const lines = Math.max(1, lineCount)
  const lineBlock = fontSizeNorm * TEXT_LABEL_LINE_HEIGHT_RATIO * lines
  if (heightPx == null || heightPx <= 0) return lineBlock
  return lineBlock + textLabelVerticalPadNorm(heightPx, variant)
}
