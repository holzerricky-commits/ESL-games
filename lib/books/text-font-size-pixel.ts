import { ANNOTATION_TEXT_FONT_NORM_STEPS } from '@/components/students/fullscreen-book-overlay/constants'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import {
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

export function textFontSizeNormToStep(
  fontSizeNorm: number,
): AnnotationStrokeThicknessStep {
  return fontSizeNormToTextThicknessStep(fontSizeNorm)
}

export function formatAnnotationSizePx(px: number): string {
  const rounded = Math.round(px * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
