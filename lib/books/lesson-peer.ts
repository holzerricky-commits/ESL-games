import {
  findPeerLiteratureBooks,
  findPeerWorkshopBooks,
} from '@/lib/books/reading-story-workshop-peers'
import { resolveBookCatalogIdentity } from '@/lib/books/book-catalog-labels'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

/** One side of a teaching week: the open book, or its Workshop / Literature twin. */
export type LessonPeerRef = {
  bookId: string
  unitId: string
  lessonId: string
}

/** Week number from "Lesson 1" or "Week 1". Handbook-style titles have none. */
export function lessonWeekNumber(title: string | null | undefined): number | null {
  const match = (title ?? '').match(/\b(?:lesson|week)\s+(\d+)\b/i)
  if (!match?.[1]) return null
  const week = Number(match[1])
  return Number.isFinite(week) && week > 0 ? week : null
}

function unitThemeKey(title: string | null | undefined): string {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function unitsWithLessons(book: BookRecord): BookUnitRecord[] {
  return (book.units ?? []).filter((unit) => (unit.lessons ?? []).length > 0)
}

function findPeerBooks(libraryBooks: readonly BookRecord[], book: BookRecord): BookRecord[] {
  const role = resolveBookCatalogIdentity(book).role
  if (role === 'Workshop') return findPeerLiteratureBooks(libraryBooks, book)
  if (role === 'Literature') return findPeerWorkshopBooks(libraryBooks, book)
  return []
}

/** Same unit theme when titles match; otherwise the unit at the same index among outlined units. */
function findPeerUnit(
  peer: BookRecord,
  sourceBook: BookRecord,
  sourceUnit: BookUnitRecord,
): BookUnitRecord | null {
  const peerUnits = unitsWithLessons(peer)
  const theme = unitThemeKey(sourceUnit.title)
  if (theme) {
    const titled = peerUnits.find((unit) => unitThemeKey(unit.title) === theme)
    if (titled) return titled
  }
  const index = unitsWithLessons(sourceBook).findIndex((unit) => unit.id === sourceUnit.id)
  if (index < 0) return null
  return peerUnits[index] ?? null
}

function findLessonForWeek(unit: BookUnitRecord, week: number): BookLessonRecord | null {
  return (unit.lessons ?? []).find((lesson) => lessonWeekNumber(lesson.title) === week) ?? null
}

/**
 * The open lesson, plus the paired lesson in the other Wonders book when one exists.
 * The open lesson is always first. A single-book series, or a lesson with no week number, is just itself.
 */
export function lessonRefsForTeachingWeek(
  libraryBooks: readonly BookRecord[],
  book: BookRecord,
  unit: BookUnitRecord,
  lessonId: string,
): LessonPeerRef[] {
  const self: LessonPeerRef = { bookId: book.id, unitId: unit.id, lessonId }
  const lesson = (unit.lessons ?? []).find((item) => item.id === lessonId)
  const week = lesson ? lessonWeekNumber(lesson.title) : null
  if (!lesson || week == null) return [self]

  for (const peer of findPeerBooks(libraryBooks, book)) {
    const peerUnit = findPeerUnit(peer, book, unit)
    const peerLesson = peerUnit ? findLessonForWeek(peerUnit, week) : null
    if (!peerUnit || !peerLesson) continue
    return [self, { bookId: peer.id, unitId: peerUnit.id, lessonId: peerLesson.id }]
  }
  return [self]
}
