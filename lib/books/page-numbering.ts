import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import {
  buildPageAlignmentRuntime,
  resolveEffectiveAnchorToPdfPage,
  type PageAlignmentRuntime,
} from '@/lib/books/page-alignment-runtime'
import { getFileAlignment } from '@/lib/books/page-range'

export type PageNumberingMode = 'mapped' | 'original'

export function getPageAlignmentRuntime(
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
): PageAlignmentRuntime {
  if (!book || !unit) return buildPageAlignmentRuntime(null, [], [])
  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  return buildPageAlignmentRuntime(totalPdfPages, hiddenPdfPages, notCountedPdfPages)
}

export function getEffectivePageTotal(
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
): number {
  if (!book || !unit) return Math.max(1, totalPdfPages ?? 1)
  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  if (!notCountedPdfPages.length && !hiddenPdfPages.length) {
    return Math.max(1, totalPdfPages ?? 1)
  }
  const runtime = getPageAlignmentRuntime(book, unit, totalPdfPages)
  if (runtime.effectiveTotal > 0) return runtime.effectiveTotal
  return Math.max(1, totalPdfPages ?? 1)
}

export function resolveMappedPageToPdfPage(
  mappedPage: number | null | undefined,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
): number | null {
  return resolveAlignedAnchorPage(mappedPage, book, unit, totalPdfPages, 'mapped')
}

export function mapPdfPageToDisplayLabel(
  pdfPage: number,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
  mode: PageNumberingMode = 'mapped',
): string {
  const rounded = Math.max(1, Math.floor(pdfPage))
  if (mode === 'original' || !book || !unit) return String(rounded)
  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  const runtime = buildPageAlignmentRuntime(totalPdfPages, hiddenPdfPages, notCountedPdfPages)
  if (runtime.effectiveTotal <= 0) return String(rounded)
  const mapped = runtime.effectivePageByPdf.get(rounded)
  return mapped != null ? String(mapped) : '·'
}

export function mapPdfSpreadToDisplayLabel(
  leftPdfPage: number,
  rightPdfPage: number | null,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
  mode: PageNumberingMode = 'mapped',
): string {
  const left = mapPdfPageToDisplayLabel(leftPdfPage, book, unit, totalPdfPages, mode)
  if (rightPdfPage == null) return left
  const right = mapPdfPageToDisplayLabel(rightPdfPage, book, unit, totalPdfPages, mode)
  return `${left}-${right}`
}

export function resolveAlignedAnchorPage(
  anchor: number | null | undefined,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
  mode: PageNumberingMode = 'mapped',
): number | null {
  if (typeof anchor !== 'number' || !Number.isFinite(anchor)) return null
  const rounded = Math.max(1, Math.round(anchor))
  if (mode === 'original' || !book || !unit) return rounded
  const { notCountedPdfPages, hiddenPdfPages } = getFileAlignment(book, unit.filePath)
  if (!notCountedPdfPages.length && !hiddenPdfPages.length) return rounded
  const runtime = buildPageAlignmentRuntime(totalPdfPages, hiddenPdfPages, notCountedPdfPages)
  return resolveEffectiveAnchorToPdfPage(rounded, runtime) ?? rounded
}

/**
 * Format a page span from **printed / effective** anchors (`startPageHint` / `endPageHint`).
 * In `mapped` mode, shows those numbers as-is. In `original` mode, shows underlying PDF indices.
 */
export function formatEffectivePageSpan(
  start: number | null,
  end: number | null,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
  mode: PageNumberingMode = 'mapped',
): string {
  if (start == null) return 'pages —'
  const s = Math.max(1, Math.floor(start))
  if (mode === 'original' && book && unit) {
    const leftPdf = resolveAlignedAnchorPage(s, book, unit, totalPdfPages, 'mapped') ?? s
    if (end == null || end <= s) return `p${leftPdf}`
    const e = Math.max(1, Math.floor(end))
    const rightPdf = resolveAlignedAnchorPage(e, book, unit, totalPdfPages, 'mapped') ?? e
    const lo = Math.min(leftPdf, rightPdf)
    const hi = Math.max(leftPdf, rightPdf)
    return `p${lo}-${hi}`
  }
  if (mode === 'original') {
    if (end == null || end <= s) return `p${s}`
    const e = Math.max(1, Math.floor(end))
    return `p${s}-${e}`
  }
  if (end == null || end <= s) return `p${s}`
  const e = Math.max(1, Math.floor(end))
  return `p${s}-${e}`
}

