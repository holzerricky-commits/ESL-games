import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { formatAnnotationSizePx } from '@/lib/books/text-font-size-pixel'

export type InkThicknessStepOption = {
  step: AnnotationStrokeThicknessStep
  px: number
}

export function inkThicknessPxOptions(
  previewDots: readonly number[],
): readonly InkThicknessStepOption[] {
  return previewDots.map((px, i) => ({
    step: i as AnnotationStrokeThicknessStep,
    px: Math.round(px * 10) / 10,
  }))
}

export function inkPreviewDiameterPx(lineWidthPx: number): number {
  return Math.min(14, Math.max(3, Math.round(lineWidthPx)))
}

export { formatAnnotationSizePx }
