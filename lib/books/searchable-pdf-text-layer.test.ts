import { describe, expect, it } from 'vitest'
import {
  HELVETICA_DESCENDER_RATIO,
  groupWordsIntoLines,
  lineFontSizeFromHeight,
  mapOcrLineToPdfText,
  mapOcrWordToPdfText,
  ocrLinePlainText,
  shouldStampLineAsUnit,
  winAnsiSafePdfText,
  type OcrLine,
} from '@/lib/books/searchable-pdf-text-layer'

describe('winAnsiSafePdfText', () => {
  it('keeps plain English', () => {
    expect(winAnsiSafePdfText('The fox jumps')).toBe('The fox jumps')
  })

  it('maps curly quotes and dashes', () => {
    expect(winAnsiSafePdfText('\u201CHello\u201D\u2014it\u2019s fine')).toBe('"Hello"-it\'s fine')
  })

  it('keeps accented Latin-1 characters', () => {
    expect(winAnsiSafePdfText('caf\u00E9')).toBe('caf\u00E9')
    expect(winAnsiSafePdfText('na\u00EFve')).toBe('na\u00EFve')
    expect(winAnsiSafePdfText('\u00FCber')).toBe('\u00FCber')
  })

  it('drops characters outside Latin-1', () => {
    expect(winAnsiSafePdfText('\u4F60\u597D')).toBe('')
  })

  it('maps guillemets to double quotes', () => {
    expect(winAnsiSafePdfText('\u00ABbonjour\u00BB')).toBe('"bonjour"')
  })
})

describe('groupWordsIntoLines', () => {
  it('groups words with similar baselines into one line', () => {
    const words = [
      { text: 'The', x0: 10, y0: 100, x1: 60, y1: 130 },
      { text: 'cat', x0: 70, y0: 102, x1: 120, y1: 131 },
      { text: 'sat', x0: 130, y0: 101, x1: 180, y1: 130 },
    ]
    const lines = groupWordsIntoLines(words)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.words.map((w) => w.text)).toEqual(['The', 'cat', 'sat'])
  })

  it('splits words on different baselines into separate lines', () => {
    const words = [
      { text: 'Top', x0: 10, y0: 10, x1: 60, y1: 40 },
      { text: 'line', x0: 70, y0: 12, x1: 120, y1: 42 },
      { text: 'Bottom', x0: 10, y0: 200, x1: 100, y1: 230 },
    ]
    const lines = groupWordsIntoLines(words)
    expect(lines).toHaveLength(2)
    expect(lines[0]!.words.map((w) => w.text)).toEqual(['Top', 'line'])
    expect(lines[1]!.words.map((w) => w.text)).toEqual(['Bottom'])
  })

  it('returns empty for no words', () => {
    expect(groupWordsIntoLines([])).toEqual([])
  })
})

describe('lineFontSizeFromHeight', () => {
  it('scales line height to PDF points', () => {
    const size = lineFontSizeFromHeight(30, 1000, 500)
    expect(size).toBeCloseTo(15 * 0.85)
  })

  it('respects minimum font size', () => {
    const size = lineFontSizeFromHeight(1, 1000, 500)
    expect(size).toBe(4)
  })
})

describe('shouldStampLineAsUnit', () => {
  it('accepts a normal multi-word line', () => {
    const line: OcrLine = {
      words: [
        { text: 'Once', x0: 10, y0: 80, x1: 60, y1: 100 },
        { text: 'upon', x0: 70, y0: 80, x1: 120, y1: 100 },
        { text: 'a', x0: 130, y0: 80, x1: 145, y1: 100 },
        { text: 'time', x0: 155, y0: 80, x1: 210, y1: 100 },
      ],
      baseline: 100,
      lineHeight: 20,
    }
    expect(shouldStampLineAsUnit(line)).toBe(true)
    expect(ocrLinePlainText(line)).toBe('Once upon a time')
  })

  it('rejects a single-word line', () => {
    const line: OcrLine = {
      words: [{ text: 'Hello', x0: 10, y0: 80, x1: 80, y1: 100 }],
      baseline: 100,
      lineHeight: 20,
    }
    expect(shouldStampLineAsUnit(line)).toBe(false)
  })

  it('rejects a line with a huge gap (columns)', () => {
    const line: OcrLine = {
      words: [
        { text: 'Left', x0: 10, y0: 80, x1: 50, y1: 100 },
        { text: 'Right', x0: 400, y0: 80, x1: 460, y1: 100 },
      ],
      baseline: 100,
      lineHeight: 20,
    }
    expect(shouldStampLineAsUnit(line)).toBe(false)
  })
})

describe('mapOcrLineToPdfText', () => {
  it('sizes by line height and stretches width with horizontalScale', () => {
    const line: OcrLine = {
      words: [
        { text: 'Once', x0: 100, y0: 200, x1: 180, y1: 240 },
        { text: 'upon', x0: 200, y0: 200, x1: 280, y1: 240 },
      ],
      baseline: 240,
      lineHeight: 40,
    }
    const placement = mapOcrLineToPdfText({
      line,
      imageWidth: 1000,
      imageHeight: 1000,
      pageWidth: 500,
      pageHeight: 500,
      textWidthAtSize1: 20,
      descenderRatio: HELVETICA_DESCENDER_RATIO,
    })
    expect(placement).not.toBeNull()
    expect(placement!.text).toBe('Once upon')
    expect(placement!.x).toBeCloseTo(50)
    // box height image 40 → pdf 20; size = 20 * 0.85
    expect(placement!.size).toBeCloseTo(17)
    // box width image 180 → pdf 90; natural width 20*17=340 → scale 90/340
    expect(placement!.horizontalScale).toBeCloseTo(90 / 340)
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
    const boxHeight = 20
    const size = boxHeight * 0.85
    expect(placement!.size).toBeCloseTo(size)
    // box width pdf 100; natural 10*size → stretch to cover word box
    expect(placement!.horizontalScale).toBeCloseTo(100 / (10 * size))
    expect(placement!.y).toBeCloseTo(380 - HELVETICA_DESCENDER_RATIO * size)
  })

  it('uses shared lineFontSize and stretches to word width', () => {
    const placement = mapOcrWordToPdfText({
      word: { text: 'dog', x0: 100, y0: 200, x1: 300, y1: 240 },
      imageWidth: 1000,
      imageHeight: 1000,
      pageWidth: 500,
      pageHeight: 500,
      textWidthAtSize1: 10,
      lineFontSize: 14,
    })
    expect(placement).not.toBeNull()
    expect(placement!.size).toBeCloseTo(14)
    expect(placement!.horizontalScale).toBeCloseTo(100 / (10 * 14))
  })

  it('returns null for empty sanitized text', () => {
    expect(
      mapOcrWordToPdfText({
        word: { text: '\u4F60\u597D', x0: 0, y0: 0, x1: 40, y1: 20 },
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
