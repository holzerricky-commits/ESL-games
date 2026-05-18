import { describe, expect, it } from 'vitest'
import { contrastRatio } from '@/lib/books/eyedropper-derive'
import { deriveSmartInkFromBackground } from '@/lib/books/eyedropper-derive'
import { inkFromEyedropperSample } from '@/lib/books/eyedropper-variant'

describe('eyedropper-variant', () => {
  it('sample mode returns exact background hex', () => {
    expect(inkFromEyedropperSample('#93c5fd', 'sample')).toBe('#93c5fd')
  })

  it('smart mode derives contrasting ink', () => {
    const bg = '#93c5fd'
    const ink = inkFromEyedropperSample(bg, 'smart')
    expect(ink).toBe(deriveSmartInkFromBackground(bg))
    expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(4.5)
  })
})
