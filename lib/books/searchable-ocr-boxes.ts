import type { PdfPageTextRun } from '@/lib/books/pdf-page-text-geometry'
import { filterSelectableOcrWords } from '@/lib/books/searchable-pdf-body-text'
import type { OcrWordBox } from '@/lib/books/searchable-pdf-text-layer'
import { groupWordsIntoLines, winAnsiSafePdfText } from '@/lib/books/searchable-pdf-text-layer'

/** Extra space above and below each line, as a fraction of its height. */
const LINE_PAD_RATIO = 0.12
/** Words closer than this × line height share the gap (no dead zone between them). */
const WORD_GAP_FILL_RATIO = 1.2
/** Words taller than this × line height (drop caps, titles on the same baseline) keep their own box. */
const LINE_NORMAL_HEIGHT_RATIO = 1.5

/**
 * Select boxes in reading order (lines top to bottom, words left to right).
 * Every word on a line gets the same top and bottom, and small gaps between
 * words are split at the midpoint so a click between two words still lands.
 */
export function buildSelectWordBoxes(words: readonly OcrWordBox[]): OcrWordBox[] {
  const selectable = filterSelectableOcrWords(words)
    .map((word) => ({ ...word, text: winAnsiSafePdfText(word.text) }))
    .filter((word) => word.text)
  const lines = groupWordsIntoLines(selectable).sort((a, b) => a.baseline - b.baseline)
  const out: OcrWordBox[] = []
  for (const line of lines) {
    const lineHeight = line.lineHeight > 0 ? line.lineHeight : 1
    const normal = line.words.filter((w) => w.y1 - w.y0 <= lineHeight * LINE_NORMAL_HEIGHT_RATIO)
    const top = Math.min(...(normal.length ? normal : line.words).map((w) => w.y0))
    const bottom = Math.max(...(normal.length ? normal : line.words).map((w) => w.y1))
    const pad = lineHeight * LINE_PAD_RATIO
    const padded = line.words.map((w) => ({
      ...w,
      y0: Math.max(0, Math.min(w.y0, top) - pad),
      y1: Math.max(w.y1, bottom) + pad,
    }))
    for (let i = 0; i + 1 < padded.length; i++) {
      const left = padded[i]!
      const right = padded[i + 1]!
      const gap = right.x0 - left.x1
      if (gap > 0 && gap <= lineHeight * WORD_GAP_FILL_RATIO) {
        const mid = left.x1 + gap / 2
        left.x1 = mid
        right.x0 = mid
      }
    }
    out.push(...padded)
  }
  return out
}

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
