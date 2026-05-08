import type { BookRecord, BookUnitRecord } from '@/lib/books/types'
import { resolveAlignedAnchorPage, type PageNumberingMode } from '@/lib/books/page-numbering'
import { clampPdfPageToVisible, getUnitPageBounds, getVisiblePdfPages } from '@/lib/books/page-range'

/**
 * Build a two-page window from **already-resolved** 1-based PDF page indices.
 * If the span is longer than two pages, only the first two are used so Gemini stays focused.
 */
export function pdfTwoPageWindowForVocabPart(
  startHint?: number | null,
  endHint?: number | null,
): { start: number; end: number } {
  const s =
    typeof startHint === 'number' && Number.isFinite(startHint) ? Math.max(1, Math.floor(startHint)) : 1
  let e =
    typeof endHint === 'number' && Number.isFinite(endHint) ? Math.max(s, Math.floor(endHint)) : s + 1
  if (e <= s) e = s + 1
  const span = e - s + 1
  if (span > 2) {
    return { start: s, end: s + 1 }
  }
  return { start: s, end: e }
}

/**
 * Map section `startPageHint` / `endPageHint` (printed / effective in mapped mode) to a
 * two-page **PDF** window, matching reader alignment (hidden / not-counted pages).
 */
export function resolveVocabPartPdfWindow(
  startHint: number | null | undefined,
  endHint: number | null | undefined,
  book: BookRecord | null | undefined,
  unit: BookUnitRecord | null | undefined,
  totalPdfPages: number | null,
  mode: PageNumberingMode = 'mapped',
): { start: number; end: number } {
  const naive = pdfTwoPageWindowForVocabPart(
    typeof startHint === 'number' && Number.isFinite(startHint) ? startHint : undefined,
    typeof endHint === 'number' && Number.isFinite(endHint) ? endHint : undefined,
  )
  if (!unit || totalPdfPages == null || totalPdfPages < 1) return naive

  const resolveOne = (h: number | null | undefined): number | null => {
    if (typeof h !== 'number' || !Number.isFinite(h)) return null
    const rounded = Math.max(1, Math.floor(h))
    return resolveAlignedAnchorPage(rounded, book, unit, totalPdfPages, mode) ?? rounded
  }

  const visible = getVisiblePdfPages(unit, totalPdfPages, book)
  const bounds = getUnitPageBounds(unit, totalPdfPages)

  const clamp = (pdf: number) =>
    visible.length ? clampPdfPageToVisible(pdf, visible, bounds) : clampPdfPageToVisible(pdf, [], bounds)

  const sPdf = clamp(resolveOne(startHint) ?? naive.start)
  const eResolved = resolveOne(endHint)
  const ePdf = eResolved != null ? clamp(eResolved) : undefined

  return pdfTwoPageWindowForVocabPart(sPdf, ePdf)
}
