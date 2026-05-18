import { describe, expect, it } from 'vitest'
import { hexToHsl, hslToHex, rgbToHsl } from '@/lib/books/hsl-color'

describe('hsl-color', () => {
  it('round-trips hex through HSL', () => {
    expect(hslToHex(hexToHsl('#ff0000')!)).toBe('#ff0000')
    expect(hslToHex(hexToHsl('#1d4ed8')!)).toBe('#1d4ed8')
  })

  it('gray has zero saturation', () => {
    const hsl = rgbToHsl(128, 128, 128)
    expect(hsl.s).toBeLessThan(0.01)
  })
})
