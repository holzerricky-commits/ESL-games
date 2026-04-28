import { describe, expect, it } from 'vitest'
import {
  normalizeNotCountedPdfPages,
  pdfPageToPrintedPage,
  printedPageToPdfPage,
} from '@/lib/books/page-alignment'

describe('page alignment', () => {
  it('normalizes and sorts ignored pages', () => {
    expect(normalizeNotCountedPdfPages([9, 3, 3, 0, 999], 20)).toEqual([3, 9])
  })

  it('maps printed pages to PDF pages with cover and ignored pages', () => {
    const ignored = [8, 9]
    expect(printedPageToPdfPage(1, ignored, 30)).toBe(2)
    expect(printedPageToPdfPage(6, ignored, 30)).toBe(7)
    expect(printedPageToPdfPage(7, ignored, 30)).toBe(10)
  })

  it('maps PDF pages back to printed pages', () => {
    const ignored = [8, 9]
    expect(pdfPageToPrintedPage(2, ignored)).toBe(1)
    expect(pdfPageToPrintedPage(10, ignored)).toBe(7)
    expect(pdfPageToPrintedPage(9, ignored)).toBeNull()
  })
})
