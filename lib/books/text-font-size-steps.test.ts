import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_TEXT_FONT_NORM_STEPS,
  DEFAULT_TEXT_THICKNESS_STEP,
  TEXT_FONT_SIZE_NORM_MIN,
  TEXT_THICKNESS_STEP_MAX,
  fontSizeNormToTextThicknessStep,
  textThicknessStepToFontSizeNorm,
} from '@/lib/books/text-font-size-steps'

describe('text-font-size-steps', () => {
  it('round-trips the canonical step table', () => {
    const step = DEFAULT_TEXT_THICKNESS_STEP
    const norm = textThicknessStepToFontSizeNorm(step)
    expect(fontSizeNormToTextThicknessStep(norm)).toBe(step)
  })

  it('includes the move-tool minimum as the first thickness step', () => {
    expect(ANNOTATION_TEXT_FONT_NORM_STEPS).toHaveLength(8)
    expect(textThicknessStepToFontSizeNorm(0)).toBe(TEXT_FONT_SIZE_NORM_MIN)
    expect(fontSizeNormToTextThicknessStep(TEXT_FONT_SIZE_NORM_MIN)).toBe(0)
    expect(TEXT_THICKNESS_STEP_MAX).toBe(7)
  })

  it('picks the nearest step for arbitrary norms', () => {
    expect(fontSizeNormToTextThicknessStep(0.029)).toBe(4)
  })
})
