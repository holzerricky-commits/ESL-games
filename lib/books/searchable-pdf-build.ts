import 'server-only'

import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, pushGraphicsState, popGraphicsState, translate, scale } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { pdfFilePagesWithSelectableText } from '@/lib/books/extract-story-pdf-text'
import { renderPdfPageToPngBuffer } from '@/lib/books/generate-book-cover-server'
import { recognizePageWordsWithCloudOcr } from '@/lib/books/searchable-pdf-cloud-ocr'
import { recognizePageWordsDetailed } from '@/lib/books/searchable-pdf-ocr'
import {
  medianOcrConfidence,
  pageNeedsCloudOcrFallback,
} from '@/lib/books/searchable-pdf-ocr-fallback'
import {
  searchableOcrBoxesAbsolutePath,
  searchableOcrResultAbsolutePath,
  searchablePdfAbsolutePath,
} from '@/lib/books/searchable-pdf-path'
import {
  SEARCHABLE_PDF_FILE_OPEN_ERROR,
  clearReadOnlyAttribute,
  isFileBusyError,
  writeFileReplacingWithRetry,
} from '@/lib/books/searchable-pdf-sidecar-write'
import {
  fileMtimeMs,
  readSearchableOcrResult,
  writeSearchableOcrBoxes,
  writeSearchableOcrResult,
} from '@/lib/books/searchable-ocr-boxes-io'
import { buildSelectWordBoxes } from '@/lib/books/searchable-ocr-boxes'
import { buildSearchableOcrResultFile, isCurrentSearchableOcrProfile } from '@/lib/books/searchable-ocr-result'
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

/** ~300 DPI on a typical textbook page — small bubble and caption text needs the extra pixels. */
const OCR_RENDER_WIDTH = 2600

/** Per-step millisecond log for one searchable-pdf operation. */
function createStepTimer(label: string) {
  const steps: string[] = []
  const started = Date.now()
  let last = started
  return {
    mark(step: string) {
      const now = Date.now()
      steps.push(`${step}=${now - last}ms`)
      last = now
    },
    log() {
      console.info(`[searchable-pdf] ${label} total=${Date.now() - started}ms ${steps.join(' ')}`)
    },
  }
}

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
    if (orig.mtimeMs <= side.mtimeMs) {
      await clearReadOnlyAttribute(sidecar)
      return sidecar
    }
    await clearReadOnlyAttribute(sidecar)
  }
  await copyFile(originalAbsPath, sidecar)
  await clearReadOnlyAttribute(sidecar)
  return sidecar
}

/**
 * A page is stamped when its select boxes exist, are newer than the scan,
 * the sidecar PDF is still there, and the words were read with the current
 * OCR settings (older reads are redone). File stats plus one small JSON read.
 */
async function pageStampedOnSidecar(
  originalAbsPath: string,
  pdfPage: number,
  originalMtimeMs: number,
  sidecarReady: boolean,
): Promise<boolean> {
  if (!sidecarReady) return false
  const boxesMtime = await fileMtimeMs(searchableOcrBoxesAbsolutePath(originalAbsPath, pdfPage))
  if (boxesMtime == null || boxesMtime < originalMtimeMs) return false
  const result = await readSearchableOcrResult(originalAbsPath, pdfPage)
  return result != null && isCurrentSearchableOcrProfile(result)
}

export async function planSearchablePdfPages(
  originalAbsPath: string,
  startPdfPage: number,
  endPdfPage: number,
): Promise<SearchablePagePlanItem[]> {
  const start = Math.max(1, Math.floor(startPdfPage))
  const end = Math.max(start, Math.floor(endPdfPage))
  const timer = createStepTimer(`plan ${start}-${end}`)
  const sidecarReady = await fileExists(searchablePdfAbsolutePath(originalAbsPath))
  const originalMtimeMs = (await stat(originalAbsPath)).mtimeMs
  const originalHasText = await pdfFilePagesWithSelectableText(originalAbsPath, start, end)
  timer.mark('origTextCheck')
  const items: SearchablePagePlanItem[] = []

  for (let pdfPage = start; pdfPage <= end; pdfPage += 1) {
    if (originalHasText.has(pdfPage)) {
      items.push({ pdfPage, action: 'skip-has-text' })
      continue
    }
    if (await pageStampedOnSidecar(originalAbsPath, pdfPage, originalMtimeMs, sidecarReady)) {
      items.push({ pdfPage, action: 'skip-done' })
      continue
    }
    items.push({ pdfPage, action: 'ocr' })
  }
  timer.mark('stats')
  timer.log()

  return items
}

