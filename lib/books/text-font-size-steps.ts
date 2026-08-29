import type { AnnotationStrokeThicknessStep } from '@/lib/books/annotation-storage'
import { TEXT_FONT_SIZE_NORM_MIN } from '@/lib/books/text-font-size-min'

export { TEXT_FONT_SIZE_NORM_MIN }

/**
 * Text / sticky thickness steps. First value matches the move-tool font floor
 * so you can start at the same size you can scale down to.
 */
export const ANNOTATION_TEXT_FONT_NORM_STEPS = [
  TEXT_FONT_SIZE_NORM_MIN,
  0.016,
  0.02,
  0.024,
  0.028,
  0.032,
  0.038,
  0.046,
] as const

export const TEXT_THICKNESS_STEP_MAX = 7 satisfies AnnotationStrokeThicknessStep

/** Mid-range default — same visual size as the old 7-step index 3 (0.028). */
export const DEFAULT_TEXT_THICKNESS_STEP = 4 satisfies AnnotationStrokeThicknessStep

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
  return ANNOTATION_TEXT_FONT_NORM_STEPS[step] ?? ANNOTATION_TEXT_FONT_NORM_STEPS[DEFAULT_TEXT_THICKNESS_STEP]!
}
