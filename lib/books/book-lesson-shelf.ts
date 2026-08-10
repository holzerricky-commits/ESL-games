import { isPresentationBook } from '@/lib/books/book-catalog-labels'
import { effectivePartStructureTag } from '@/lib/books/part-structure-tag'
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

/**
 * True when this book should show the empty outline (or add-PDF) CTA
 * instead of lesson/unit cards.
 */
export function bookNeedsLessonShelfOutline(book: BookRecord): boolean {
  if (isPresentationBook(book)) return book.units.length === 0
  return !bookHasTocMapping(book)
}

/**
 * Rows for the lesson shelf: one row per unit with lessons (normal books),
 * or unit cards for presentation books.
 */
export function buildBookLessonShelfRows(book: BookRecord): BookLessonShelfRow[] {
  if (bookNeedsLessonShelfOutline(book)) return []

  if (isPresentationBook(book)) {
    return book.units.map((unit, unitIndex) => ({
      unit,
      cards: [
        {
          kind: 'unit' as const,
          id: unit.id,
          title: unit.title,
          indexLabel: `U${unitIndex + 1}`,
          unitId: unit.id,
          printedStart:
            typeof unit.startPageHint === 'number'
              ? Math.round(unit.startPageHint)
              : unit.pdfPageRange?.start ?? 1,
        },
      ],
    }))
  }

  const rows: BookLessonShelfRow[] = []
  for (const unit of book.units) {
    const lessons = unit.lessons ?? []
    if (lessons.length === 0) continue
    const cards: BookLessonShelfCard[] = lessons.map((lesson, lessonIndex) =>
      lessonToShelfCard(unit, lesson, lessonIndex),
    )
    rows.push({ unit, cards })
  }
  return rows
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
