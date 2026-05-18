import { describe, expect, it } from 'vitest'
import { contrastRatio, deriveSmartInkFromBackground } from '@/lib/books/eyedropper-derive'
import { hexToHsl } from '@/lib/books/hsl-color'

const MIN_CONTRAST = 4.5

const KID_PALETTE = new Set([
  '#1d4ed8',
  '#9a3412',
  '#c2410c',
  '#a16207',
  '#15803d',
  '#0f766e',
  '#6d28d9',
  '#991b1b',
  '#dc2626',
  '#fbbf24',
  '#faf8f5',
  '#1e1b18',
])

function expectKidInk(ink: string, bg: string) {
  expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  expect(KID_PALETTE.has(ink)).toBe(true)
}

describe('eyedropper-derive', () => {
  it('light blue background yields warm orange or gold ink', () => {
    const bg = '#93c5fd'
    const ink = deriveSmartInkFromBackground(bg)
    expectKidInk(ink, bg)
    expect(['#991b1b', '#9a3412', '#c2410c', '#dc2626']).toContain(ink)
  })

  it('white page yields blue teacher pen (not brown)', () => {
    const ink = deriveSmartInkFromBackground('#ffffff')
    expectKidInk(ink, '#ffffff')
    expect(ink).toBe('#1d4ed8')
  })

  it('dark navy background yields bright gold or cream highlighter', () => {
    const bg = '#1e293b'
    const ink = deriveSmartInkFromBackground(bg)
    expectKidInk(ink, bg)
    expect(['#fbbf24', '#faf8f5']).toContain(ink)
  })

  it('light gray paper yields vivid palette ink (not brown)', () => {
    const bg = '#e5e5e5'
    const ink = deriveSmartInkFromBackground(bg)
    expectKidInk(ink, bg)
    const h = hexToHsl(ink)!.h
    const isBrownBand = h >= 18 && h <= 42 && hexToHsl(ink)!.l < 0.45
    expect(isBrownBand).toBe(false)
  })

  it('contrastRatio is symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#000000'), 5)
  })
})
