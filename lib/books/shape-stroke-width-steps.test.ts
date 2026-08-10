import { describe, expect, it } from 'vitest'
import {
  thicknessStepToWidthScale,
  widthScaleToThicknessStep,
} from '@/lib/books/shape-stroke-width-steps'

describe('shape stroke width steps', () => {
  it('round-trips a known step', () => {
    const scale = thicknessStepToWidthScale(4)
    expect(widthScaleToThicknessStep(scale)).toBe(4)
  })
})
