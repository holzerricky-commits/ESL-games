import { describe, expect, it } from 'vitest'
import {
  markerThicknessStepToWidthScale,
  markerWidthScaleToThicknessStep,
} from '@/lib/books/marker-stroke-width-steps'

describe('marker stroke width steps', () => {
  it('round-trips a known step', () => {
    const scale = markerThicknessStepToWidthScale(3)
    expect(markerWidthScaleToThicknessStep(scale)).toBe(3)
  })
})
