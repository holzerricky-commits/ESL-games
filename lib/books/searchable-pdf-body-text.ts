import type { OcrLine, OcrWordBox } from '@/lib/books/searchable-pdf-text-layer'

/** Keep words whose height is close to the page’s typical body size. */
export const BODY_HEIGHT_MIN_RATIO = 0.7
export const BODY_HEIGHT_MAX_RATIO = 1.35
const MIN_BOX_PX = 3
const TITLE_LINE_MAX_WORDS = 2
const TITLE_LINE_HEIGHT_RATIO = 1.4

function wordHeight(word: OcrWordBox): number {
  return word.y1 - word.y0
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function isGarbageWord(word: OcrWordBox): boolean {
  const h = wordHeight(word)
  const w = word.x1 - word.x0
  if (!(h > MIN_BOX_PX) || !(w > MIN_BOX_PX)) return true
  const text = word.text.trim()
  if (!text) return true
  if (text.length <= 2 && !/[A-Za-z]/.test(text)) return true
  return false
}

/**
 * Drop titles, captions, and junk so only body-sized words get stamped.
 * Uses the page median box height — not Gemini.
 */
export function filterBodyOcrWords<T extends OcrWordBox>(words: readonly T[]): T[] {
  const viable = words.filter((w) => !isGarbageWord(w))
  if (viable.length === 0) return []

  const medH = median(viable.map(wordHeight))
  if (!(medH > 0)) return [...viable]

  const lo = medH * BODY_HEIGHT_MIN_RATIO
  const hi = medH * BODY_HEIGHT_MAX_RATIO
  return viable.filter((w) => {
    const h = wordHeight(w)
    return h >= lo && h <= hi
  })
}

/**
 * Drop short, oversized lines (story titles) after grouping.
 * Body median is taken from lines that are not short+tall.
 */
export function filterDecorativeOcrLines(lines: readonly OcrLine[]): OcrLine[] {
  if (lines.length === 0) return []

  const bodyHeights = lines
    .filter((line) => line.words.length > TITLE_LINE_MAX_WORDS)
    .map((line) => line.lineHeight)
    .filter((h) => h > 0)
  const medBody = median(bodyHeights.length > 0 ? bodyHeights : lines.map((l) => l.lineHeight))
  if (!(medBody > 0)) return [...lines]

  return lines.filter((line) => {
    if (line.words.length > TITLE_LINE_MAX_WORDS) return true
    return line.lineHeight < medBody * TITLE_LINE_HEIGHT_RATIO
  })
}
