/** Isolated overlay storage for Books workshop — never a real roster student. */
export const BOOKS_WORKSHOP_STUDENT_ID = '__books_workshop__'

export type BooksWorkshopSectionKind = 'story' | 'vocab' | 'unmarked' | 'exercise'

export type BooksWorkshopMarkPhase = 'idle' | 'span' | 'pickType'

export type BooksWorkshopPlace = {
  bookTitle?: string | null
  unitTitle?: string | null
  lessonTitle?: string | null
  partTitle?: string | null
  typeLabel?: string | null
  pageRangeLabel?: string | null
}

export type BooksWorkshopOpenRequest = {
  bookId: string
  unitId: string
  pdfPage: number
  /** Outline story key — used in later story-tools phases. */
  storyId?: string | null
  kind?: BooksWorkshopSectionKind
  /** Outline / workshop vocab part (context store). */
  lessonId?: string | null
  partId?: string | null
  /** Printed/display page hints for vocab scan (optional). */
  startPageHint?: number | null
  endPageHint?: number | null
} & BooksWorkshopPlace

/** Synthetic lesson bucket for Mark → Vocab (no outline). */
export const WORKSHOP_MANUAL_VOCAB_LESSON_ID = '__workshop_vocab__'

export function workshopManualVocabPartId(localId: string): string {
  return `vocab-${localId.trim()}`
}

export type BooksWorkshopPlaceSegments = {
  ancestors: string[]
  current: string
  typeChip: string | null
}

function cleanLabel(value?: string | null): string {
  return value?.trim() ?? ''
}

function labelsMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Place-bar identity: muted ancestors, current part, optional type chip.
 * Pages stay out — bottom chrome owns the page jump.
 */
export function workshopPlaceSegments(
  place: BooksWorkshopPlace,
  kind?: BooksWorkshopSectionKind | null,
): BooksWorkshopPlaceSegments {
  const book = cleanLabel(place.bookTitle)
  const unit = cleanLabel(place.unitTitle)
  const lesson = cleanLabel(place.lessonTitle)
  const part = cleanLabel(place.partTitle)
  const type = cleanLabel(place.typeLabel)

  const current = part || type || book || 'Book'

  const ancestors: string[] = []
  const currentIsBook = Boolean(book) && labelsMatch(book, current) && !part && !type
  if (book && !labelsMatch(book, current)) ancestors.push(book)
  if (
    !currentIsBook &&
    unit &&
    (!book || !labelsMatch(unit, book)) &&
    !labelsMatch(unit, current)
  ) {
    ancestors.push(unit)
  }
  if (!currentIsBook && lesson && !labelsMatch(lesson, current)) ancestors.push(lesson)

  let typeChip: string | null = null
  if (type && !labelsMatch(type, current)) {
    typeChip = type
  } else if (kind === 'unmarked' && !type) {
    typeChip = 'Unmarked'
  } else if (kind === 'exercise' && !type) {
    typeChip = 'Exercise'
  } else if (kind === 'vocab' && !type) {
    typeChip = 'Vocab'
  }

  return { ancestors, current, typeChip }
}

/** Joined place line for aria-label / tests. Pages omitted (bottom chrome owns them). */
export function formatWorkshopPlaceLine(
  place: BooksWorkshopPlace,
  kind?: BooksWorkshopSectionKind | null,
): string {
  const { ancestors, current, typeChip } = workshopPlaceSegments(place, kind)
  const bits = [...ancestors, current]
  if (typeChip) bits.push(typeChip)
  return bits.join(' · ') || 'Book'
}
