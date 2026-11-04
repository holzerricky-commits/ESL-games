import { describe, expect, it } from 'vitest'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  __setResolvedPdfDocumentForTests,
  clearPdfLoadCacheForFileUrl,
  peekCachedPdfDocument,
} from './pdf-thumbnail-cache'

describe('peekCachedPdfDocument', () => {
  it('returns null when the URL has not been loaded', () => {
    expect(peekCachedPdfDocument('/files/missing.pdf')).toBeNull()
  })

  it('returns a settled doc after it is seeded', () => {
    const fileUrl = '/files/warm-unit.pdf'
    const doc = { numPages: 10 } as PDFDocumentProxy
    __setResolvedPdfDocumentForTests(fileUrl, doc)
    expect(peekCachedPdfDocument(fileUrl)).toBe(doc)
    clearPdfLoadCacheForFileUrl(fileUrl)
    expect(peekCachedPdfDocument(fileUrl)).toBeNull()
  })
})
