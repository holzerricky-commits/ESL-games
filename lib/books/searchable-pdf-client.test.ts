import { describe, expect, it } from 'vitest'
import { deriveSearchablePdfRangeStatus } from '@/lib/books/searchable-pdf-client'
import type { SearchablePagePlanItem } from '@/lib/books/searchable-pdf-types'

function pagesToOcr(pages: SearchablePagePlanItem[], force: boolean) {
  return pages.filter((p) =>
    force ? p.action === 'ocr' || p.action === 'skip-done' : p.action === 'ocr',
  )
}

describe('deriveSearchablePdfRangeStatus', () => {
  it('returns needs-ocr when any page needs OCR', () => {
    const pages: SearchablePagePlanItem[] = [
      { pdfPage: 1, action: 'skip-done' },
      { pdfPage: 2, action: 'ocr' },
    ]
    expect(deriveSearchablePdfRangeStatus(pages)).toBe('needs-ocr')
  })

  it('returns stamped when all remaining are skip-done', () => {
    const pages: SearchablePagePlanItem[] = [
      { pdfPage: 1, action: 'skip-done' },
      { pdfPage: 2, action: 'skip-done' },
    ]
    expect(deriveSearchablePdfRangeStatus(pages)).toBe('stamped')
  })

  it('returns stamped when mix of skip-done and native text', () => {
    const pages: SearchablePagePlanItem[] = [
      { pdfPage: 1, action: 'skip-done' },
      { pdfPage: 2, action: 'skip-has-text' },
    ]
    expect(deriveSearchablePdfRangeStatus(pages)).toBe('stamped')
  })

  it('returns native-text when only skip-has-text', () => {
    const pages: SearchablePagePlanItem[] = [
      { pdfPage: 1, action: 'skip-has-text' },
      { pdfPage: 2, action: 'skip-has-text' },
    ]
    expect(deriveSearchablePdfRangeStatus(pages)).toBe('native-text')
  })

  it('returns empty for no pages', () => {
    expect(deriveSearchablePdfRangeStatus([])).toBe('empty')
  })
})

describe('force OCR queue', () => {
  it('queues skip-done when force is true, not skip-has-text', () => {
    const pages: SearchablePagePlanItem[] = [
      { pdfPage: 1, action: 'skip-done' },
      { pdfPage: 2, action: 'skip-has-text' },
      { pdfPage: 3, action: 'ocr' },
    ]
    expect(pagesToOcr(pages, true).map((p) => p.pdfPage)).toEqual([1, 3])
    expect(pagesToOcr(pages, false).map((p) => p.pdfPage)).toEqual([3])
  })
})
