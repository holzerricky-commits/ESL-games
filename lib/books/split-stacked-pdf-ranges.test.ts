import { describe, expect, it } from 'vitest'
import {
  bookHasDistinctUnitFiles,
  bookHasSingleSharedPdf,
  buildStackedPdfUnitRanges,
  unitPdfFileName,
} from '@/lib/books/split-stacked-pdf-ranges'

describe('buildStackedPdfUnitRanges', () => {
  it('maps starts to inclusive ranges', () => {
    const result = buildStackedPdfUnitRanges(
      [
        { title: 'Unit 1', startPage: 1 },
        { title: 'Unit 2', startPage: 100 },
        { title: 'Unit 3', startPage: 200 },
      ],
      250,
    )
    expect(result).toEqual({
      ok: true,
      ranges: [
        { title: 'Unit 1', startPage: 1, endPage: 99, index: 0 },
        { title: 'Unit 2', startPage: 100, endPage: 199, index: 1 },
        { title: 'Unit 3', startPage: 200, endPage: 250, index: 2 },
      ],
    })
  })

  it('allows a single unit spanning the whole file', () => {
    const result = buildStackedPdfUnitRanges([{ title: 'Whole', startPage: 1 }], 40)
    expect(result).toEqual({
      ok: true,
      ranges: [{ title: 'Whole', startPage: 1, endPage: 40, index: 0 }],
    })
  })

  it('fills blank titles', () => {
    const result = buildStackedPdfUnitRanges(
      [
        { title: '  ', startPage: 1 },
        { title: '', startPage: 10 },
      ],
      20,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.ranges.map((r) => r.title)).toEqual(['Unit 1', 'Unit 2'])
  })

  it('rejects when unit 1 does not start at 1', () => {
    const result = buildStackedPdfUnitRanges([{ title: 'U', startPage: 2 }], 10)
    expect(result.ok).toBe(false)
  })

  it('rejects duplicates and out-of-order starts', () => {
    expect(
      buildStackedPdfUnitRanges(
        [
          { title: 'A', startPage: 1 },
          { title: 'B', startPage: 5 },
          { title: 'C', startPage: 5 },
        ],
        20,
      ).ok,
    ).toBe(false)
    expect(
      buildStackedPdfUnitRanges(
        [
          { title: 'A', startPage: 1 },
          { title: 'B', startPage: 8 },
          { title: 'C', startPage: 4 },
        ],
        20,
      ).ok,
    ).toBe(false)
  })

  it('rejects starts past pageCount', () => {
    const result = buildStackedPdfUnitRanges(
      [
        { title: 'A', startPage: 1 },
        { title: 'B', startPage: 50 },
      ],
      40,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects empty cuts and bad pageCount', () => {
    expect(buildStackedPdfUnitRanges([], 10).ok).toBe(false)
    expect(buildStackedPdfUnitRanges([{ title: 'A', startPage: 1 }], 0).ok).toBe(false)
  })
})

describe('bookHasSingleSharedPdf / bookHasDistinctUnitFiles', () => {
  it('detects one shared path vs many', () => {
    expect(
      bookHasSingleSharedPdf({
        units: [
          { filePath: 'book-library/a/x.pdf' },
          { filePath: 'book-library/a/x.pdf' },
        ],
      }),
    ).toBe(true)
    expect(
      bookHasDistinctUnitFiles({
        units: [
          { filePath: 'book-library/a/unit-01.pdf' },
          { filePath: 'book-library/a/unit-02.pdf' },
        ],
      }),
    ).toBe(true)
    expect(bookHasSingleSharedPdf({ units: [{ filePath: 'book-library/a/unit-01.pdf' }] })).toBe(
      true,
    )
    expect(bookHasDistinctUnitFiles({ units: [{ filePath: 'book-library/a/x.pdf' }] })).toBe(false)
  })
})

describe('unitPdfFileName', () => {
  it('pads unit index', () => {
    expect(unitPdfFileName(0)).toBe('unit-01.pdf')
    expect(unitPdfFileName(9)).toBe('unit-10.pdf')
  })
})
