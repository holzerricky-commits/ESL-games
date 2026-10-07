import { resolveMappedPageToPdfPage } from '@/lib/books/page-numbering'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'
import type { StudentRecord } from '@/lib/types'

export type StudentBookPlace = NonNullable<StudentRecord['bookPlaces']>[string]
export type StudentBookPlaces = Record<string, StudentBookPlace>

export type BookOpenTarget = { unitId: string; pdfPage: number }

export type LessonSpan = {
  unitId: string
  lessonId: string
  startPdf: number
  endPdf: number
}

export function sanitizeStudentBookPlaces(raw: unknown): StudentBookPlaces {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: StudentBookPlaces = {}
  for (const [bookIdRaw, entryRaw] of Object.entries(raw as Record<string, unknown>)) {
    const bookId = bookIdRaw.trim()
    if (!bookId || !entryRaw || typeof entryRaw !== 'object') continue
    const entry = entryRaw as Record<string, unknown>
    const unitId = typeof entry.unitId === 'string' ? entry.unitId.trim() : ''
    const page = Number(entry.pdfPage)
    if (!unitId || !Number.isFinite(page) || page < 1) continue
    const updatedAt =
      typeof entry.updatedAt === 'string' && Number.isFinite(Date.parse(entry.updatedAt))
        ? entry.updatedAt
        : new Date(0).toISOString()
    out[bookId] = { unitId, pdfPage: Math.max(1, Math.floor(page)), updatedAt }
  }
  return out
}

function finitePage(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : null
}

function lessonPrintedStart(lesson: BookLessonRecord): number | null {
  const own = finitePage(lesson.startPageHint)
  if (own != null) return own
  const partStarts = (lesson.parts ?? []).map((p) => finitePage(p.startPageHint)).filter((n): n is number => n != null)
  return partStarts.length ? Math.min(...partStarts) : null
}

function lessonPrintedEnd(lesson: BookLessonRecord): number | null {
  const own = finitePage(lesson.endPageHint)
  if (own != null) return own
  const partEnds = (lesson.parts ?? []).map((p) => finitePage(p.endPageHint)).filter((n): n is number => n != null)
  return partEnds.length ? Math.max(...partEnds) : null
}

function unitLessonSpans(book: BookRecord, unit: BookUnitRecord): LessonSpan[] {
  const lessons = unit.lessons ?? []
  const toPdf = (printed: number) => resolveMappedPageToPdfPage(printed, book, unit, null) ?? printed
  const spans: LessonSpan[] = []
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!
    let startPdf: number | null = null
    let endPdf: number | null = null
    const range = lesson.pdfPageRange
    if (range && finitePage(range.start) != null && finitePage(range.end) != null) {
      startPdf = Math.floor(range.start)
      endPdf = Math.floor(range.end)
    } else {
      const start = lessonPrintedStart(lesson)
      let end = lessonPrintedEnd(lesson)
      if (end == null) {
        const next = lessons[i + 1]
        const nextStart = next ? lessonPrintedStart(next) : null
        if (nextStart != null) end = nextStart - 1
        else end = finitePage(unit.endPageHint)
      }
      if (start != null) startPdf = toPdf(start)
      if (end != null) endPdf = toPdf(end)
    }
    if (startPdf == null || endPdf == null || endPdf < startPdf) continue
    spans.push({ unitId: unit.id, lessonId: lesson.id, startPdf, endPdf })
  }
  return spans
}

/** Lessons with a usable page range, in book order (unit by unit). Empty = no outline. */
export function listBookLessonSpans(book: BookRecord): LessonSpan[] {
  return book.units.flatMap((unit) => unitLessonSpans(book, unit))
}

export function bookHasLessonOutline(book: BookRecord | null | undefined): boolean {
  return !!book && listBookLessonSpans(book).length > 0
}

function lessonIndexAtPlace(spans: LessonSpan[], place: BookOpenTarget): number {
  for (let i = spans.length - 1; i >= 0; i--) {
    const s = spans[i]!
    if (s.unitId === place.unitId && place.pdfPage >= s.startPdf && place.pdfPage <= s.endPdf) return i
  }
  return -1
}

/**
 * True when the spread at this place shows the lesson's last page.
 * `pdfPage` is the left page of the spread; the right page is the next one.
 */
export function isPlaceAtLessonEnd(book: BookRecord | null | undefined, place: BookOpenTarget): boolean {
  if (!book) return false
  const spans = listBookLessonSpans(book)
  const idx = lessonIndexAtPlace(spans, place)
  if (idx < 0) return false
  return place.pdfPage + 1 >= spans[idx]!.endPdf
}

/** Where to open this book: the saved place, or the next lesson's first page once the lesson was finished. */
export function resolveOpenTargetForPlace(
  book: BookRecord | null | undefined,
  place: BookOpenTarget,
): BookOpenTarget {
  if (!book) return { unitId: place.unitId, pdfPage: place.pdfPage }
  const spans = listBookLessonSpans(book)
  const idx = lessonIndexAtPlace(spans, place)
  if (idx < 0 || place.pdfPage + 1 < spans[idx]!.endPdf) {
    return { unitId: place.unitId, pdfPage: place.pdfPage }
  }
  const next = spans[idx + 1]
  if (!next || !book.units.some((u) => u.id === next.unitId)) {
    return { unitId: place.unitId, pdfPage: place.pdfPage }
  }
  return { unitId: next.unitId, pdfPage: next.startPdf }
}

/**
 * Which assigned book is up next: the book taught last, unless its place reached the end of a
 * lesson — then the next assigned book (wrapping). Books without an outline never finish.
 * Returns null when no assigned book has a place yet.
 */
export function resolveUpNextBookId(input: {
  assignedBookIds: string[]
  places: StudentBookPlaces
  lastTaughtBookId?: string | null
  booksById: Map<string, BookRecord>
}): string | null {
  const assigned = input.assignedBookIds.map((id) => id.trim()).filter((id) => id && input.booksById.has(id))
  if (!assigned.length) return null

  let current = input.lastTaughtBookId?.trim() || ''
  if (!current || !assigned.includes(current) || !input.places[current]) {
    let bestMs = Number.NEGATIVE_INFINITY
    current = ''
    for (const id of assigned) {
      const place = input.places[id]
      if (!place) continue
      const ms = Date.parse(place.updatedAt)
      const t = Number.isFinite(ms) ? ms : 0
      if (!current || t > bestMs) {
        current = id
        bestMs = t
      }
    }
  }
  if (!current) return null

  const place = input.places[current]!
  const book = input.booksById.get(current)
  if (assigned.length < 2 || !isPlaceAtLessonEnd(book, place)) return current
  const idx = assigned.indexOf(current)
  return assigned[(idx + 1) % assigned.length] ?? current
}
