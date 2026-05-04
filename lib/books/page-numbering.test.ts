import { describe, expect, it } from 'vitest'
import {
  formatEffectivePageSpan,
  mapPdfPageToDisplayLabel,
  mapPdfSpreadToDisplayLabel,
  resolveAlignedAnchorPage,
} from '@/lib/books/page-numbering'
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

describe('page-numbering helpers', () => {
  const unit: BookUnitRecord = {
    id: 'u1',
    title: 'Unit 1',
    filePath: 'book-library/book-1/unit-1.pdf',
    pdfPageRange: { start: 1, end: 10 },
  }
  const book = fixtureBookWithUnit(unit)

  it('maps to effective labels by default and keeps original when requested', () => {
    expect(mapPdfPageToDisplayLabel(2, book, unit, 10)).toBe('2')
    expect(mapPdfPageToDisplayLabel(3, book, unit, 10)).toBe('·')
    expect(mapPdfPageToDisplayLabel(3, book, unit, 10, 'original')).toBe('3')
  })

  it('builds spread labels in mapped mode', () => {
    expect(mapPdfSpreadToDisplayLabel(2, 4, false, book, unit, 10)).toBe('2-3')
    expect(mapPdfSpreadToDisplayLabel(2, 4, false, book, unit, 10, 'original')).toBe('2-4')
  })

  it('resolves aligned anchors with optional original fallback', () => {
    expect(resolveAlignedAnchorPage(3, book, unit, 10)).toBe(4)
    expect(resolveAlignedAnchorPage(3, book, unit, 10, 'original')).toBe(3)
  })

  it('formats effective spans without treating hints as PDF indices', () => {
    expect(formatEffectivePageSpan(2, 4, book, unit, 10)).toBe('p2-4')
    expect(formatEffectivePageSpan(2, 4, book, unit, 10, 'original')).toBe('p2-6')
  })
})

