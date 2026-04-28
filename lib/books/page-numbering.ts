import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { buildPageAlignmentRuntime, resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'
import { getFileAlignment } from '@/lib/books/page-range'

export type PageNumberingMode = 'mapped' | 'original'

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
  singlePage: boolean,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
  mode: PageNumberingMode = 'mapped',
): string {
  const left = mapPdfPageToDisplayLabel(leftPdfPage, book, unit, totalPdfPages, mode)
  if (singlePage) return left
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