export type OcrSearchablePageResult =
  | { ok: true; status: 'read'; wordCount: number; pdfPage: number; source: 'tesseract' | 'cloud' | 'cached' }
  | { ok: true; status: 'skipped'; reason: 'has-text'; pdfPage: number; wordCount: number }
  | { ok: false; error: string; pdfPage: number }

export type OcrSearchablePageOptions = {
  /** Ignore a saved OCR result and read the page again (redo). */
  force?: boolean
  /**
   * The client already ran `plan` for this range. Skip the "does the scan already have text?"
   * check so the page request does not parse the unit PDF again.
   */
  planned?: boolean
}

function friendlyPageError(err: unknown): string {
  const raw = err instanceof Error ? err.message : ''
  if (/none of these types|InvalidArg|Path2D/i.test(raw)) return 'Could not read this page picture.'
  return 'Could not add selectable text to this page.'
}

/**
 * Read the words on one page and save them as `pN.ocr.json`.
 * Does not touch the sidecar PDF — `finalizeSearchablePdfPages` stamps once per run.
 */
export async function ocrSearchablePdfPage(
  originalAbsPath: string,
  pdfPage: number,
  options?: OcrSearchablePageOptions,
): Promise<OcrSearchablePageResult> {
  const pageNo = Math.max(1, Math.floor(pdfPage))
  const force = Boolean(options?.force)
  const timer = createStepTimer(`ocr page ${pageNo}`)
  try {
    if (!options?.planned) {
      const hasText = await pdfFilePagesWithSelectableText(originalAbsPath, pageNo, pageNo)
      timer.mark('origTextCheck')
      if (hasText.has(pageNo)) {
        return { ok: true, status: 'skipped', reason: 'has-text', pdfPage: pageNo, wordCount: 0 }
      }
    }

    if (!force) {
      const [ocrMtime, origMtime] = await Promise.all([
        fileMtimeMs(searchableOcrResultAbsolutePath(originalAbsPath, pageNo)),
        fileMtimeMs(originalAbsPath),
      ])
      if (ocrMtime != null && origMtime != null && ocrMtime >= origMtime) {
        const cached = await readSearchableOcrResult(originalAbsPath, pageNo)
        if (cached && isCurrentSearchableOcrProfile(cached)) {
          timer.mark('cachedOcr')
          timer.log()
          return { ok: true, status: 'read', wordCount: cached.words.length, pdfPage: pageNo, source: 'cached' }
        }
      }
    }

    const png = await renderPdfPageToPngBuffer(originalAbsPath, pageNo, OCR_RENDER_WIDTH, {
      ocrPreprocess: true,
    })
    timer.mark('render')
    const recognized = await recognizePageWordsDetailed(png.buffer)
    timer.mark('tesseract')
    let words: OcrWordBox[] = recognized.words
    let source: 'tesseract' | 'cloud' = 'tesseract'
    if (pageNeedsCloudOcrFallback(recognized.scoredWords)) {
      const pageConfidence = medianOcrConfidence(filterBodyOcrWords(recognized.scoredWords))
      console.info(
        `[searchable-pdf] page ${pageNo} body-text confidence ${pageConfidence.toFixed(0)} — trying cloud OCR`,
      )
      const cloudWords = await recognizePageWordsWithCloudOcr({
        imageBuffer: await png.encodeJpeg(),
        mimeType: 'image/jpeg',
        imageWidth: png.width,
        imageHeight: png.height,
      })
      if (cloudWords && cloudWords.length > 0) {
        words = cloudWords
        source = 'cloud'
      } else {
        console.warn(
          `[searchable-pdf] page ${pageNo} cloud OCR unavailable — keeping Tesseract (${words.length} words)`,
        )
      }
      timer.mark('gemini')
    }

    await mkdir(path.dirname(searchableOcrResultAbsolutePath(originalAbsPath, pageNo)), { recursive: true })
    await writeSearchableOcrResult(
      originalAbsPath,
      buildSearchableOcrResultFile({
        pdfPage: pageNo,
        imageWidth: png.width,
        imageHeight: png.height,
        source,
        words,
      }),
    )
    timer.mark('writeOcr')
    timer.log()

    return { ok: true, status: 'read', wordCount: words.length, pdfPage: pageNo, source }
  } catch (err) {
    console.error('[searchable-pdf] OCR page failed', pageNo, err)
    return { ok: false, error: friendlyPageError(err), pdfPage: pageNo }
  }
}

