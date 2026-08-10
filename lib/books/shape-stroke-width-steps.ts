import {
  ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS,
  type AnnotationStrokeThicknessStep,
} from '@/lib/books/annotation-storage'

/** Map a stored width scale to the nearest thickness slider step. */
export function widthScaleToThicknessStep(scale: number): AnnotationStrokeThicknessStep {
  let best: AnnotationStrokeThicknessStep = 0
  let bestDist = Infinity
  for (let i = 0; i < ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS.length; i++) {
    const step = i as AnnotationStrokeThicknessStep
    const dist = Math.abs(ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS[step]! - scale)
    if (dist < bestDist) {
      bestDist = dist
      best = step
    }
  }
  return best
}

export function thicknessStepToWidthScale(step: AnnotationStrokeThicknessStep): number {
  return ANNOTATION_FINE_INK_STROKE_WIDTH_STEPS[step]!
}
