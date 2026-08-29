import type { PDFDocumentProxy } from 'pdfjs-dist'
import { mergePdfTextItemsToLines, type PdfTextItem } from '@/lib/books/toc-import'

/** Minimum joined plain-text length to treat a page as having selectable PDF text. */
export const PDF_PAGE_SELECTABLE_TEXT_MIN_CHARS = 30

const probeCache = new Map<string, boolean>()
const PROBE_CACHE_MAX = 256

function cacheKey(fileUrl: string, pageNumber: number): string {
  return `${fileUrl}::${pageNumber}`
}

function rememberProbe(key: string, value: boolean): boolean {
  if (probeCache.size >= PROBE_CACHE_MAX) {
    const first = probeCache.keys().next().value
    if (first != null) probeCache.delete(first)
  }
  probeCache.set(key, value)
  return value
}

export function pdfTextItemsHaveSelectableText(items: PdfTextItem[]): boolean {
  const lines = mergePdfTextItemsToLines(items)
  const joined = lines.join(' ').replace(/\s+/g, ' ').trim()
  return joined.length >= PDF_PAGE_SELECTABLE_TEXT_MIN_CHARS
}

export async function probePdfPageHasSelectableText(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  fileUrl?: string,
): Promise<boolean> {
  if (fileUrl) {
    const key = cacheKey(fileUrl, pageNumber)
    const cached = probeCache.get(key)
    if (cached != null) return cached
    const result = await probePdfPageHasSelectableTextInner(pdf, pageNumber)
    return rememberProbe(key, result)
  }
  return probePdfPageHasSelectableTextInner(pdf, pageNumber)
}

async function probePdfPageHasSelectableTextInner(
  pdf: PDFDocumentProxy,
  pageNumber: number,
): Promise<boolean> {
  if (pageNumber < 1 || pageNumber > pdf.numPages) return false
  try {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const items = (textContent.items ?? []).filter(
      (item): item is PdfTextItem =>
        item != null &&
        typeof item === 'object' &&
        'str' in item &&
        typeof (item as PdfTextItem).str === 'string',
    )
    return pdfTextItemsHaveSelectableText(items)
  } catch {
    return false
  }
}

/** Drop cached probes for one file URL (after a searchable sidecar is written). */
export function invalidatePdfPageTextProbeCacheForFileUrl(fileUrl: string): void {
  const prefix = `${fileUrl}::`
  for (const key of [...probeCache.keys()]) {
    if (key.startsWith(prefix)) probeCache.delete(key)
  }
}

/** Test helper — clear in-memory probe cache. */
export function clearPdfPageTextProbeCacheForTests(): void {
  probeCache.clear()
}
