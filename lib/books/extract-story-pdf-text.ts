import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  pdfTextItemsHaveSelectableText,
} from '@/lib/books/pdf-page-text-probe'
import { mergePdfTextItemsToLines, type PdfTextItem } from '@/lib/books/toc-import'

let pdfWorkerConfigured = false

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (!pdfWorkerConfigured) {
    const workerAbsPath = path.resolve(
      /* turbopackIgnore: true */ process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'legacy',
      'build',
      'pdf.worker.mjs',
    )
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerAbsPath).toString()
    pdfWorkerConfigured = true
  }
  return pdfjs
}

export async function openPdfDocument(absFilePath: string) {
  const pdfjs = await loadPdfJs()
  const bytes = await readFile(absFilePath)
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
    stopAtErrors: false,
  }).promise
}

/**
 * Extract selectable text for an inclusive PDF page span (server-side pdf.js).
 * Returns empty string when the range has no extractable text (e.g. image-only pages).
 */
export async function extractPdfPageRangeText(
  absFilePath: string,
  startPdfPage: number,
  endPdfPage: number,
): Promise<{ text: string; pageCount: number; extractedPages: number; totalPdfPages: number }> {
  const start = Math.max(1, Math.floor(startPdfPage))
  const end = Math.max(start, Math.floor(endPdfPage))
  const doc = await openPdfDocument(absFilePath)
  const totalPdfPages = doc.numPages

  const lo = Math.min(start, totalPdfPages)
  const hi = Math.min(end, totalPdfPages)
  const parts: string[] = []
  let extractedPages = 0

  for (let pageNo = lo; pageNo <= hi; pageNo += 1) {
    const page = await doc.getPage(pageNo)
    const textContent = await page.getTextContent()
    const items: PdfTextItem[] = []
    for (const raw of textContent.items) {
      if (!raw || typeof raw !== 'object') continue
      const src = raw as { str?: unknown; transform?: unknown; width?: unknown; height?: unknown }
      if (typeof src.str !== 'string' || !src.str.trim()) continue
      if (!Array.isArray(src.transform)) continue
      items.push({
        str: src.str,
        transform: src.transform as number[],
        width: typeof src.width === 'number' ? src.width : undefined,
        height: typeof src.height === 'number' ? src.height : undefined,
      })
    }
    const lines = mergePdfTextItemsToLines(items).filter(Boolean)
    if (lines.length) {
      extractedPages += 1
      parts.push(`--- Page ${pageNo} ---\n${lines.join('\n')}`)
    }
  }

  try {
    await doc.destroy()
  } catch {
    // ignore
  }

  return {
    text: parts.join('\n\n').trim(),
    pageCount: hi - lo + 1,
    extractedPages,
    totalPdfPages,
  }
}

/** True when this PDF page already has enough selectable text to skip OCR. */
export async function pdfFilePageHasSelectableText(
  absFilePath: string,
  pageNumber: number,
): Promise<boolean> {
  const found = await pdfFilePagesWithSelectableText(absFilePath, pageNumber, pageNumber)
  return found.has(Math.max(1, Math.floor(pageNumber)))
}

/** Pages in the inclusive range that already have selectable text (one PDF open). */
export async function pdfFilePagesWithSelectableText(
  absFilePath: string,
  startPdfPage: number,
  endPdfPage: number,
): Promise<Set<number>> {
  const start = Math.max(1, Math.floor(startPdfPage))
  const end = Math.max(start, Math.floor(endPdfPage))
  const found = new Set<number>()
  const doc = await openPdfDocument(absFilePath)
  try {
    const hi = Math.min(end, doc.numPages)
    for (let pageNo = start; pageNo <= hi; pageNo += 1) {
      const page = await doc.getPage(pageNo)
      const textContent = await page.getTextContent()
      const items: PdfTextItem[] = []
      for (const raw of textContent.items) {
        if (!raw || typeof raw !== 'object') continue
        const src = raw as { str?: unknown; transform?: unknown }
        if (typeof src.str !== 'string' || !src.str.trim()) continue
        if (!Array.isArray(src.transform)) continue
        items.push({
          str: src.str,
          transform: src.transform as number[],
        })
      }
      if (pdfTextItemsHaveSelectableText(items)) found.add(pageNo)
    }
  } finally {
    try {
      await doc.destroy()
    } catch {
      // ignore
    }
  }
  return found
}

/** Page count only — for accurate printed→PDF mapping before extract. */
export async function getPdfTotalPages(absFilePath: string): Promise<number> {
  const doc = await openPdfDocument(absFilePath)
  const n = doc.numPages
  try {
    await doc.destroy()
  } catch {
    // ignore
  }
  return n
}
