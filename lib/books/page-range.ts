import type { BookPdfPageRange, BookRecord, BookUnitRecord } from '@/lib/books/types'
import { mergeCoverIntoHiddenPages } from '@/lib/books/page-alignment-runtime'

export interface UnitPageBounds {
  min: number
  max: number
}

function normalizeUniquePages(pages: number[] | undefined): number[] {
  if (!pages?.length) return []
  const set = new Set<number>()
  for (const page of pages) {
    if (!Number.isFinite(page)) continue
    const rounded = Math.floor(page)
    if (rounded < 1) continue
    set.add(rounded)
  }
  return [...set].sort((a, b) => a - b)
}

/**
 * Effective inclusive PDF page bounds for a unit.
 * When pdfPageRange is set, clamps end to numPagesFromPdf if the file is shorter than the manifest.
 */
export function getUnitPageBounds(unit: BookUnitRecord, numPagesFromPdf: number | null): UnitPageBounds {
  const docMax =
    numPagesFromPdf != null && numPagesFromPdf > 0 ? numPagesFromPdf : Number.POSITIVE_INFINITY
  if (!unit.pdfPageRange) {
    if (Number.isFinite(docMax)) {
      const max = Math.max(1, docMax)
      return { min: 1, max }
    }
    return { min: 1, max: Number.MAX_SAFE_INTEGER }
  }
  const start = Math.max(1, Math.floor(unit.pdfPageRange.start))
  const rawEnd = Math.floor(unit.pdfPageRange.end)
  const cappedEnd = Number.isFinite(docMax) ? Math.min(rawEnd, docMax) : rawEnd
  const end = Math.max(start, cappedEnd)
  return { min: start, max: end }
}

/**
 * Bounds for reader navigation and page lists, constrained to visible pages.
 */
export function getUnitReaderBounds(
  unit: BookUnitRecord,
  numPagesFromPdf: number | null,
  book: BookRecord | null | undefined,
): UnitPageBounds {
  const base = getUnitPageBounds(unit, numPagesFromPdf)
  const visible = getVisiblePdfPages(unit, numPagesFromPdf, book)
  if (!visible.length) return base
  return { min: visible[0]!, max: visible[visible.length - 1]! }
}

export function clampPdfPage(page: number, bounds: UnitPageBounds): number {
  const n = Number.isFinite(page) ? Math.floor(page) : bounds.min
  return Math.max(bounds.min, Math.min(n, bounds.max))
}

export function getFileAlignment(
  book: BookRecord | null | undefined,
  filePath: string,
): { notCountedPdfPages: number[]; hiddenPdfPages: number[] } {
  const alignment = book?.pageAlignmentByFile?.[filePath]
  return {
    notCountedPdfPages: normalizeUniquePages(alignment?.notCountedPdfPages),
    hiddenPdfPages: mergeCoverIntoHiddenPages(alignment?.hiddenPdfPages),
  }
}

export function getVisiblePdfPages(
  unit: BookUnitRecord,
  numPagesFromPdf: number | null,
  book: BookRecord | null | undefined,
): number[] {
  const bounds = getUnitPageBounds(unit, numPagesFromPdf)
  // When PDF length is unknown and no explicit unit range exists, bounds.max may be extremely large.
  // Defer visible-page enumeration until the real PDF page count is known.
  if (
    numPagesFromPdf == null &&
    !unit.pdfPageRange &&
    (!Number.isFinite(bounds.max) || bounds.max > 10_000)
  ) {
    return []
  }
  const { hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  const hidden = new Set(hiddenPdfPages)
  const out: number[] = []
  for (let page = bounds.min; page <= bounds.max; page++) {
    if (hidden.has(page)) continue
    out.push(page)
  }
  return out
}

export function clampPdfPageToVisible(
  targetPage: number,
  visiblePages: number[],
  fallbackBounds: UnitPageBounds,
): number {
  if (!visiblePages.length) return clampPdfPage(targetPage, fallbackBounds)
  const target = Number.isFinite(targetPage) ? Math.floor(targetPage) : visiblePages[0]!
  if (visiblePages.includes(target)) return target
  let candidate = visiblePages[0]!
  let bestDistance = Math.abs(candidate - target)
  for (const page of visiblePages) {
    const distance = Math.abs(page - target)
    if (distance < bestDistance) {
      candidate = page
      bestDistance = distance
    }
  }
  return candidate
}

export function pdfPageToPrintedPage(_pdfPage: number, _book: BookRecord | null | undefined): number | null {
  return null
}
