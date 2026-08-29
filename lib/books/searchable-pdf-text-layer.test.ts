import { describe, expect, it } from 'vitest'
import {
  HELVETICA_DESCENDER_RATIO,
  mapOcrWordToPdfText,
  winAnsiSafePdfText,
} from '@/lib/books/searchable-pdf-text-layer'

describe('winAnsiSafePdfText', () => {
  it('keeps plain English', () => {
    expect(winAnsiSafePdfText('The fox jumps')).toBe('The fox jumps')
  })

  it('maps curly quotes and dashes', () => {
    expect(winAnsiSafePdfText('“Hello”—it’s fine')).toBe('"Hello"-it\'s fine')
  })

  it('drops unsupported glyphs', () => {
    expect(winAnsiSafePdfText('café')).toBe('caf')
  })
})

describe('mapOcrWordToPdfText', () => {
  it('flips Y from image top-left into PDF bottom-left', () => {
    const placement = mapOcrWordToPdfText({
      word: { text: 'cat', x0: 100, y0: 200, x1: 300, y1: 240 },
      imageWidth: 1000,
      imageHeight: 1000,
      pageWidth: 500,
      pageHeight: 500,
      textWidthAtSize1: 10,
      descenderRatio: HELVETICA_DESCENDER_RATIO,
    })
    expect(placement).not.toBeNull()
    expect(placement!.text).toBe('cat')
    expect(placement!.x).toBeCloseTo(50)
    // Image y1=240 → PDF bottom = 500 - 120 = 380, then descender lift.
    const boxHeight = 20
    const sizeFromHeight = boxHeight * 0.85
    const sizeFromWidth = 100 / 10
    const size = Math.min(sizeFromWidth, sizeFromHeight)
    expect(placement!.size).toBeCloseTo(size)
    expect(placement!.y).toBeCloseTo(380 - HELVETICA_DESCENDER_RATIO * size)
  })

  it('returns null for empty sanitized text', () => {
    expect(
      mapOcrWordToPdfText({
        word: { text: '你好', x0: 0, y0: 0, x1: 40, y1: 20 },
        imageWidth: 200,
        imageHeight: 200,
        pageWidth: 100,
        pageHeight: 100,
        textWidthAtSize1: 1,
      }),
    ).toBeNull()
  })

  it('returns null for a degenerate box', () => {
    expect(
      mapOcrWordToPdfText({
        word: { text: 'hi', x0: 10, y0: 10, x1: 10, y1: 12 },
        imageWidth: 200,
        imageHeight: 200,
        pageWidth: 100,
        pageHeight: 100,
        textWidthAtSize1: 1,
      }),
    ).toBeNull()
  })
})
