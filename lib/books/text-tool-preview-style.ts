import type { CSSProperties } from 'react'
import type { TextAnnotationAlign, TextAnnotationVisualStyle } from '@/lib/books/annotation-command-types'
import {
  annotationTextCssWeight,
  annotationTextFontFamily,
  type AnnotationTextFontId,
  type AnnotationTextFontWeight,
} from '@/lib/books/annotation-text-fonts'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { filledTextLineStridePx } from '@/lib/books/filled-text-layout'
import { textThicknessStepToFontSizeNorm } from '@/lib/books/text-font-size-steps'
import { textLabelFontSizePx } from '@/lib/books/text-label-measure'
import {
  annotationTextFieldNoScrollCSS,
  filledPillRowMinPx,
  textLabelAlignOrDefault,
  textLabelFieldPaddingCSS,
  textLabelLineHeightPx,
  textLabelPadYPx,
  type TextLabelFieldVariant,
} from '@/lib/books/text-label-layout'

/** Fallback when page height is not yet measured. */
export const TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX = 600

export const TEXT_TOOL_PREVIEW_SAMPLE = 'Sample text'

export type TextToolPreviewStyleInput = {
  textFontId: AnnotationTextFontId
  textFontWeight?: AnnotationTextFontWeight
  textVisualStyle: TextAnnotationVisualStyle
  textAlign: TextAnnotationAlign
  textThicknessStep: AnnotationStrokeThicknessStep
  textColor: string
  textFillColor: string
  /** Spread/page canvas height — same value used when rendering text on the book. */
  pageHeightPx?: number
}

export type TextToolPreviewTypography = {
  fontFamily: string
  fontWeight: CSSProperties['fontWeight']
  fontSizePx: number
  color: string
  fillColor: string
  textAlign: TextAnnotationAlign
  variant: TextLabelFieldVariant
  sampleText: string
  rowMinPx: number
  lineHeightPx: number
  contentMinHeightPx: number
}

export function textToolPreviewSampleText(_visualStyle: TextAnnotationVisualStyle): string {
  return TEXT_TOOL_PREVIEW_SAMPLE
}

export function resolveTextToolPreviewPageHeightPx(pageHeightPx?: number): number {
  return pageHeightPx != null && pageHeightPx > 0
    ? pageHeightPx
    : TEXT_TOOL_PREVIEW_REFERENCE_HEIGHT_PX
}

export function buildTextToolPreviewFontSizePx(
  step: AnnotationStrokeThicknessStep,
  pageHeightPx?: number,
): number {
  const fontSizeNorm = textThicknessStepToFontSizeNorm(step)
  return textLabelFontSizePx(fontSizeNorm, resolveTextToolPreviewPageHeightPx(pageHeightPx))
}

export function buildTextToolPreviewTypography(
  input: TextToolPreviewStyleInput,
): TextToolPreviewTypography {
  const variant: TextLabelFieldVariant = input.textVisualStyle === 'filled' ? 'filled' : 'plain'
  const fontSizePx = buildTextToolPreviewFontSizePx(input.textThicknessStep, input.pageHeightPx)
  const lineHeightPx =
    variant === 'filled' ? filledTextLineStridePx(fontSizePx) : textLabelLineHeightPx(fontSizePx)
  const rowMinPx = filledPillRowMinPx(fontSizePx)
  const padY = textLabelPadYPx(variant) * 2
  const contentMinHeightPx = (variant === 'filled' ? rowMinPx : lineHeightPx) + padY

  return {
    fontFamily: annotationTextFontFamily(input.textFontId),
    fontWeight: annotationTextCssWeight(input.textFontId, input.textFontWeight),
    fontSizePx,
    color: input.textColor,
    fillColor: input.textFillColor,
    textAlign: textLabelAlignOrDefault(input.textAlign),
    variant,
    sampleText: textToolPreviewSampleText(input.textVisualStyle),
    rowMinPx,
    lineHeightPx,
    contentMinHeightPx,
  }
}

/** Mirror typography aligned with on-page text labels. */
export function buildTextToolPreviewMirrorStyle(typography: TextToolPreviewTypography): CSSProperties {
  return {
    fontFamily: typography.fontFamily,
    fontWeight: typography.fontWeight,
    fontSize: typography.fontSizePx,
    color: typography.color,
    textAlign: typography.textAlign,
    ...textLabelFieldPaddingCSS(typography.variant),
    ...annotationTextFieldNoScrollCSS(),
    lineHeight: `${typography.lineHeightPx}px`,
    minHeight: typography.lineHeightPx,
    wordBreak: 'normal',
    overflowWrap: 'break-word',
    whiteSpace: typography.variant === 'filled' ? 'pre' : 'pre-wrap',
  }
}
