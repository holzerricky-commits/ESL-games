import { describe, expect, it } from 'vitest'
import {
  clearPdfPageTextProbeCacheForTests,
  invalidatePdfPageTextProbeCacheForFileUrl,
  pdfTextItemsHaveSelectableText,
  PDF_PAGE_SELECTABLE_TEXT_MIN_CHARS,
} from '@/lib/books/pdf-page-text-probe'
import type { PdfTextItem } from '@/lib/books/toc-import'

function item(str: string, x: number, y: number): PdfTextItem {
  return { str, transform: [1, 0, 0, 1, x, y] }
}

describe('pdfTextItemsHaveSelectableText', () => {
  it('returns false for empty items', () => {
    expect(pdfTextItemsHaveSelectableText([])).toBe(false)
  })

  it('returns false when joined text is below threshold', () => {
    const short = 'x'.repeat(PDF_PAGE_SELECTABLE_TEXT_MIN_CHARS - 1)
    expect(pdfTextItemsHaveSelectableText([item(short, 0, 0)])).toBe(false)
  })

  it('returns true when joined text meets threshold', () => {
    const long = 'a'.repeat(PDF_PAGE_SELECTABLE_TEXT_MIN_CHARS)
    expect(pdfTextItemsHaveSelectableText([item(long, 0, 0)])).toBe(true)
  })

  it('merges multiple items on one line', () => {
    const parts = [
      'The quick brown fox jumps over the lazy dog near the river bank.',
    ]
    const items = parts.map((str, i) => item(str, i * 10, 100))
    expect(pdfTextItemsHaveSelectableText(items)).toBe(true)
  })
})

describe('probe cache', () => {
  it('clearPdfPageTextProbeCacheForTests does not throw', () => {
    expect(() => clearPdfPageTextProbeCacheForTests()).not.toThrow()
  })

  it('invalidatePdfPageTextProbeCacheForFileUrl does not throw', () => {
    expect(() => invalidatePdfPageTextProbeCacheForFileUrl('/api/book-file?path=x')).not.toThrow()
  })
})
