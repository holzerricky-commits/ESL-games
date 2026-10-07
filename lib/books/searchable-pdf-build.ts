import 'server-only'

import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, pushGraphicsState, popGraphicsState, translate, scale } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { pdfFilePageHasSelectableText, pdfFilePagesWithSelectableText } from '@/lib/books/extract-story-pdf-text'
import { renderPdfPageToPngBuffer } from '@/lib/books/generate-book-cover-server'
import { recognizePageWordsWithCloudOcr } from '@/lib/books/searchable-pdf-cloud-ocr'
import { recognizePageWordsDetailed } from '@/lib/books/searchable-pdf-ocr'
import {
  medianOcrConfidence,
  pageNeedsCloudOcrFallback,
} from '@/lib/books/searchable-pdf-ocr-fallback'
import { searchablePdfAbsolutePath } from '@/lib/books/searchable-pdf-path'
import { writeSearchableOcrBoxes } from '@/lib/books/searchable-ocr-boxes-io'
import { filterBodyOcrWords, filterDecorativeOcrLines } from '@/lib/books/searchable-pdf-body-text'
import {
  HELVETICA_DESCENDER_RATIO,
  groupWordsIntoLines,
  lineFontSizeFromHeight,
  mapOcrLineToPdfText,
  mapOcrWordToPdfText,
  ocrLinePlainText,
  shouldStampLineAsUnit,
  winAnsiSafePdfText,
  type OcrWordBox,
  type PdfInvisibleTextPlacement,
} from '@/lib/books/searchable-pdf-text-layer'
import type { SearchablePagePlanItem } from '@/lib/books/searchable-pdf-types'

export type { SearchablePagePlanAction, SearchablePagePlanItem } from '@/lib/books/searchable-pdf-types'

/** ~200 DPI on a typical textbook page — enough for Tesseract without huge rasters. */
const OCR_RENDER_WIDTH = 1800

let sidecarWriteChain: Promise<unknown> = Promise.resolve()

function enqueueSidecarWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = sidecarWriteChain.then(fn, fn)
  sidecarWriteChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** Draw invisible OCR text; stretch X to the printed box without changing height. */
function drawInvisibleOcrText(page: PDFPage, font: PDFFont, placement: PdfInvisibleTextPlacement): void {
  const hScale = placement.horizontalScale
  const useScale = Number.isFinite(hScale) && hScale > 0 && Math.abs(hScale - 1) > 0.001
  if (useScale) {
    page.pushOperators(pushGraphicsState(), translate(placement.x, placement.y), scale(hScale, 1))
    page.drawText(placement.text, {
      x: 0,
      y: 0,
      size: placement.size,
      font,
      opacity: 0,
    })
    page.pushOperators(popGraphicsState())
    return
  }
  page.drawText(placement.text, {
    x: placement.x,
    y: placement.y,
    size: placement.size,
    font,
    opacity: 0,
  })
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await stat(absPath)
    return true
  } catch {
    return false
  }
}

/**
 * Copy the original PDF into `.searchable/` if missing, or if the original is newer
 * (teacher replaced the scan). Never writes over the original file.
 */
export async function ensureSearchableSidecar(originalAbsPath: string): Promise<string> {
  const sidecar = searchablePdfAbsolutePath(originalAbsPath)
  await mkdir(path.dirname(sidecar), { recursive: true })
  const orig = await stat(originalAbsPath)
  if (await fileExists(sidecar)) {
    const side = await stat(sidecar)
    if (orig.mtimeMs <= side.mtimeMs) return sidecar
  }
  await copyFile(originalAbsPath, sidecar)
  return sidecar
}

export async function planSearchablePdfPages(
  originalAbsPath: string,
  startPdfPage: number,
  endPdfPage: number,
): Promise<SearchablePagePlanItem[]> {
  const start = Math.max(1, Math.floor(startPdfPage))
  const end = Math.max(start, Math.floor(endPdfPage))
  const sidecar = searchablePdfAbsolutePath(originalAbsPath)
  const sidecarReady = await fileExists(sidecar)
  const originalHasText = await pdfFilePagesWithSelectableText(originalAbsPath, start, end)
  const sidecarHasText = sidecarReady
    ? await pdfFilePagesWithSelectableText(sidecar, start, end)
    : new Set<number>()
  const items: SearchablePagePlanItem[] = []

  for (let pdfPage = start; pdfPage <= end; pdfPage += 1) {
    if (originalHasText.has(pdfPage)) {
      items.push({ pdfPage, action: 'skip-has-text' })
      continue
    }
    if (sidecarHasText.has(pdfPage)) {
      items.push({ pdfPage, action: 'skip-done' })
      continue
    }
    items.push({ pdfPage, action: 'ocr' })
  }

  return items
}

