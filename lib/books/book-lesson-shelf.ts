import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import { resolvePartStructureTag } from '@/lib/books/part-structure-tag'
import { resolveTocExtractProfileForBook, type TocExtractProfileId } from '@/lib/books/toc-extract-profile'
import {
  bookHasMultipleVolumes,
  listBookVolumes,
  unitsForVolume,
  volumeNeedsOutline,
} from '@/lib/books/book-volumes'
import { bookHasDistinctUnitFiles } from '@/lib/books/split-stacked-pdf-ranges'
import { bookHasTocMapping } from '@/lib/books/strip-book-toc-mapping'
import {
  resolveOutlinePrintedStartPdfPage,
  resolveUnitCoverThumbPdfPage,
} from '@/lib/books/story-thumb-pdf-page'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

export type BookLessonShelfCardKind = 'lesson' | 'unit'

export interface BookLessonShelfCard {
  kind: BookLessonShelfCardKind
  id: string
  title: string
  /** Short label e.g. L1, U1 */
  indexLabel: string
  unitId: string
  /** Lesson that owns the cover story (unit cards with lessons). */
  lessonId?: string
  /**
   * Printed/effective start for PDF thumb mapping.
   * Unit covers: first page of the unit (startPageHint / pdf range start).
   * Lesson helpers still prefer main_story → paired_story → lesson start.
   */
  printedStart: number | null
}

export interface BookLessonShelfRow {
  unit: BookUnitRecord
  cards: BookLessonShelfCard[]
}

/** Shelf group: one volume (or the whole book when volumes are unused). */
export interface BookLessonShelfVolumeSection {
  volumeId: string | null
  volumeTitle: string | null
  needsOutline: boolean
  rows: BookLessonShelfRow[]
}

/** True when at least one unit has a PDF file to open. */
export function bookHasBrowsablePdf(book: BookRecord): boolean {
  return book.units.some((unit) => Boolean(unit.filePath?.trim()))
}

function unitOpenerPrintedStart(unit: BookUnitRecord): number | null {
  if (typeof unit.startPageHint === 'number') return Math.round(unit.startPageHint)
  if (typeof unit.pdfPageRange?.start === 'number') return unit.pdfPageRange.start
  return null
}

function unitShelfCard(
  unit: BookUnitRecord,
  unitIndex: number,
  opts?: { printedStart?: number | null; lessonId?: string },
): BookLessonShelfCard {
  return {
    kind: 'unit',
    id: unit.id,
    title: unit.title,
    indexLabel: `U${unitIndex + 1}`,
    unitId: unit.id,
    ...(opts?.lessonId ? { lessonId: opts.lessonId } : {}),
    printedStart: opts?.printedStart ?? unitOpenerPrintedStart(unit) ?? 1,
  }
}

/**
 * True when this book should show the empty outline (or add-PDF) CTA
 * instead of lesson/unit cards. Multi-volume books use per-volume sections instead.
 */
export function bookNeedsLessonShelfOutline(book: BookRecord): boolean {
  if (isPresentationBook(book)) return book.units.length === 0
  if (bookHasMultipleVolumes(book)) return false
  if (bookHasDistinctUnitFiles(book)) return false
  return !bookHasTocMapping(book)
}

function rowsForUnits(book: BookRecord, units: BookUnitRecord[]): BookLessonShelfRow[] {
  const rows: BookLessonShelfRow[] = []
  const profile = resolveTocExtractProfileForBook(book)
  for (const unit of units) {
    const unitIndex = book.units.findIndex((u) => u.id === unit.id)
    const lessons = unit.lessons ?? []
    if (lessons.length === 0) {
      if (unit.filePath?.trim()) {
        rows.push({ unit, cards: [unitShelfCard(unit, unitIndex >= 0 ? unitIndex : 0)] })
      }
      continue
    }
    const cover = resolveUnitShelfThumb(unit, profile)
    rows.push({
      unit,
      cards: [
        unitShelfCard(unit, unitIndex >= 0 ? unitIndex : 0, {
          printedStart: cover.printedStart,
          lessonId: cover.lessonId,
        }),
      ],
    })
  }
  return rows
}

/**
 * Rows for the lesson shelf: one row per unit with lessons (normal books),
 * or unit cards for presentation books / multi-file books awaiting outline.
 */
