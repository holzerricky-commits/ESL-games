import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildSearchableOcrBoxesFile,
  ocrWordsToSelectRuns,
  parseSearchableOcrBoxesFile,
  searchableOcrBoxesToRuns,
} from '@/lib/books/searchable-ocr-boxes'
import { searchableOcrBoxesAbsolutePath, SEARCHABLE_PDF_DIR } from '@/lib/books/searchable-pdf-path'

describe('ocrWordsToSelectRuns', () => {
  it('normalizes OCR pixel boxes to 0–1 page coords', () => {
    const runs = ocrWordsToSelectRuns(
      [{ text: 'Bald', x0: 100, y0: 200, x1: 200, y1: 240 }],
      1000,
      1000,
    )
    expect(runs).toHaveLength(1)
    expect(runs[0]!.text).toBe('Bald')
    expect(runs[0]!.x).toBeCloseTo(0.1)
    expect(runs[0]!.y).toBeCloseTo(0.2)
    expect(runs[0]!.w).toBeCloseTo(0.1)
    expect(runs[0]!.h).toBeCloseTo(0.04)
  })

  it('skips empty sanitized text', () => {
    const runs = ocrWordsToSelectRuns(
      [{ text: '\u4F60\u597D', x0: 0, y0: 0, x1: 40, y1: 20 }],
      200,
      200,
    )
    expect(runs).toHaveLength(0)
  })
})

describe('parseSearchableOcrBoxesFile', () => {
  it('round-trips build output', () => {
    const built = buildSearchableOcrBoxesFile(
      3,
      [{ text: 'eagles', x0: 10, y0: 20, x1: 110, y1: 50 }],
      500,
      800,
    )
    const parsed = parseSearchableOcrBoxesFile(built)
    expect(parsed).not.toBeNull()
    expect(parsed!.pdfPage).toBe(3)
    expect(searchableOcrBoxesToRuns(parsed!).map((r) => r.text)).toEqual(['eagles'])
  })

  it('rejects wrong version', () => {
    expect(parseSearchableOcrBoxesFile({ version: 99, pdfPage: 1, words: [] })).toBeNull()
  })
})

describe('searchableOcrBoxesAbsolutePath', () => {
  it('names the boxes file next to the searchable PDF', () => {
    const original = path.join('book-library', 'foo', 'unit-3.pdf')
    const boxes = searchableOcrBoxesAbsolutePath(original, 4)
    expect(path.basename(path.dirname(boxes))).toBe(SEARCHABLE_PDF_DIR)
    expect(path.basename(boxes)).toBe('unit-3.p4.boxes.json')
  })
})
