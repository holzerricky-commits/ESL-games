import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildSearchableOcrResultFile,
  parseSearchableOcrResultFile,
} from '@/lib/books/searchable-ocr-result'
import { searchableOcrResultAbsolutePath, SEARCHABLE_PDF_DIR } from '@/lib/books/searchable-pdf-path'

describe('searchable OCR result file', () => {
  it('round-trips words and image size', () => {
    const built = buildSearchableOcrResultFile({
      pdfPage: 7,
      imageWidth: 1800,
      imageHeight: 2400,
      source: 'cloud',
      words: [{ text: 'wolf', x0: 10, y0: 20, x1: 90, y1: 50 }],
    })
    const parsed = parseSearchableOcrResultFile(JSON.parse(JSON.stringify(built)))
    expect(parsed).toEqual(built)
  })

  it('rejects a file without an image size', () => {
    expect(
      parseSearchableOcrResultFile({ version: 1, pdfPage: 1, imageWidth: 0, imageHeight: 10, words: [] }),
    ).toBeNull()
  })

  it('names the OCR file next to the searchable PDF', () => {
    const original = path.join('book-library', 'foo', 'unit-3.pdf')
    const file = searchableOcrResultAbsolutePath(original, 4)
    expect(path.basename(path.dirname(file))).toBe(SEARCHABLE_PDF_DIR)
    expect(path.basename(file)).toBe('unit-3.p4.ocr.json')
  })
})