export function buildBookLessonShelfRows(book: BookRecord): BookLessonShelfRow[] {
  if (bookNeedsLessonShelfOutline(book)) return []

  if (isPresentationBook(book)) {
    return book.units.map((unit, unitIndex) => ({
      unit,
      cards: [unitShelfCard(unit, unitIndex)],
    }))
  }

  return rowsForUnits(book, book.units)
}

/** Volume-aware shelf sections (multi-PDF books) or a single untitled section. */
export function buildBookLessonShelfSections(book: BookRecord): BookLessonShelfVolumeSection[] {
  if (isPresentationBook(book)) {
    return [
      {
        volumeId: null,
        volumeTitle: null,
        needsOutline: book.units.length === 0,
        rows: buildBookLessonShelfRows(book),
      },
    ]
  }

  const volumes = listBookVolumes(book)
  if (volumes.length >= 2) {
    return volumes.map((vol) => {
      const units = unitsForVolume(book, vol.id)
      const needs = volumeNeedsOutline(book, vol.id)
      return {
        volumeId: vol.id,
        volumeTitle: vol.title,
        needsOutline: needs,
        rows: needs ? [] : rowsForUnits(book, units),
      }
    })
  }

  if (bookNeedsLessonShelfOutline(book)) {
    return [
      {
        volumeId: null,
        volumeTitle: null,
        needsOutline: true,
        rows: [],
      },
    ]
  }

  return [
    {
      volumeId: null,
      volumeTitle: null,
      needsOutline: false,
      rows: buildBookLessonShelfRows(book),
    },
  ]
}

/**
 * Thumb face for a lesson: main story start → paired story → lesson outline start.
 */
export function resolveLessonShelfThumbPrintedStart(
  unit: BookUnitRecord,
  lesson: BookLessonRecord,
  lessonIndex: number,
  profile: TocExtractProfileId = 'journeys',
): number | null {
  const lessons = unit.lessons ?? []
  const lessonRange = pageRangeForIndex(lessons, lessonIndex)
  const parts = lesson.parts ?? []
  if (parts.length > 0) {
    const mainIdx = parts.findIndex((p, i) => resolvePartStructureTag(p, i, profile) === 'main_story')
    if (mainIdx >= 0) {
      const start = pageRangeForIndex(parts, mainIdx, lessonRange.start, lessonRange.end).start
      if (start != null) return start
    }
    const pairedIdx = parts.findIndex((p, i) => resolvePartStructureTag(p, i, profile) === 'paired_story')
    if (pairedIdx >= 0) {
      const start = pageRangeForIndex(parts, pairedIdx, lessonRange.start, lessonRange.end).start
      if (start != null) return start
    }
  }
  return lessonRange.start
}

export type UnitShelfThumb = {
  printedStart: number | null
  /** First lesson — used when opening the unit cover into the lesson desk. */
  lessonId?: string
}

/**
 * Unit cover face: always the first page of the unit (not the first story).
 * `profile` is unused; kept so existing callers stay typed the same.
 */
export function resolveUnitShelfThumb(
  unit: BookUnitRecord,
  _profile: TocExtractProfileId = 'journeys',
): UnitShelfThumb {
  void _profile
  const lessons = unit.lessons ?? []
  return {
    printedStart: unitOpenerPrintedStart(unit) ?? (lessons[0] ? pageRangeForIndex(lessons, 0).start : null),
    lessonId: lessons[0]?.id,
  }
}

/** Printed start for a unit cover thumb (first page of the unit). */
export function resolveUnitShelfThumbPrintedStart(
  unit: BookUnitRecord,
  profile: TocExtractProfileId = 'journeys',
): number | null {
  return resolveUnitShelfThumb(unit, profile).printedStart
}

/** PDF page for a shelf card thumb — outline start through hidden/not-counted alignment. */
export function resolveLessonShelfCardPdfPage(
  book: BookRecord,
  unit: BookUnitRecord,
  card: BookLessonShelfCard,
  totalPdfPages: number | null,
): number {
  return (
    resolveOutlinePrintedStartPdfPage(card.printedStart, book, unit, totalPdfPages) ??
    resolveUnitCoverThumbPdfPage(unit, book, totalPdfPages)
  )
}