/**
 * Stamp one page's body-sized OCR words as invisible text (for search and copy in
 * other PDF viewers). Select boxes come from {@link buildSelectWordBoxes} instead.
 */
function stampOcrWordsOnPage(args: {
  page: PDFPage
  font: PDFFont
  words: readonly OcrWordBox[]
  imageWidth: number
  imageHeight: number
  pdfPage: number
}): number {
  const { page, font, words, imageWidth, imageHeight } = args
  const pageWidth = page.getWidth()
  const pageHeight = page.getHeight()

  // Prefer body-sized words; if the filter empties the page, stamp everything OCR returned.
  const bodyWords = filterBodyOcrWords(words)
  const wordsToStamp = bodyWords.length > 0 ? bodyWords : [...words]
  if (words.length > 0 && bodyWords.length === 0) {
    console.warn(
      `[searchable-pdf] page ${args.pdfPage} body filter removed all words — stamping full OCR set`,
    )
  }
  const lines = filterDecorativeOcrLines(groupWordsIntoLines(wordsToStamp))

  const stampWord = (word: OcrWordBox, lineFontSize: number): boolean => {
    const safeText = winAnsiSafePdfText(word.text)
    if (!safeText) return false
    const placement = mapOcrWordToPdfText({
      word: { ...word, text: safeText },
      imageWidth,
      imageHeight,
      pageWidth,
      pageHeight,
      textWidthAtSize1: font.widthOfTextAtSize(safeText, 1),
      descenderRatio: HELVETICA_DESCENDER_RATIO,
      lineFontSize,
    })
    if (!placement) return false
    try {
      drawInvisibleOcrText(page, font, placement)
      return true
    } catch {
      // Skip glyphs Helvetica still cannot encode.
      return false
    }
  }

  let wordCount = 0
  for (const line of lines) {
    const lineSize = lineFontSizeFromHeight(line.lineHeight, imageHeight, pageHeight)
    if (shouldStampLineAsUnit(line)) {
      const lineText = ocrLinePlainText(line)
      const placement = mapOcrLineToPdfText({
        line,
        imageWidth,
        imageHeight,
        pageWidth,
        pageHeight,
        textWidthAtSize1: font.widthOfTextAtSize(lineText || ' ', 1),
        descenderRatio: HELVETICA_DESCENDER_RATIO,
      })
      if (!placement || !placement.text) continue
      try {
        drawInvisibleOcrText(page, font, placement)
        wordCount += line.words.length
      } catch {
        // Fall through to per-word if Helvetica cannot encode the full line.
        for (const word of line.words) {
          if (stampWord(word, lineSize)) wordCount += 1
        }
      }
      continue
    }
    for (const word of line.words) {
      if (stampWord(word, lineSize)) wordCount += 1
    }
  }

  return wordCount
}

export type FinalizeSearchablePagesResult =
  | { ok: true; stamped: number[]; missing: number[] }
  | { ok: false; error: string }

/**
 * Stamp every page's saved OCR words into the sidecar with one PDF load and one save.
 * Pages that were stamped before (redo, or select boxes already on disk) are first
 * replaced with a clean copy from the original so invisible text does not stack.
 */
