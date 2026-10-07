import type { PdfPageTextRun } from '@/lib/books/pdf-page-text-geometry'
import type { OcrWordBox } from '@/lib/books/searchable-pdf-text-layer'
import { winAnsiSafePdfText } from '@/lib/books/searchable-pdf-text-layer'

export const SEARCHABLE_OCR_BOXES_VERSION = 1 as const

/** On-disk OCR select boxes for one PDF page (normalized 0–1, top-left). */
export type SearchableOcrBoxesFile = {
  version: typeof SEARCHABLE_OCR_BOXES_VERSION
  pdfPage: number
  words: Array<{
    text: string
    x: number
    y: number
    w: number
    h: number
  }>
}

/**
 * Map OCR image-pixel boxes to page-normalized select runs.
 * These are the printed boxes — not Helvetica glyph metrics.
 */
export function ocrWordsToSelectRuns(
  words: readonly OcrWordBox[],
  imageWidth: number,
  imageHeight: number,
): PdfPageTextRun[] {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return []
  const runs: PdfPageTextRun[] = []
  let index = 0
  for (const word of words) {
    const text = winAnsiSafePdfText(word.text)
    if (!text) continue
    const boxW = word.x1 - word.x0
    const boxH = word.y1 - word.y0
    if (!(boxW > 1) || !(boxH > 1)) continue
    const x = word.x0 / imageWidth
    const y = word.y0 / imageHeight
    const w = boxW / imageWidth
    const h = boxH / imageHeight
    if (!(w > 0) || !(h > 0)) continue
    if (x >= 1 || y >= 1) continue
    runs.push({
      index,
      text,
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      w: Math.max(0, Math.min(1 - Math.max(0, x), w)),
      h: Math.max(0, Math.min(1 - Math.max(0, y), h)),
    })
    index += 1
  }
  return runs
}

export function buildSearchableOcrBoxesFile(
  pdfPage: number,
  words: readonly OcrWordBox[],
  imageWidth: number,
  imageHeight: number,
): SearchableOcrBoxesFile {
  const runs = ocrWordsToSelectRuns(words, imageWidth, imageHeight)
  return {
    version: SEARCHABLE_OCR_BOXES_VERSION,
    pdfPage: Math.max(1, Math.floor(pdfPage)),
    words: runs.map(({ text, x, y, w, h }) => ({ text, x, y, w, h })),
  }
}

export function parseSearchableOcrBoxesFile(raw: unknown): SearchableOcrBoxesFile | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.version !== SEARCHABLE_OCR_BOXES_VERSION) return null
  if (typeof obj.pdfPage !== 'number' || !Number.isFinite(obj.pdfPage)) return null
  if (!Array.isArray(obj.words)) return null
  const words: SearchableOcrBoxesFile['words'] = []
  for (const item of obj.words) {
    if (!item || typeof item !== 'object') continue
    const w = item as Record<string, unknown>
    if (typeof w.text !== 'string' || !w.text.trim()) continue
    if (typeof w.x !== 'number' || typeof w.y !== 'number') continue
    if (typeof w.w !== 'number' || typeof w.h !== 'number') continue
    if (!(w.w > 0) || !(w.h > 0)) continue
    words.push({ text: w.text, x: w.x, y: w.y, w: w.w, h: w.h })
  }
  return {
    version: SEARCHABLE_OCR_BOXES_VERSION,
    pdfPage: Math.floor(obj.pdfPage),
    words,
  }
}

export function searchableOcrBoxesToRuns(file: SearchableOcrBoxesFile): PdfPageTextRun[] {
  return file.words.map((word, index) => ({
    index,
    text: word.text,
    x: word.x,
    y: word.y,
    w: word.w,
    h: word.h,
  }))
}
