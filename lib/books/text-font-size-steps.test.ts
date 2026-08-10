import { describe, expect, it } from 'vitest'
import {
  fontSizeNormToTextThicknessStep,
  textThicknessStepToFontSizeNorm,
} from '@/lib/books/text-font-size-steps'

describe('text-font-size-steps', () => {
  it('round-trips the canonical step table', () => {
    const step = 3
    const norm = textThicknessStepToFontSizeNorm(step)
    expect(fontSizeNormToTextThicknessStep(norm)).toBe(step)
  })

  it('picks the nearest step for arbitrary norms', () => {
    expect(fontSizeNormToTextThicknessStep(0.029)).toBe(3)
  })
})
