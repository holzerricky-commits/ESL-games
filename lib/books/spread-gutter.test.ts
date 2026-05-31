import { describe, expect, it } from 'vitest'
import type { BookRecord } from '@/lib/books/types'
import {
  bookSpreadGutterPullRatioForSave,
  buildSpreadGutterByFileForSave,
  DEFAULT_SPREAD_GUTTER_PULL_RATIO,
  resolveSpreadGutterPullRatio,
  spreadSidePullPx,
} from '@/lib/books/spread-gutter'

const book: BookRecord = {
  id: 'b1',
  title: 'Test',
  spreadGutterPullRatio: 0.025,
  spreadGutterByFile: { 'book-library/a/unit1.pdf': 0.04 },
  units: [{ id: 'u1', title: 'U1', filePath: 'book-library/a/unit1.pdf' }],
}

describe('resolveSpreadGutterPullRatio', () => {
  it('uses file override when present', () => {
    expect(resolveSpreadGutterPullRatio(book, 'book-library/a/unit1.pdf')).toBe(0.04)
  })

  it('uses book default when no file override', () => {
    expect(resolveSpreadGutterPullRatio(book, 'book-library/a/unit2.pdf')).toBe(0.025)
  })

  it('uses global default when book unset', () => {
    expect(resolveSpreadGutterPullRatio(null, 'x.pdf')).toBe(DEFAULT_SPREAD_GUTTER_PULL_RATIO)
  })

  it('clamps out-of-range values', () => {
    const loud: BookRecord = {
      ...book,
      spreadGutterPullRatio: 0.5,
      spreadGutterByFile: { 'book-library/a/unit1.pdf': -1 },
    }
    expect(resolveSpreadGutterPullRatio(loud, 'book-library/a/unit1.pdf')).toBe(0)
    expect(resolveSpreadGutterPullRatio(loud, 'other.pdf')).toBe(0.2)
  })
})

describe('spreadSidePullPx', () => {
  it('scales pull by page width and ratio', () => {
    expect(spreadSidePullPx(400, DEFAULT_SPREAD_GUTTER_PULL_RATIO)).toBe(Math.round(400 * 0.018))
  })
})

describe('buildSpreadGutterByFileForSave', () => {
  it('removes key when override disabled', () => {
    expect(
      buildSpreadGutterByFileForSave(
        { 'book-library/a/unit1.pdf': 0.04 },
        'book-library/a/unit1.pdf',
        0.025,
        false,
        0.04,
      ),
    ).toBeUndefined()
  })

  it('omits file entry when override equals book default', () => {
    expect(
      buildSpreadGutterByFileForSave(
        { 'book-library/a/unit1.pdf': 0.04 },
        'book-library/a/unit1.pdf',
        0.025,
        true,
        0.025,
      ),
    ).toBeUndefined()
  })

  it('keeps distinct override', () => {
    expect(
      buildSpreadGutterByFileForSave(undefined, 'book-library/a/unit1.pdf', 0.025, true, 0.04),
    ).toEqual({ 'book-library/a/unit1.pdf': 0.04 })
  })
})

describe('bookSpreadGutterPullRatioForSave', () => {
  it('omits default ratio', () => {
    expect(bookSpreadGutterPullRatioForSave(DEFAULT_SPREAD_GUTTER_PULL_RATIO)).toBeUndefined()
  })

  it('keeps non-default ratio', () => {
    expect(bookSpreadGutterPullRatioForSave(0.03)).toBe(0.03)
  })
})
