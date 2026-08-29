'use client'

import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import {
  ALIGN_DETECT_EARLY_BAND_END,
  inferNotCountedFromFolioSamples,
  listAlignDetectScanPages,
  pickPrintedFolioFromPageText,
  type AlignDetectProposal,
  type FolioSample,
} from '@/lib/books/page-alignment-detect'
import { scoreTocCandidatePage } from '@/lib/books/toc-page-detect'
import { mergePdfTextItemsToLines, type PdfTextItem } from '@/lib/books/toc-import'
import type { PDFDocumentProxy } from 'pdfjs-dist'

async function extractPagePlainText(pdf: PDFDocumentProxy, pageNumber: number): Promise<string> {
  if (pageNumber < 1 || pageNumber > pdf.numPages) return ''
  try {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const items: PdfTextItem[] = []
    for (const raw of textContent.items ?? []) {
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
    return mergePdfTextItemsToLines(items).join('\n')
  } catch {
    return ''
  }
}

export type DetectPageAlignmentResult =
  | { ok: true; proposal: AlignDetectProposal; samples: FolioSample[]; numPages: number; pagesWithText: number }
  | {
      ok: false
      reason: 'no_text' | 'no_folio_signal' | 'no_file'
      numPages: number
      pagesWithText: number
      samples: FolioSample[]
    }

/**
 * Scan early + later PDF pages for footer/header Arabic folios and suggest not-counted pages.
 * Later stride matters: front matter often has no printed numbers.
 */
export async function detectPageAlignmentFromFileUrl(
  fileUrl: string,
  options?: {
    /** Ignored for page list shape; scan uses early band + later stride up to LATER_MAX. */
    maxScanPages?: number
    onProgress?: (message: string) => void
  },
): Promise<DetectPageAlignmentResult> {
  if (!fileUrl.trim()) {
    return { ok: false, reason: 'no_file', numPages: 0, pagesWithText: 0, samples: [] }
  }

  const pdf = await loadCachedPdfDocument(fileUrl)
  const numPages = pdf.numPages
  const scanCap =
    options?.maxScanPages != null
      ? Math.min(numPages, Math.max(2, Math.floor(options.maxScanPages)))
      : numPages
  const scanPages = listAlignDetectScanPages(scanCap)

  const samples: FolioSample[] = []
  let pagesWithText = 0

  for (const p of scanPages) {
    const later = p > ALIGN_DETECT_EARLY_BAND_END
    options?.onProgress?.(
      later ? `Checking later pages… ${p}/${scanCap}` : `Checking page numbers… ${p}/${scanCap}`,
    )
    const text = await extractPagePlainText(pdf, p)
    if (text.trim().length >= 8) pagesWithText += 1

    // Skip strong TOC pages — too many trailing page refs.
    const tocScore = scoreTocCandidatePage(text).score
    if (tocScore >= 22) continue

    const folio = pickPrintedFolioFromPageText(text)
    if (folio == null) continue
    samples.push({ pdfPage: p, printedPage: folio })
  }

  if (pagesWithText === 0 && samples.length === 0) {
    return { ok: false, reason: 'no_text', numPages, pagesWithText: 0, samples: [] }
  }

  const proposal = inferNotCountedFromFolioSamples(samples, numPages)
  if (proposal.firstArabicPdfPage == null || proposal.matchingSamples === 0) {
    return { ok: false, reason: 'no_folio_signal', numPages, pagesWithText, samples }
  }

  return { ok: true, proposal, samples, numPages, pagesWithText }
}
