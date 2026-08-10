import { PRESENTATIONS_SERIES } from '@/lib/books/book-catalog-labels'
import { slugifyDiskSegment } from '@/lib/books/book-disk-naming'
import type { BookRecord } from '@/lib/books/types'

/** Teacher-facing difficulty shelves for presentation decks. */
export const PRESENTATION_DIFFICULTY_LEVELS = [
  'Starter',
  'Basic',
  'Intermediate',
  'Hard',
] as const

export type PresentationDifficultyLevel = (typeof PRESENTATION_DIFFICULTY_LEVELS)[number]

export function isPresentationDifficultyLevel(
  value: string | null | undefined,
): value is PresentationDifficultyLevel {
  return (
    typeof value === 'string' &&
    (PRESENTATION_DIFFICULTY_LEVELS as readonly string[]).includes(value.trim())
  )
}

export function normalizePresentationDifficultyLevel(
  value: unknown,
): PresentationDifficultyLevel | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (isPresentationDifficultyLevel(trimmed)) return trimmed
  const lower = trimmed.toLowerCase()
  const match = PRESENTATION_DIFFICULTY_LEVELS.find((level) => level.toLowerCase() === lower)
  return match ?? null
}

/** Stable library id / disk folder for a difficulty shelf, e.g. presentations-starter. */
export function presentationLevelBookId(level: PresentationDifficultyLevel): string {
  return `presentations-${slugifyDiskSegment(level) || level.toLowerCase()}`
}

export function presentationLevelBookTitle(level: PresentationDifficultyLevel): string {
  return level
}

/** Human unit title from an uploaded deck filename. */
export function titleFromPresentationDeckFileName(fileName: string): string {
  const stem = fileName.replace(/\.pdf$/i, '').trim()
  const cleaned = stem
    .replace(/\.pptx?/gi, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(presentation|presentations|slides?|deck|pptx?)\b/gi, ' ')
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || stem.replace(/[-_]+/g, ' ').trim() || 'Deck'
}

export function findPresentationLevelBook(
  books: BookRecord[],
  level: PresentationDifficultyLevel,
): BookRecord | undefined {
  const id = presentationLevelBookId(level)
  const byId = books.find((book) => book.id === id)
  if (byId) return byId
  return books.find((book) => {
    if (book.contentFormat !== 'presentation') return false
    const series = book.series?.trim() || ''
    const role = book.role?.trim() || ''
    const title = book.title.trim()
    return (
      (series === PRESENTATIONS_SERIES || !series || series === 'Other') &&
      (role === level || title === level || title.toLowerCase() === level.toLowerCase())
    )
  })
}

export function buildPresentationLevelBookShell(
  level: PresentationDifficultyLevel,
): BookRecord {
  return {
    id: presentationLevelBookId(level),
    title: presentationLevelBookTitle(level),
    series: PRESENTATIONS_SERIES,
    role: level,
    contentFormat: 'presentation',
    units: [],
  }
}
