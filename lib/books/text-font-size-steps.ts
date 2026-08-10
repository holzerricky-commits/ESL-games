import { ANNOTATION_TEXT_FONT_NORM_STEPS } from '@/components/students/fullscreen-book-overlay/constants'
import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'

/** Map a stored `fontSizeNorm` to the nearest top-bar thickness step index. */
export function fontSizeNormToTextThicknessStep(fontSizeNorm: number): AnnotationStrokeThicknessStep {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < ANNOTATION_TEXT_FONT_NORM_STEPS.length; i++) {
    const stepNorm = ANNOTATION_TEXT_FONT_NORM_STEPS[i]!
    const dist = Math.abs(stepNorm - fontSizeNorm)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best as AnnotationStrokeThicknessStep
}

export function textThicknessStepToFontSizeNorm(step: AnnotationStrokeThicknessStep): number {
  return ANNOTATION_TEXT_FONT_NORM_STEPS[step] ?? ANNOTATION_TEXT_FONT_NORM_STEPS[4]!
}