export type StampSearchablePageResult =
  | { ok: true; status: 'stamped'; wordCount: number; pdfPage: number }
  | { ok: true; status: 'skipped'; reason: 'has-text' | 'done'; pdfPage: number; wordCount: number }
  | { ok: false; error: string; pdfPage: number }

export type StampSearchablePageOptions = {
  /** Replace the sidecar page from the original first, then stamp (redo). */
  force?: boolean
}

/**
 * Replace one sidecar page with a clean copy from the original PDF
 * so a redo does not stack invisible text on top of an old stamp.
 */
export async function replaceSidecarPageFromOriginal(
  originalAbsPath: string,
  sidecarAbsPath: string,
  pdfPage: number,
): Promise<void> {
  const pageNo = Math.max(1, Math.floor(pdfPage))
  const [origBytes, sideBytes] = await Promise.all([
    readFile(originalAbsPath),
    readFile(sidecarAbsPath),
  ])
  const originalPdf = await PDFDocument.load(origBytes, { ignoreEncryption: true })
  const sidecarPdf = await PDFDocument.load(sideBytes, { ignoreEncryption: true })
  if (pageNo > originalPdf.getPageCount() || pageNo > sidecarPdf.getPageCount()) {
    throw new Error(`PDF page ${pageNo} is out of range.`)
  }
  const [copied] = await sidecarPdf.copyPages(originalPdf, [pageNo - 1])
  sidecarPdf.removePage(pageNo - 1)
  sidecarPdf.insertPage(pageNo - 1, copied)
  const saved = await sidecarPdf.save({ useObjectStreams: true })
  await writeFile(sidecarAbsPath, Buffer.from(saved))
}

