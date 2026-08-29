import {
  ANNOTATION_STROKE_WIDTH_STEPS,
  type AnnotationStrokeThicknessStep,
} from '@/lib/books/annotation-storage'

/** Map a stored marker width scale to the nearest thickness slider step. */
export function markerWidthScaleToThicknessStep(scale: number): AnnotationStrokeThicknessStep {
  let best: AnnotationStrokeThicknessStep = 0
  let bestDist = Infinity
  for (let i = 0; i < ANNOTATION_STROKE_WIDTH_STEPS.length; i++) {
    const step = i as AnnotationStrokeThicknessStep
    const dist = Math.abs(ANNOTATION_STROKE_WIDTH_STEPS[step]! - scale)
    if (dist < bestDist) {
      bestDist = dist
      best = step
    }
  }
  return best
}

export function markerThicknessStepToWidthScale(step: AnnotationStrokeThicknessStep): number {
  return ANNOTATION_STROKE_WIDTH_STEPS[step] ?? ANNOTATION_STROKE_WIDTH_STEPS[3]!
}
