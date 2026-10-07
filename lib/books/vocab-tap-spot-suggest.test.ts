import { describe, expect, it } from 'vitest'
import { suggestTapSpotOnPage, suggestTapSpots } from '@/lib/books/vocab-tap-spot-suggest'
import type { PdfPageTextRun } from '@/lib/books/pdf-page-text-geometry'

const runs: PdfPageTextRun[] = [
  { index: 0, text: 'The', x: 0.05, y: 0.1, w: 0.08, h: 0.03 },
  { index: 1, text: 'athlete', x: 0.15, y: 0.1, w: 0.12, h: 0.03 },
  { index: 2, text: 'ran', x: 0.29, y: 0.1, w: 0.06, h: 0.03 },
  { index: 3, text: 'fast.', x: 0.37, y: 0.1, w: 0.08, h: 0.03 },
]

describe('suggestTapSpotOnPage', () => {
  it('finds a single-run word and returns its bounding box', () => {
    const spot = suggestTapSpotOnPage(runs, 5, 'athlete')
    expect(spot).not.toBeNull()
    expect(spot!.pdfPage).toBe(5)
    expect(spot!.x).toBeCloseTo(0.15)
    expect(spot!.y).toBeCloseTo(0.1)
    expect(spot!.w).toBeCloseTo(0.12)
    expect(spot!.h).toBeCloseTo(0.03)
  })

  it('returns null for a word not on the page', () => {
    expect(suggestTapSpotOnPage(runs, 1, 'basketball')).toBeNull()
  })

  it('respects word boundaries', () => {
    expect(suggestTapSpotOnPage(runs, 1, 'the')).not.toBeNull()
    expect(suggestTapSpotOnPage(runs, 1, 'th')).toBeNull()
  })

  it('returns null for empty inputs', () => {
    expect(suggestTapSpotOnPage([], 1, 'test')).toBeNull()
    expect(suggestTapSpotOnPage(runs, 1, '')).toBeNull()
  })
})

describe('suggestTapSpots', () => {
  it('maps words to the first page where they appear', () => {
    const page1Runs: PdfPageTextRun[] = [
      { index: 0, text: 'Hello', x: 0.1, y: 0.1, w: 0.1, h: 0.03 },
    ]
    const page2Runs: PdfPageTextRun[] = [
      { index: 0, text: 'World', x: 0.2, y: 0.2, w: 0.1, h: 0.03 },
    ]

    const result = suggestTapSpots(
      [
        { pdfPage: 3, runs: page1Runs },
        { pdfPage: 4, runs: page2Runs },
      ],
      [
        { id: 'w1', word: 'Hello' },
        { id: 'w2', word: 'World' },
        { id: 'w3', word: 'Missing' },
      ],
    )

    expect(result.size).toBe(2)
    expect(result.get('w1')!.pdfPage).toBe(3)
    expect(result.get('w2')!.pdfPage).toBe(4)
    expect(result.has('w3')).toBe(false)
  })
})
