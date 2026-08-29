import 'server-only'

import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { pdfFilePageHasSelectableText, pdfFilePagesWithSelectableText } from '@/lib/books/extract-story-pdf-text'
import { renderPdfPageToPngBuffer } from '@/lib/books/generate-book-cover-server'
import { recognizePageWords } from '@/lib/books/searchable-pdf-ocr'
import { searchablePdfAbsolutePath } from '@/lib/books/searchable-pdf-path'
import {
  HELVETICA_DESCENDER_RATIO,
  mapOcrWordToPdfText,
  winAnsiSafePdfText,
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

async function stampPageOnSidecar(
  originalAbsPath: string,
  pdfPage: number,
): Promise<StampSearchablePageResult> {
  const pageNo = Math.max(1, Math.floor(pdfPage))
  try {
    const originalHasText = await pdfFilePageHasSelectableText(originalAbsPath, pageNo)
    if (originalHasText) {
      return { ok: true, status: 'skipped', reason: 'has-text', pdfPage: pageNo, wordCount: 0 }
    }

    const sidecar = await ensureSearchableSidecar(originalAbsPath)
    const sidecarHasText = await pdfFilePageHasSelectableText(sidecar, pageNo)
    if (sidecarHasText) {
      return { ok: true, status: 'skipped', reason: 'done', pdfPage: pageNo, wordCount: 0 }
    }

    const png = await renderPdfPageToPngBuffer(originalAbsPath, pageNo, OCR_RENDER_WIDTH)
    const words = await recognizePageWords(png.buffer)

    const bytes = await readFile(sidecar)
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
    if (pageNo > pdf.getPageCount()) {
      return { ok: false, error: `PDF page ${pageNo} is out of range.`, pdfPage: pageNo }
    }
    const page = pdf.getPage(pageNo - 1)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()

    let wordCount = 0
    for (const word of words) {
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
      })
      if (!placement) continue
      try {
        page.drawText(placement.text, {
          x: placement.x,
          y: placement.y,
          size: placement.size,
          font,
          opacity: 0,
        })
        wordCount += 1
      } catch {
        // Skip glyphs Helvetica still cannot encode.
      }
    }

    const saved = await pdf.save({ useObjectStreams: true })
    await writeFile(sidecar, Buffer.from(saved))

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
): Promise<StampSearchablePageResult> {
  return enqueueSidecarWrite(() => stampPageOnSidecar(originalAbsPath, pdfPage))
}
