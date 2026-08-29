import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import { effectivePartStructureTag } from '@/lib/books/part-structure-tag'
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
  lessonId?: string
  /**
   * Printed/effective start for PDF thumb mapping.
   * Prefers main_story (then paired_story) over bare lesson start.
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

function unitShelfCard(unit: BookUnitRecord, unitIndex: number): BookLessonShelfCard {
  return {
    kind: 'unit',
    id: unit.id,
    title: unit.title,
    indexLabel: `U${unitIndex + 1}`,
    unitId: unit.id,
    printedStart:
      typeof unit.startPageHint === 'number'
        ? Math.round(unit.startPageHint)
        : unit.pdfPageRange?.start ?? 1,
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
  for (const unit of units) {
    const unitIndex = book.units.findIndex((u) => u.id === unit.id)
    const lessons = unit.lessons ?? []
    if (lessons.length === 0) {
      if (unit.filePath?.trim()) {
        rows.push({ unit, cards: [unitShelfCard(unit, unitIndex >= 0 ? unitIndex : 0)] })
      }
      continue
    }
    const cards: BookLessonShelfCard[] = lessons.map((lesson, lessonIndex) =>
      lessonToShelfCard(unit, lesson, lessonIndex),
    )
    rows.push({ unit, cards })
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
): number | null {
  const lessons = unit.lessons ?? []
  const lessonRange = pageRangeForIndex(lessons, lessonIndex)
  const parts = lesson.parts ?? []
  if (parts.length > 0) {
    const mainIdx = parts.findIndex((p) => effectivePartStructureTag(p) === 'main_story')
    if (mainIdx >= 0) {
      const start = pageRangeForIndex(parts, mainIdx, lessonRange.start, lessonRange.end).start
      if (start != null) return start
    }
    const pairedIdx = parts.findIndex((p) => effectivePartStructureTag(p) === 'paired_story')
    if (pairedIdx >= 0) {
      const start = pageRangeForIndex(parts, pairedIdx, lessonRange.start, lessonRange.end).start
      if (start != null) return start
    }
  }
  return lessonRange.start
}

function lessonToShelfCard(
  unit: BookUnitRecord,
  lesson: BookLessonRecord,
  lessonIndex: number,
): BookLessonShelfCard {
  return {
    kind: 'lesson',
    id: lesson.id,
    title: lesson.title,
    indexLabel: `L${lessonIndex + 1}`,
    unitId: unit.id,
    lessonId: lesson.id,
    printedStart: resolveLessonShelfThumbPrintedStart(unit, lesson, lessonIndex),
  }
}

/** PDF page for a shelf card thumb — outline start through hidden/not-counted alignment. */
export function resolveLessonShelfCardPdfPage(
  book: BookRecord,
  unit: BookUnitRecord,
  card: BookLessonShelfCard,
  totalPdfPages: number | null,
): number {
  if (card.kind === 'unit') {
    return resolveUnitCoverThumbPdfPage(unit, book, totalPdfPages)
  }
  return (
    resolveOutlinePrintedStartPdfPage(card.printedStart, book, unit, totalPdfPages) ??
    resolveUnitCoverThumbPdfPage(unit, book, totalPdfPages)
  )
}
