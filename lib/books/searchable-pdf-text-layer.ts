/** Tesseract-style box in image pixels, origin top-left, y down. */
export type OcrWordBox = {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

/** pdf-lib drawText placement, origin bottom-left, PDF points. */
export type PdfInvisibleTextPlacement = {
  text: string
  x: number
  y: number
  size: number
  /**
   * Stretch glyphs horizontally to the OCR box width (1 = no stretch).
   * Keeps font size tied to printed height so selection boxes match the scan.
   */
  horizontalScale: number
}

/** A group of words sharing the same baseline (visual line). */
export type OcrLine = {
  words: OcrWordBox[]
  /** Median baseline (y1) in image pixels. */
  baseline: number
  /** Median box height in image pixels. */
  lineHeight: number
}

/** Helvetica AFM descender / em (negative). */
export const HELVETICA_DESCENDER_RATIO = -0.207

const MIN_FONT_SIZE = 4
const HEIGHT_TO_SIZE = 0.85
/** Prefer line stamp when a line has at least this many words. */
export const LINE_STAMP_MIN_WORDS = 2
/**
 * If a gap between words exceeds this × median word width, treat as messy
 * (e.g. two columns) and fall back to per-word stamp.
 */
export const LINE_STAMP_MAX_GAP_RATIO = 3

/**
 * Max vertical gap (as fraction of median box height) for two words
 * to be considered on the same line.
 */
const BASELINE_TOLERANCE_RATIO = 0.35

/**
 * Map curly quotes and dashes to WinAnsi-safe equivalents.
 * Keeps accented Latin-1 characters (é, ñ, ü, etc.) that WinAnsi supports.
 */
export function winAnsiSafePdfText(raw: string): string {
  return raw
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/**
 * Group OCR words into lines by baseline proximity.
 * Words whose y1 (baseline) values are within `BASELINE_TOLERANCE_RATIO × median height`
 * of each other are grouped into the same line.
 */
export function groupWordsIntoLines(words: OcrWordBox[]): OcrLine[] {
  if (words.length === 0) return []

  const sorted = [...words].sort((a, b) => a.y1 - b.y1 || a.x0 - b.x0)
  const allHeights = sorted.map((w) => w.y1 - w.y0).filter((h) => h > 0)
  const medH = median(allHeights) || 20
  const tolerance = medH * BASELINE_TOLERANCE_RATIO

  const lines: OcrLine[] = []
  let currentWords: OcrWordBox[] = [sorted[0]!]
  let currentBaseline = sorted[0]!.y1

  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i]!
    if (Math.abs(w.y1 - currentBaseline) <= tolerance) {
      currentWords.push(w)
    } else {
      const heights = currentWords.map((cw) => cw.y1 - cw.y0)
      lines.push({
        words: currentWords.sort((a, b) => a.x0 - b.x0),
        baseline: median(currentWords.map((cw) => cw.y1)),
        lineHeight: median(heights),
      })
      currentWords = [w]
      currentBaseline = w.y1
    }
  }
  const heights = currentWords.map((cw) => cw.y1 - cw.y0)
  lines.push({
    words: currentWords.sort((a, b) => a.x0 - b.x0),
    baseline: median(currentWords.map((cw) => cw.y1)),
    lineHeight: median(heights),
  })

  return lines
}

/** Join sanitized OCR words into one line string (spaces between). */
export function ocrLinePlainText(line: OcrLine): string {
  const parts: string[] = []
  for (const w of line.words) {
    const t = winAnsiSafePdfText(w.text)
    if (t) parts.push(t)
  }
  return parts.join(' ')
}

/**
 * True when the line should be stamped as one stretchable string.
 * Short or gappy lines fall back to per-word boxes.
 */
export function shouldStampLineAsUnit(line: OcrLine): boolean {
  if (line.words.length < LINE_STAMP_MIN_WORDS) return false
  const widths = line.words.map((w) => w.x1 - w.x0).filter((w) => w > 0)
  const medW = median(widths)
  if (!(medW > 0)) return false
  const maxGap = medW * LINE_STAMP_MAX_GAP_RATIO
  for (let i = 1; i < line.words.length; i++) {
    const prev = line.words[i - 1]!
    const cur = line.words[i]!
    const gap = cur.x0 - prev.x1
    if (gap > maxGap) return false
  }
  return Boolean(ocrLinePlainText(line))
}

/**
 * Map one OCR word as invisible PDF text covering its printed box.
 * Size follows box height; width is matched with horizontalScale (not a taller font).
 * `textWidthAtSize1` is Helvetica width of the (already sanitized) string at size 1.
 */
