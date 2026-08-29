'use client'

import { loadCachedPdfDocument } from '@/lib/books/pdf-thumbnail-cache'
import { mergePdfTextItemsToLines, type PdfTextItem } from '@/lib/books/toc-import'
import {
  isFrontMatterCompanionPage,
  proposeTocPdfRange,
  scoreTocCandidatePage,
  shouldEarlyStopTocScan,
  TOC_DETECT_COMPANION_MIN_SCORE,
  TOC_DETECT_DEFAULT_MAX_SCAN,
  TOC_DETECT_MIN_PAGE_SCORE,
  type TocRangeProposal,
} from '@/lib/books/toc-page-detect'
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

export type DetectTocRangeResult =
  | { ok: true; proposal: TocRangeProposal; numPages: number; pagesWithText: number }
  | { ok: false; reason: 'no_text' | 'no_toc_signal' | 'no_file'; numPages: number; pagesWithText: number }

function pageContinuesTocBlock(text: string, score: number, minScore: number): boolean {
  if (score >= minScore) return true
  if (score >= TOC_DETECT_COMPANION_MIN_SCORE) return true
  return isFrontMatterCompanionPage(text)
}

/**
 * Scan early PDF pages (selectable text only), score TOC-likeness, propose a range.
 * Stops early once a TOC block ends and the next pages look like body content.
 * After Contents, peeks further so Scope / Academic Skills pages are not skipped.
 */
export async function detectTocPdfRangeFromFileUrl(
  fileUrl: string,
  options?: {
    maxScanPages?: number
    minScore?: number
    onProgress?: (message: string) => void
  },
): Promise<DetectTocRangeResult> {
  if (!fileUrl.trim()) {
    return { ok: false, reason: 'no_file', numPages: 0, pagesWithText: 0 }
  }

  const maxScan = options?.maxScanPages ?? TOC_DETECT_DEFAULT_MAX_SCAN
  const minScore = options?.minScore ?? TOC_DETECT_MIN_PAGE_SCORE
  const pdf = await loadCachedPdfDocument(fileUrl)
  const numPages = pdf.numPages
  const limit = Math.min(maxScan, numPages)

  const pages: Array<{ pdfPage: number; text: string }> = []
  let pagesWithText = 0
  let tocStartPage: number | null = null
  let tocEndPage: number | null = null
  let contentsEndedAtPage: number | null = null
  let earlyStopped = false

  for (let p = 1; p <= limit; p++) {
    options?.onProgress?.(`Scanning page ${p} of ${limit} for contents…`)
    const text = await extractPagePlainText(pdf, p)
    if (text.replace(/\s+/g, ' ').trim().length >= 12) pagesWithText += 1
    pages.push({ pdfPage: p, text })

    const { score, reasons } = scoreTocCandidatePage(text)
    if (pageContinuesTocBlock(text, score, minScore)) {
      if (tocStartPage == null) tocStartPage = p
      tocEndPage = p
      if (reasons.includes('contents') || reasons.includes('table_of_contents')) {
        contentsEndedAtPage = p
      }
    } else if (
      shouldEarlyStopTocScan({
        pdfPage: p,
        pageScore: score,
        tocStartPage,
        tocEndPage,
        minScore,
        forcePeekAfterContents: true,
        contentsEndedAtPage,
      })
    ) {
      earlyStopped = true
      break
    }
  }

  if (pagesWithText === 0) {
    return { ok: false, reason: 'no_text', numPages, pagesWithText: 0 }
  }

  const proposal = proposeTocPdfRange(pages, { maxScanPages: maxScan, minScore })
  if (!proposal) {
    return { ok: false, reason: 'no_toc_signal', numPages, pagesWithText }
  }

  return {
    ok: true,
    proposal: { ...proposal, earlyStopped: earlyStopped || proposal.earlyStopped },
    numPages,
    pagesWithText,
  }
}
