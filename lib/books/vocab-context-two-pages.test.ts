import { describe, expect, it } from 'vitest'
import { pdfTwoPageWindowForVocabPart, resolveVocabPartPdfWindow } from '@/lib/books/vocab-context-two-pages'
import type { BookRecord, BookUnitRecord } from '@/lib/books/types'

function fixtureBookWithUnit(unit: BookUnitRecord): BookRecord {
  return {
    id: 'book-1',
    title: 'Book 1',
    pageAlignmentByFile: {
      [unit.filePath]: {
        notCountedPdfPages: [3],
        hiddenPdfPages: [1, 5],
      },
    },
    units: [unit],
  }
}

describe('pdfTwoPageWindowForVocabPart', () => {
  it('uses start and start+1 when end missing', () => {
    expect(pdfTwoPageWindowForVocabPart(10, undefined)).toEqual({ start: 10, end: 11 })
  })

  it('uses start and end when span is two pages', () => {
    expect(pdfTwoPageWindowForVocabPart(10, 11)).toEqual({ start: 10, end: 11 })
  })

  it('clamps to first two pages when span is wider', () => {
    expect(pdfTwoPageWindowForVocabPart(10, 20)).toEqual({ start: 10, end: 11 })
  })

  it('defaults when hints missing', () => {
    expect(pdfTwoPageWindowForVocabPart(undefined, undefined)).toEqual({ start: 1, end: 2 })
  })
})

describe('resolveVocabPartPdfWindow', () => {
  const unit: BookUnitRecord = {
    id: 'u1',
    title: 'Unit 1',
    filePath: 'book-library/book-1/unit-1.pdf',
    pdfPageRange: { start: 1, end: 10 },
  }
  const book = fixtureBookWithUnit(unit)

  it('maps effective hints to PDF indices before building the window', () => {
    expect(resolveVocabPartPdfWindow(3, undefined, book, unit, 10)).toEqual({ start: 4, end: 5 })
  })

  it('falls back to naive window when total page count is unknown', () => {
    expect(resolveVocabPartPdfWindow(10, undefined, book, unit, null)).toEqual({ start: 10, end: 11 })
  })
})
