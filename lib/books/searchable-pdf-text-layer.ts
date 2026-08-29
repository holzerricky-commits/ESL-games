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
}

/** Helvetica AFM descender / em (negative). */
export const HELVETICA_DESCENDER_RATIO = -0.207

const MIN_FONT_SIZE = 4
const HEIGHT_TO_SIZE = 0.85

/** Map curly quotes and dashes so WinAnsi Helvetica can draw the word. */
export function winAnsiSafePdfText(raw: string): string {
  return raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Place one OCR word as invisible PDF text covering its printed box.
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

  const sizeFromHeight = boxHeight * HEIGHT_TO_SIZE
  const sizeFromWidth =
    args.textWidthAtSize1 > 0 ? boxWidth / args.textWidthAtSize1 : sizeFromHeight
  const size = Math.max(MIN_FONT_SIZE, Math.min(sizeFromWidth, sizeFromHeight))

  const descenderRatio = args.descenderRatio ?? HELVETICA_DESCENDER_RATIO
  const y = pdfBoxBottom - descenderRatio * size

  return { text, x, y, size }
}
