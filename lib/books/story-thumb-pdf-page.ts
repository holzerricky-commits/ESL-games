import type { PageAlignmentRuntime } from '@/lib/books/page-alignment-runtime'
import { resolveEffectiveAnchorToPdfPage } from '@/lib/books/page-alignment-runtime'
import { resolveAlignedAnchorPage } from '@/lib/books/page-numbering'
import type { BookLessonPartRecord, BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

function clampPdfPage(page: number, totalPdfPages: number | null): number {
  const n = Math.max(1, Math.floor(page))
  if (totalPdfPages != null && Number.isFinite(totalPdfPages)) {
    return Math.min(n, Math.floor(totalPdfPages))
  }
  return n
}

/**
 * PDF page index for a unit cover thumb.
 * `startPageHint` is printed/effective when set — convert via book alignment.
 */
export function resolveUnitCoverThumbPdfPage(
  unit: BookUnitRecord,
  book: BookRecord,
  totalPdfPages: number | null,
): number {
  const raw = unit.startPageHint ?? unit.pdfPageRange?.start ?? 1
  const floor = Math.max(1, Math.floor(raw))
  if (typeof unit.startPageHint === 'number') {
    const pdf = resolveAlignedAnchorPage(unit.startPageHint, book, unit, totalPdfPages, 'mapped') ?? floor
    return clampPdfPage(pdf, totalPdfPages)
  }
  return clampPdfPage(floor, totalPdfPages)
}

export type ResolveStoryThumbPdfPageArgs = {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  part: BookLessonPartRecord
  /** Printed/effective start from `pageRangeForIndex` (or equivalent). */
  partRangeStart: number | null
  totalPdfPages: number | null
  /**
   * Wizard live alignment before save. When set, used instead of `book.pageAlignmentByFile`.
   */
  alignmentRuntime?: PageAlignmentRuntime | null
}

/**
 * Story title PDF page for thumbs — printed start → PDF (when TOC-anchored).
 * No +1: the first page of the story range is where the title usually sits.
 */
export function resolveStoryTitleThumbPdfPage(args: ResolveStoryThumbPdfPageArgs): number | null {
  const { book, unit, lesson, part, partRangeStart, totalPdfPages, alignmentRuntime } = args
  if (partRangeStart == null || !Number.isFinite(partRangeStart)) return null

  const tocAnchored =
    typeof part.startPageHint === 'number' || typeof lesson.startPageHint === 'number'

  let startPdf: number = Math.max(1, Math.floor(partRangeStart))
  if (tocAnchored) {
    if (alignmentRuntime) {
      startPdf = resolveEffectiveAnchorToPdfPage(Math.round(partRangeStart), alignmentRuntime) ?? startPdf
    } else {
      startPdf =
        resolveAlignedAnchorPage(partRangeStart, book, unit, totalPdfPages, 'mapped') ?? startPdf
    }
  }

  return clampPdfPage(Math.floor(startPdf), totalPdfPages)
}

/**
 * Mapped PDF page for any outline section start (lesson or part), same math as story thumbs.
 */
export function resolveOutlinePrintedStartPdfPage(
  printedStart: number | null | undefined,
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
): number | null {
  if (typeof printedStart !== 'number' || !Number.isFinite(printedStart)) return null
  const mapped =
    resolveAlignedAnchorPage(printedStart, book, unit, totalPdfPages, 'mapped') ??
    Math.max(1, Math.floor(printedStart))
  return clampPdfPage(mapped, totalPdfPages)
}

/** Inclusive printed span → inclusive mapped PDF span for outline sections. */
export function resolveOutlinePrintedPdfRange(
  printedStart: number | null | undefined,
  printedEnd: number | null | undefined,
  book: BookRecord,
  unit: BookUnitRecord,
  totalPdfPages: number | null,
): { startPdf: number; endPdf: number } | null {
  const startPdf = resolveOutlinePrintedStartPdfPage(printedStart, book, unit, totalPdfPages)
  if (startPdf == null) return null
  const endPrinted =
    typeof printedEnd === 'number' && Number.isFinite(printedEnd) ? printedEnd : printedStart
  const endPdf = resolveOutlinePrintedStartPdfPage(endPrinted, book, unit, totalPdfPages) ?? startPdf
  return {
    startPdf: Math.min(startPdf, endPdf),
    endPdf: Math.max(startPdf, endPdf),
  }
}

/** True when the outline lists exactly one printed page for this section. */
export function isOutlineSinglePageRange(
  printedStart: number | null | undefined,
  printedEnd: number | null | undefined,
): boolean {
  if (typeof printedStart !== 'number' || !Number.isFinite(printedStart)) return true
  if (typeof printedEnd !== 'number' || !Number.isFinite(printedEnd)) return true
  return Math.round(printedStart) === Math.round(printedEnd)
}

/** @deprecated Use {@link resolveStoryTitleThumbPdfPage}. */
export const resolveStoryInteriorThumbPdfPage = resolveStoryTitleThumbPdfPage