async function stampPageOnSidecar(
  originalAbsPath: string,
  pdfPage: number,
  options?: StampSearchablePageOptions,
): Promise<StampSearchablePageResult> {
  const pageNo = Math.max(1, Math.floor(pdfPage))
  const force = Boolean(options?.force)
  try {
    const originalHasText = await pdfFilePageHasSelectableText(originalAbsPath, pageNo)
    if (originalHasText) {
      return { ok: true, status: 'skipped', reason: 'has-text', pdfPage: pageNo, wordCount: 0 }
    }

    const sidecar = await ensureSearchableSidecar(originalAbsPath)
    const sidecarHasText = await pdfFilePageHasSelectableText(sidecar, pageNo)
    if (sidecarHasText && !force) {
      return { ok: true, status: 'skipped', reason: 'done', pdfPage: pageNo, wordCount: 0 }
    }
    if (sidecarHasText && force) {
      await replaceSidecarPageFromOriginal(originalAbsPath, sidecar, pageNo)
    }

    const png = await renderPdfPageToPngBuffer(originalAbsPath, pageNo, OCR_RENDER_WIDTH)
    const recognized = await recognizePageWordsDetailed(png.buffer)
    let words = recognized.words
    if (pageNeedsCloudOcrFallback(recognized.scoredWords)) {
      const pageConfidence = medianOcrConfidence(recognized.scoredWords)
      console.info(
        `[searchable-pdf] page ${pageNo} Tesseract confidence ${pageConfidence.toFixed(0)} — trying cloud OCR`,
      )
      const cloudWords = await recognizePageWordsWithCloudOcr({
        pngBuffer: png.buffer,
        imageWidth: png.width,
        imageHeight: png.height,
      })
      if (cloudWords && cloudWords.length > 0) {
        words = cloudWords
        console.info(
          `[searchable-pdf] page ${pageNo} cloud OCR returned ${cloudWords.length} words`,
        )
      } else {
        console.warn(
          `[searchable-pdf] page ${pageNo} cloud OCR unavailable — keeping Tesseract (${words.length} words)`,
        )
      }
    }

    const bytes = await readFile(sidecar)
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
    if (pageNo > pdf.getPageCount()) {
      return { ok: false, error: `PDF page ${pageNo} is out of range.`, pdfPage: pageNo }
    }
    const page = pdf.getPage(pageNo - 1)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()

    // Prefer body-sized words; if the filter empties the page, stamp everything OCR returned.
    const bodyWords = filterBodyOcrWords(words)
    const wordsToStamp = bodyWords.length > 0 ? bodyWords : words
    if (words.length > 0 && bodyWords.length === 0) {
      console.warn(
        `[searchable-pdf] page ${pageNo} body filter removed all words — stamping full OCR set`,
      )
    }
    const lines = filterDecorativeOcrLines(groupWordsIntoLines(wordsToStamp))
    const selectWords: OcrWordBox[] = []
    for (const line of lines) {
      for (const word of line.words) {
        const safe = winAnsiSafePdfText(word.text)
        if (!safe) continue
        selectWords.push({ ...word, text: safe })
      }
    }
    let wordCount = 0
    for (const line of lines) {
      if (shouldStampLineAsUnit(line)) {
        const lineText = ocrLinePlainText(line)
        const widthAt1 = font.widthOfTextAtSize(lineText || ' ', 1)
        const placement = mapOcrLineToPdfText({
          line,
          imageWidth: png.width,
          imageHeight: png.height,
          pageWidth,
          pageHeight,
          textWidthAtSize1: widthAt1,
          descenderRatio: HELVETICA_DESCENDER_RATIO,
        })
        if (!placement || !placement.text) continue
        try {
          drawInvisibleOcrText(page, font, placement)
          wordCount += line.words.length
        } catch {
          // Fall through to per-word if Helvetica cannot encode the full line.
          const lineSize = lineFontSizeFromHeight(line.lineHeight, png.height, pageHeight)
          for (const word of line.words) {
            const safeText = winAnsiSafePdfText(word.text)
            if (!safeText) continue
            const w1 = font.widthOfTextAtSize(safeText, 1)
            const wordPlacement = mapOcrWordToPdfText({
              word: { ...word, text: safeText },
              imageWidth: png.width,
              imageHeight: png.height,
              pageWidth,
              pageHeight,
              textWidthAtSize1: w1,
              descenderRatio: HELVETICA_DESCENDER_RATIO,
              lineFontSize: lineSize,
            })
            if (!wordPlacement) continue
            try {
              drawInvisibleOcrText(page, font, wordPlacement)
              wordCount += 1
            } catch {
              // Skip glyphs Helvetica still cannot encode.
            }
          }
        }
        continue
      }

      const lineSize = lineFontSizeFromHeight(line.lineHeight, png.height, pageHeight)
      for (const word of line.words) {
        const safeText = winAnsiSafePdfText(word.text)
        if (!safeText) continue
        const widthAt1 = font.widthOfTextAtSize(safeText, 1)
        const placement = mapOcrWordToPdfText({
          word: { ...word, text: safeText },
          imageWidth: png.width,
          imageHeight: png.height,
          pageWidth,
          pageHeight,
          textWidthAtSize1: widthAt1,
          descenderRatio: HELVETICA_DESCENDER_RATIO,
          lineFontSize: lineSize,
        })
        if (!placement) continue
        try {
          drawInvisibleOcrText(page, font, placement)
          wordCount += 1
        } catch {
          // Skip glyphs Helvetica still cannot encode.
        }
      }
    }

    const saved = await pdf.save({ useObjectStreams: true })
    await writeFile(sidecar, Buffer.from(saved))
    // Select uses these printed boxes — not Helvetica positions from the PDF.
    await writeSearchableOcrBoxes({
      originalAbsPath,
      pdfPage: pageNo,
      words: selectWords,
      imageWidth: png.width,
      imageHeight: png.height,
    })

    return { ok: true, status: 'stamped', wordCount, pdfPage: pageNo }
  } catch (err) {
    console.error('[searchable-pdf] stamp page failed', pageNo, err)
    const raw = err instanceof Error ? err.message : ''
    if (/none of these types|InvalidArg|Path2D/i.test(raw)) {
      return { ok: false, error: 'Could not read this page picture.', pdfPage: pageNo }
    }
    return {
      ok: false,
      error: 'Could not add selectable text to this page.',
      pdfPage: pageNo,
    }
  }
}

/** OCR one page and stamp hidden text onto the sidecar. Serialized per process. */
export function stampSearchablePdfPage(
  originalAbsPath: string,
  pdfPage: number,
  options?: StampSearchablePageOptions,
): Promise<StampSearchablePageResult> {
  return enqueueSidecarWrite(() => stampPageOnSidecar(originalAbsPath, pdfPage, options))
}
