import { describe, expect, it } from 'vitest'
import {
  textFontSizeNormToPx,
  textFontSizePxOptions,
  textFontSizeStepToPx,
} from '@/lib/books/text-font-size-pixel'

describe('textFontSizeNormToPx', () => {
  it('matches dom layer formula', () => {
    expect(textFontSizeNormToPx(0.04, 600)).toBe(24)
    expect(textFontSizeNormToPx(0.016, 500)).toBe(10)
  })
})

describe('textFontSizePxOptions', () => {
  it('returns one px value per step including the move-tool minimum', () => {
    const opts = textFontSizePxOptions(800)
    expect(opts).toHaveLength(8)
    expect(opts[0]!.px).toBeGreaterThanOrEqual(10)
    expect(opts[1]!.px).toBeGreaterThan(opts[0]!.px)
    expect(textFontSizeStepToPx(4, 800)).toBe(opts[4]!.px)
  })
})
