import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import {
  ANNOTATION_TEXT_FONT_NORM_STEPS,
  fontSizeNormToTextThicknessStep,
  textThicknessStepToFontSizeNorm,
} from '@/lib/books/text-font-size-steps'

export type TextFontSizeStepOption = {
  step: AnnotationStrokeThicknessStep
  px: number
}

/** On-canvas text size in CSS px (matches dom layer rendering). */
export function textFontSizeNormToPx(fontSizeNorm: number, heightPx: number): number {
  if (!(heightPx > 0)) return Math.max(10, Math.round(fontSizeNorm * 600))
  return Math.max(10, Math.round(fontSizeNorm * heightPx))
}

export function textFontSizeStepToPx(
  step: AnnotationStrokeThicknessStep,
  heightPx: number,
): number {
  return textFontSizeNormToPx(textThicknessStepToFontSizeNorm(step), heightPx)
}

export function textFontSizePxOptions(heightPx: number): readonly TextFontSizeStepOption[] {
  return ANNOTATION_TEXT_FONT_NORM_STEPS.map((norm, i) => ({
    step: i as AnnotationStrokeThicknessStep,
    px: textFontSizeNormToPx(norm, heightPx),
  }))
}

/** Slider preview dots — relative sizes so 8 text steps stay distinct in the rail. */
export function textFontSizeThicknessPreviewDots(heightPx: number): readonly number[] {
  const pxs = ANNOTATION_TEXT_FONT_NORM_STEPS.map((norm) => textFontSizeNormToPx(norm, heightPx))
  const lo = pxs[0] ?? 10
  const hi = pxs[pxs.length - 1] ?? lo
  const span = Math.max(1, hi - lo)
  return pxs.map((px) => Math.round(5 + (11 * (px - lo)) / span))
}

export function textFontSizeNormToStep(
  fontSizeNorm: number,
): AnnotationStrokeThicknessStep {
  return fontSizeNormToTextThicknessStep(fontSizeNorm)
}

export function formatAnnotationSizePx(px: number): string {
  const rounded = Math.round(px * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
