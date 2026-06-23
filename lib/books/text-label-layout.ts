/**
 * Shared layout tokens for on-page text labels.
 * DOM fields (Phase 2+) and selection chrome must use the same values.
 */

import type { CSSProperties } from 'react'
import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'

/** Line-height multiplier for each text line in bbox / field layout. */
export const TEXT_LABEL_LINE_HEIGHT_RATIO = 1.3

/** Horizontal inset per side (plain labels). */
export const TEXT_LABEL_PAD_X_PX = 3

/** Vertical inset per side — symmetric space above and below ink / caret. */
export const TEXT_LABEL_PAD_Y_PX = 4

/** Horizontal inset per side for filled/pill labels (wider gutter). */
export const FILLED_TEXT_PAD_X_PX = 6

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

/** Pixel line height for one row in the field (matches bbox line block). */
export function textLabelLineHeightPx(fontSizePx: number): number {
  return Math.ceil(fontSizePx * TEXT_LABEL_LINE_HEIGHT_RATIO)
}

/** Symmetric field padding — use on textarea and ghost/mirror layers. */
export function textLabelFieldPaddingCSS(variant: TextLabelFieldVariant = 'plain'): {
  paddingTop: string
  paddingBottom: string
  paddingLeft: string
  paddingRight: string
} {
  const padX = textLabelPadXPx(variant)
  return {
    paddingTop: `${TEXT_LABEL_PAD_Y_PX}px`,
    paddingBottom: `${TEXT_LABEL_PAD_Y_PX}px`,
    paddingLeft: `${padX}px`,
    paddingRight: `${padX}px`,
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
  opts?: { hideCaret?: boolean },
): Pick<CSSProperties, 'caretColor'> & {
  [ANNOTATION_PLACEHOLDER_COLOR_CSS_VAR]: string
} {
  return {
    [ANNOTATION_PLACEHOLDER_COLOR_CSS_VAR]: textLabelPlaceholderColor(),
    caretColor: opts?.hideCaret ? 'transparent' : caretColorForInk(inkColor),
  }
}

/** Writable sticky body — same padding + line height as plain labels. */
export function writableStickyBodyFontSizePx(
  baseFontSizePx: number,
  variant: WritableStickerVariant,
): number {
  return variant === 'caption' ? Math.max(10, baseFontSizePx - 1) : baseFontSizePx
}

export function writableStickyBodyMirrorStyle(
  fontFamily: string,
  baseFontSizePx: number,
  textColor: string,
  variant: WritableStickerVariant,
  minHeightPx: number,
): CSSProperties {
  const fontSize = writableStickyBodyFontSizePx(baseFontSizePx, variant)
  const lineHeightPx = textLabelLineHeightPx(fontSize)
  return {
    fontFamily,
    fontSize,
    color: textColor,
    ...textLabelFieldPaddingCSS('plain'),
    ...annotationTextFieldNoScrollCSS(),
    lineHeight: `${lineHeightPx}px`,
    minHeight: minHeightPx,
    whiteSpace: 'pre-wrap',
    wordBreak: 'normal',
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
export function textLabelVerticalPadNorm(heightPx: number): number {
  if (heightPx <= 0) return 0
  return (2 * TEXT_LABEL_PAD_Y_PX) / heightPx
}

/**
 * Normalized block height: line block + optional symmetric vertical pad.
 * Pass `heightPx` when sizing selection chrome; omit for legacy heuristics without page size.
 */
export function textLabelBlockHeightNorm(
  fontSizeNorm: number,
  lineCount: number,
  heightPx?: number,
): number {
  const lines = Math.max(1, lineCount)
  const lineBlock = fontSizeNorm * TEXT_LABEL_LINE_HEIGHT_RATIO * lines
  if (heightPx == null || heightPx <= 0) return lineBlock
  return lineBlock + textLabelVerticalPadNorm(heightPx)
}
