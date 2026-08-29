import { resolveBookFolderForBook } from '@/lib/books/book-cover-path'
import type { BookContentFormat, BookLibraryPayload, BookRecord } from '@/lib/books/types'

/** Starter series list for Library shelves and identity form. */
export const BOOK_SERIES_PRESETS = ['Journeys', 'Wonders', 'HKMKC', 'Presentations', 'Other'] as const

export type BookSeriesPreset = (typeof BOOK_SERIES_PRESETS)[number]

export const DEFAULT_BOOK_SERIES: BookSeriesPreset = 'Other'

/** Shelf / series label for simplified slide PDFs. */
export const PRESENTATIONS_SERIES: BookSeriesPreset = 'Presentations'

/** Short tip for teachers exporting PowerPoint into the library. */
export const PRESENTATION_PDF_EXPORT_TIP =
  'From PowerPoint: File → Export → Create PDF (one slide per page), then drop that PDF here.'

/** Optional grade labels (empty = unset). */
export const BOOK_GRADE_PRESETS = ['K', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const

export type BookGradePreset = (typeof BOOK_GRADE_PRESETS)[number]

/** Optional role within a series (empty = unset). */
export const BOOK_ROLE_PRESETS = [
  'Student book',
  'Workshop',
  'Literature',
  'Teacher guide',
] as const

export type BookRolePreset = (typeof BOOK_ROLE_PRESETS)[number]

export interface BookCatalogIdentity {
  title: string
  series: string
  grade?: string
  role?: string
}

export interface InferredBookCatalogLabels {
  series: string
  grade?: string
  role?: string
}

function normalizeHaystack(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
}

/** True when a filename/title looks like a slide deck rather than a textbook. */
export function looksLikePresentationCatalogName(input: {
  id?: string | null
  title?: string | null
  folderName?: string | null
}): boolean {
  const haystack = normalizeHaystack([input.id, input.title, input.folderName])
  return /\b(presentation|presentations|slides?|deck|pptx?)\b/.test(haystack)
}

export function resolveBookContentFormat(book: Pick<BookRecord, 'contentFormat'>): BookContentFormat {
  return book.contentFormat === 'presentation' ? 'presentation' : 'book'
}

export function isPresentationBook(book: Pick<BookRecord, 'contentFormat'>): boolean {
  return resolveBookContentFormat(book) === 'presentation'
}

export function inferBookCatalogLabels(input: {
  id?: string | null
  title?: string | null
  folderName?: string | null
}): InferredBookCatalogLabels {
  const haystack = normalizeHaystack([input.id, input.title, input.folderName])

  let series: string = DEFAULT_BOOK_SERIES
  if (/\bjourneys?\b/.test(haystack)) series = 'Journeys'
  else if (/\bwonders?\b/.test(haystack)) series = 'Wonders'
  else if (/\bhkmkc\b/.test(haystack)) series = 'HKMKC'
  else if (looksLikePresentationCatalogName(input)) series = PRESENTATIONS_SERIES

  let grade: string | undefined
  const gradeMatch =
    haystack.match(/\b(?:grade|gr\.?)\s*([1-6])\b/) ??
    haystack.match(/\bg0?([1-6])\b/)
  if (gradeMatch?.[1]) {
    grade = 'G' + gradeMatch[1]
  } else if (/\b(grade\s*k|gr\.?\s*k|kinder(?:garten)?|grk)\b/.test(haystack)) {
    grade = 'K'
  }

  let role: string | undefined
  if (/\bworkshop\b/.test(haystack)) role = 'Workshop'
  else if (/\bliterature\b/.test(haystack)) role = 'Literature'
  else if (/\bteacher\b/.test(haystack) && /\bguide\b/.test(haystack)) role = 'Teacher guide'
  else if (/\bbook\s*([1-9]\d*)\b/.test(haystack) || /\bstudent\b/.test(haystack)) {
    role = 'Student book'
  }

  return {
    series,
    ...(grade ? { grade } : {}),
    ...(role ? { role } : {}),
  }
}

/** Build a clean display title from catalog labels (Phase 1 suggest; Phase 2 disk names). */
export function formatBookDisplayTitle(input: {
  series: string
  grade?: string | null
  role?: string | null
  bookLabel?: string | null
}): string {
  const series = input.series.trim() || DEFAULT_BOOK_SERIES
  const gradeRaw = input.grade?.trim() ?? ''
  const gradePart =
    gradeRaw === 'K'
      ? 'Grade K'
      : /^G([1-6])$/i.test(gradeRaw)
        ? 'Grade ' + gradeRaw.slice(1)
        : gradeRaw
          ? gradeRaw
          : ''

  const role = input.role?.trim() ?? ''
  const bookLabel = input.bookLabel?.trim() ?? ''
  const right = role || bookLabel

  if (gradePart && right) return series + ' ' + gradePart + ' — ' + right
  if (gradePart) return series + ' ' + gradePart
  if (right) return series + ' — ' + right
  return series
}

/** True when the field was never saved (missing). Empty string means explicitly cleared. */
function isCatalogFieldUnset(value: string | undefined): boolean {
  return value === undefined
}

export function resolveBookCatalogIdentity(book: BookRecord): BookCatalogIdentity {
  const folderName = resolveBookFolderForBook(book)
  const inferred = inferBookCatalogLabels({
    id: book.id,
    title: book.title,
    folderName,
  })

  const series = isCatalogFieldUnset(book.series)
    ? inferred.series
    : (book.series ?? '').trim() || DEFAULT_BOOK_SERIES
  const grade = isCatalogFieldUnset(book.grade)
    ? inferred.grade
    : (book.grade ?? '').trim() || undefined
  const role = isCatalogFieldUnset(book.role)
    ? inferred.role
    : (book.role ?? '').trim() || undefined

  return {
    title: book.title,
    series,
    ...(grade ? { grade } : {}),
    ...(role ? { role } : {}),
  }
}

/**
 * Fill missing series/grade/role for UI and later saves.
 * Does not overwrite fields already set on the book (including empty string = cleared).
 * Does not change title or id.
 */
export function applyBookCatalogDefaults(book: BookRecord): BookRecord {
  const folderName = resolveBookFolderForBook(book)
  const inferred = inferBookCatalogLabels({
    id: book.id,
    title: book.title,
    folderName,
  })

  const series = isCatalogFieldUnset(book.series)
    ? inferred.series
    : (book.series ?? '').trim() || DEFAULT_BOOK_SERIES
  const grade = isCatalogFieldUnset(book.grade)
    ? inferred.grade
    : (book.grade ?? '').trim() || undefined
  const role = isCatalogFieldUnset(book.role)
    ? inferred.role
    : (book.role ?? '').trim() || undefined

  const next: BookRecord = {
    ...book,
    series,
  }
  if (grade) next.grade = grade
  else if (!isCatalogFieldUnset(book.grade)) next.grade = ''
  else delete next.grade
  if (role) next.role = role
  else if (!isCatalogFieldUnset(book.role)) next.role = ''
  else delete next.role

  return next
}

export function applyBookCatalogDefaultsToLibrary(payload: BookLibraryPayload): BookLibraryPayload {
  return {
    books: payload.books.map(applyBookCatalogDefaults),
  }
}

/** Sentinel for books with no grade in picker filters. */
export const BOOK_PICKER_UNLABELED_GRADE = '__unlabeled__'

export function formatBookGradeChipLabel(grade: string): string {
  if (grade === BOOK_PICKER_UNLABELED_GRADE) return 'Unlabeled'
  if (grade === 'K') return 'Grade K'
  const match = /^G([1-6])$/i.exec(grade)
  if (match?.[1]) return `Grade ${match[1]}`
  return grade
}

function gradeSortKey(grade: string): number {
  if (grade === 'K') return 0
  const match = /^G([1-6])$/i.exec(grade)
  if (match?.[1]) return Number(match[1])
  if (grade === BOOK_PICKER_UNLABELED_GRADE) return 100
  return 50
}

/**
 * Series choices for identity / naming forms.
 * Order: named presets → custom (A–Z) → Other. Always includes presets.
 */
export function listBookSeriesSelectOptions(input: {
  books?: BookRecord[]
  extraSeries?: Array<string | null | undefined>
}): string[] {
  const set = new Set<string>(BOOK_SERIES_PRESETS)
  for (const book of input.books ?? []) {
    const series = resolveBookCatalogIdentity(book).series.trim()
    if (series) set.add(series)
  }
  for (const raw of input.extraSeries ?? []) {
    const series = raw?.trim()
    if (series) set.add(series)
  }

  const presetOrder = BOOK_SERIES_PRESETS as readonly string[]
  return [...set].sort((a, b) => {
    if (a === DEFAULT_BOOK_SERIES) return 1
    if (b === DEFAULT_BOOK_SERIES) return -1
    const ai = presetOrder.indexOf(a)
    const bi = presetOrder.indexOf(b)
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.localeCompare(b)
  })
}

/**
 * Series and grade options for the student book picker (narrow → choose).
 * Series order: presets first (when present), then other series A–Z.
 */
export function listBookPickerFacets(books: BookRecord[]): {
  series: string[]
  gradesBySeries: Record<string, string[]>
} {
  const seriesSet = new Set<string>()
  const gradesBySeries = new Map<string, Set<string>>()

  for (const book of books) {
    const identity = resolveBookCatalogIdentity(book)
    const series = identity.series.trim() || DEFAULT_BOOK_SERIES
    seriesSet.add(series)
    let gradeSet = gradesBySeries.get(series)
    if (!gradeSet) {
      gradeSet = new Set()
      gradesBySeries.set(series, gradeSet)
    }
    gradeSet.add(identity.grade?.trim() || BOOK_PICKER_UNLABELED_GRADE)
  }

  const presetOrder = BOOK_SERIES_PRESETS as readonly string[]
  const series = [...seriesSet].sort((a, b) => {
    const ai = presetOrder.indexOf(a)
    const bi = presetOrder.indexOf(b)
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.localeCompare(b)
  })

  const gradesRecord: Record<string, string[]> = {}
  for (const [seriesKey, gradeSet] of gradesBySeries) {
    gradesRecord[seriesKey] = [...gradeSet].sort((a, b) => {
      const diff = gradeSortKey(a) - gradeSortKey(b)
      return diff !== 0 ? diff : a.localeCompare(b)
    })
  }

  return { series, gradesBySeries: gradesRecord }
}

export function bookMatchesPickerFilters(
  book: BookRecord,
  filters: { series: string | null; grade: string | null },
): boolean {
  if (!filters.series) return false
  const identity = resolveBookCatalogIdentity(book)
  const series = identity.series.trim() || DEFAULT_BOOK_SERIES
  if (series !== filters.series) return false
  if (!filters.grade) return true
  const grade = identity.grade?.trim() || BOOK_PICKER_UNLABELED_GRADE
  return grade === filters.grade
}

export type BookPickStepId = 'series' | 'grade' | 'book'

/** Starting wizard step when series/grade can be skipped. */
export function resolveBookPickInitialState(books: BookRecord[]): {
  step: BookPickStepId
  series: string | null
  grade: string | null
} {
  const facets = listBookPickerFacets(books)
  if (facets.series.length === 0) {
    return { step: 'series', series: null, grade: null }
  }
  if (facets.series.length === 1) {
    const series = facets.series[0]!
    const grades = facets.gradesBySeries[series] ?? []
    if (grades.length <= 1) {
      return { step: 'book', series, grade: grades[0] ?? null }
    }
    return { step: 'grade', series, grade: null }
  }
  return { step: 'series', series: null, grade: null }
}