async function finalizeOnSidecar(
  originalAbsPath: string,
  pdfPages: readonly number[],
  options?: { force?: boolean },
): Promise<FinalizeSearchablePagesResult> {
  const pages = [...new Set(pdfPages.map((p) => Math.max(1, Math.floor(p))))].sort((a, b) => a - b)
  if (pages.length === 0) return { ok: true, stamped: [], missing: [] }
  const timer = createStepTimer(`finalize ${pages.length} page(s)`)
  try {
    const ocrResults = new Map<number, Awaited<ReturnType<typeof readSearchableOcrResult>>>()
    const missing: number[] = []
    for (const pageNo of pages) {
      const result = await readSearchableOcrResult(originalAbsPath, pageNo)
      if (result) ocrResults.set(pageNo, result)
      else missing.push(pageNo)
    }
    const toStamp = pages.filter((p) => ocrResults.has(p))
    if (toStamp.length === 0) return { ok: true, stamped: [], missing }

    const sidecar = await ensureSearchableSidecar(originalAbsPath)
    timer.mark('ensureSidecar')
    const pdf = await PDFDocument.load(await readFile(sidecar), { ignoreEncryption: true })
    timer.mark('pdfLibLoadSidecar')

    const outOfRange = toStamp.find((p) => p > pdf.getPageCount())
    if (outOfRange != null) {
      return { ok: false, error: `PDF page ${outOfRange} is out of range.` }
    }

    const needsClean: number[] = []
    for (const pageNo of toStamp) {
      const boxesMtime = await fileMtimeMs(searchableOcrBoxesAbsolutePath(originalAbsPath, pageNo))
      if (options?.force || boxesMtime != null) needsClean.push(pageNo)
    }
    if (needsClean.length > 0) {
      const original = await PDFDocument.load(await readFile(originalAbsPath), { ignoreEncryption: true })
      timer.mark('pdfLibLoadOriginal')
      const copied = await pdf.copyPages(
        original,
        needsClean.map((p) => p - 1),
      )
      needsClean.forEach((pageNo, i) => {
        pdf.removePage(pageNo - 1)
        pdf.insertPage(pageNo - 1, copied[i]!)
      })
      timer.mark('replacePages')
    }

    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const selectBoxes: Array<{ pdfPage: number; words: OcrWordBox[]; imageWidth: number; imageHeight: number }> = []
    for (const pageNo of toStamp) {
      const result = ocrResults.get(pageNo)!
      stampOcrWordsOnPage({
        page: pdf.getPage(pageNo - 1),
        font,
        words: result.words,
        imageWidth: result.imageWidth,
        imageHeight: result.imageHeight,
        pdfPage: pageNo,
      })
      selectBoxes.push({
        pdfPage: pageNo,
        words: buildSelectWordBoxes(result.words),
        imageWidth: result.imageWidth,
        imageHeight: result.imageHeight,
      })
    }
    timer.mark('stamp')

    const saved = await pdf.save({ useObjectStreams: true })
    timer.mark('pdfLibSave')
    await writeFileReplacingWithRetry(sidecar, saved)
    timer.mark('writeSidecar')

    // Select uses these printed boxes — not Helvetica positions from the PDF.
    // Written after the save so a box file always means "this page is stamped".
    for (const box of selectBoxes) {
      await writeSearchableOcrBoxes({ originalAbsPath, ...box })
    }
    timer.mark('boxes')
    timer.log()

    return { ok: true, stamped: toStamp, missing }
  } catch (err) {
    console.error('[searchable-pdf] finalize failed', err)
    timer.log()
    if (
      isFileBusyError(err) ||
      (err instanceof Error && err.message === SEARCHABLE_PDF_FILE_OPEN_ERROR)
    ) {
      return { ok: false, error: SEARCHABLE_PDF_FILE_OPEN_ERROR }
    }
    return { ok: false, error: 'Could not save the selectable text into the book file.' }
  }
}

/** Stamp saved OCR results into the sidecar once. Serialized per process. */
export function finalizeSearchablePdfPages(
  originalAbsPath: string,
  pdfPages: readonly number[],
  options?: { force?: boolean },
): Promise<FinalizeSearchablePagesResult> {
  return enqueueSidecarWrite(() => finalizeOnSidecar(originalAbsPath, pdfPages, options))
}