export function mapOcrWordToPdfText(args: {
  word: OcrWordBox
  imageWidth: number
  imageHeight: number
  pageWidth: number
  pageHeight: number
  textWidthAtSize1: number
  descenderRatio?: number
  /** When provided, overrides per-word height sizing with the line's shared size. */
  lineFontSize?: number
}): PdfInvisibleTextPlacement | null {
  const text = winAnsiSafePdfText(args.word.text)
  if (!text) return null
  if (args.imageWidth <= 0 || args.imageHeight <= 0) return null
  if (args.pageWidth <= 0 || args.pageHeight <= 0) return null

  const boxW = args.word.x1 - args.word.x0
  const boxH = args.word.y1 - args.word.y0
  if (!(boxW > 1) || !(boxH > 1)) return null

  const scaleX = args.pageWidth / args.imageWidth
  const scaleY = args.pageHeight / args.imageHeight
  const x = args.word.x0 * scaleX
  const boxWidth = boxW * scaleX
  const boxHeight = boxH * scaleY
  const pdfBoxBottom = args.pageHeight - args.word.y1 * scaleY

  const sizeFromHeight = Math.max(MIN_FONT_SIZE, boxHeight * HEIGHT_TO_SIZE)
  const size =
    args.lineFontSize != null && args.lineFontSize >= MIN_FONT_SIZE
      ? args.lineFontSize
      : sizeFromHeight

  const naturalWidth = args.textWidthAtSize1 > 0 ? args.textWidthAtSize1 * size : 0
  const horizontalScale = naturalWidth > 0 ? boxWidth / naturalWidth : 1

  const descenderRatio = args.descenderRatio ?? HELVETICA_DESCENDER_RATIO
  const y = pdfBoxBottom - descenderRatio * size

  return { text, x, y, size, horizontalScale }
}

/**
 * Place a whole OCR line as one invisible PDF string.
 * Font size follows printed line height; horizontalScale stretches to printed width.
 */
export function mapOcrLineToPdfText(args: {
  line: OcrLine
  imageWidth: number
  imageHeight: number
  pageWidth: number
  pageHeight: number
  textWidthAtSize1: number
  descenderRatio?: number
}): PdfInvisibleTextPlacement | null {
  const text = ocrLinePlainText(args.line)
  if (!text) return null
  if (args.imageWidth <= 0 || args.imageHeight <= 0) return null
  if (args.pageWidth <= 0 || args.pageHeight <= 0) return null
  if (args.line.words.length === 0) return null

  const x0 = Math.min(...args.line.words.map((w) => w.x0))
  const x1 = Math.max(...args.line.words.map((w) => w.x1))
  // Prefer median baseline / height so one tall glyph does not inflate the line.
  const y1 = args.line.baseline > 0 ? args.line.baseline : Math.max(...args.line.words.map((w) => w.y1))
  const lineH = args.line.lineHeight > 0 ? args.line.lineHeight : Math.max(...args.line.words.map((w) => w.y1 - w.y0))
  const y0 = y1 - lineH
  const boxW = x1 - x0
  const boxH = y1 - y0
  if (!(boxW > 1) || !(boxH > 1)) return null

  const scaleX = args.pageWidth / args.imageWidth
  const scaleY = args.pageHeight / args.imageHeight
  const x = x0 * scaleX
  const boxWidth = boxW * scaleX
  const boxHeight = boxH * scaleY
  const pdfBoxBottom = args.pageHeight - y1 * scaleY

  const size = Math.max(MIN_FONT_SIZE, boxHeight * HEIGHT_TO_SIZE)
  const naturalWidth = args.textWidthAtSize1 > 0 ? args.textWidthAtSize1 * size : 0
  const horizontalScale = naturalWidth > 0 ? boxWidth / naturalWidth : 1

  const descenderRatio = args.descenderRatio ?? HELVETICA_DESCENDER_RATIO
  const y = pdfBoxBottom - descenderRatio * size

  return { text, x, y, size, horizontalScale }
}

/**
 * Compute a shared font size for all words in a line, based on the line's
 * median height in PDF points.
 */
export function lineFontSizeFromHeight(
  lineHeight: number,
  imageHeight: number,
  pageHeight: number,
): number {
  if (imageHeight <= 0 || pageHeight <= 0 || lineHeight <= 0) return MIN_FONT_SIZE
  const pdfHeight = lineHeight * (pageHeight / imageHeight)
  return Math.max(MIN_FONT_SIZE, pdfHeight * HEIGHT_TO_SIZE)
}
