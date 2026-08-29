import { BOOK_LESSON_PART_TAG_LABELS, effectivePartStructureTag } from '@/lib/books/part-structure-tag'
import { pageRangeForIndex } from '@/lib/books/toc-page-range'
import type {
  BookLessonPartRecord,
  BookLessonPartTag,
  BookLessonRecord,
  BookRecord,
  BookUnitRecord,
} from '@/lib/books/types'

export interface BookPartShelfCard {
  id: string
  title: string
  indexLabel: string
  typeLabel: string
  structureTag: BookLessonPartTag
  partIndex: number
  /** Printed/effective page range for the list row. */
  printedStart: number | null
  printedEnd: number | null
}

/**
 * Parts for one lesson, outline order, with printed ranges for the list.
 */
export function buildBookPartShelfCards(
  unit: BookUnitRecord,
  lesson: BookLessonRecord,
  lessonIndex: number,
): BookPartShelfCard[] {
  const lessons = unit.lessons ?? []
  const lessonRange = pageRangeForIndex(lessons, lessonIndex)
  const parts = lesson.parts ?? []
  return parts.map((part, partIndex) => {
    const range = pageRangeForIndex(parts, partIndex, lessonRange.start, lessonRange.end)
    const tag = effectivePartStructureTag(part)
    return {
      id: part.id,
      title: part.title,
      indexLabel: `P${partIndex + 1}`,
      typeLabel: BOOK_LESSON_PART_TAG_LABELS[tag] ?? 'Part',
      structureTag: tag,
      partIndex,
      printedStart: range.start,
      printedEnd: range.end,
    }
  })
}

/** Main / paired story rows get a small PDF thumb in the parts list. */
export function isStoryPartShelfTag(tag: BookLessonPartTag): boolean {
  return tag === 'main_story' || tag === 'paired_story'
}

/** Vocabulary parts get interactive word-list prep in the part shell. */
export function isVocabPartShelfTag(tag: BookLessonPartTag): boolean {
  return tag === 'vocabulary_in_context' || tag === 'vocabulary_background'
}

/** Human page range for a part list row (printed pages). */
export function formatPartPageRangeLabel(start: number | null, end: number | null): string {
  if (start == null) return 'Pages not set'
  if (end != null && end !== start) return `pp. ${start}–${end}`
  return `p. ${start}`
}

function normalizePartLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[·•]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * One list headline: avoid “Comprehension” + “Comprehension Strategy: …”.
 * Returns a muted type prefix + distinctive name when useful.
 */
export function formatPartListHeadline(
  typeLabel: string,
  title: string,
): { prefix: string | null; name: string } {
  const type = typeLabel.trim()
  const raw = title.trim()
  if (!type) return { prefix: null, name: raw || 'Part' }
  if (!raw) return { prefix: null, name: type }

  const typeNorm = normalizePartLabel(type)
  const titleNorm = normalizePartLabel(raw)

  // Short/generic title that only repeats the type (“Vocabulary” under Vocab · in context).
  if (
    titleNorm === typeNorm ||
    typeNorm.startsWith(titleNorm) ||
    (titleNorm === 'vocabulary' && typeNorm.startsWith('vocab'))
  ) {
    return { prefix: null, name: type }
  }

  const typePattern = escapeRegExp(type).replace(/\\s*·\\s*/g, '[\\s·:-]*')
  const fullTypePrefix = new RegExp(`^${typePattern}\\s*[:·-]?\\s*`, 'i')
  if (fullTypePrefix.test(raw)) {
    const rest = raw.replace(fullTypePrefix, '').trim()
    return rest ? { prefix: type, name: rest } : { prefix: null, name: type }
  }

  const firstChunk = type.split(/[·]/)[0]?.trim() ?? type
  if (/^vocab$/i.test(firstChunk)) {
    const vocabPrefix = /^(vocabulary|vocab)(\s+(in\s+context|background|strategy))?\s*[:·-]?\s*/i
    if (vocabPrefix.test(raw)) {
      const rest = raw.replace(vocabPrefix, '').trim()
      return rest ? { prefix: type, name: rest } : { prefix: null, name: type }
    }
  } else {
    const firstPrefix = new RegExp(`^${escapeRegExp(firstChunk)}\\s*[:·-]?\\s*`, 'i')
    if (firstPrefix.test(raw)) {
      const rest = raw.replace(firstPrefix, '').trim()
      // “Comprehension Strategy: Visualize” → keep the rest as the specific name.
      return rest ? { prefix: type, name: rest } : { prefix: null, name: type }
    }
  }

  return { prefix: type, name: raw }
}

export function findLessonInBook(
  book: BookRecord,
  unitId: string,
  lessonId: string,
): { unit: BookUnitRecord; lesson: BookLessonRecord; lessonIndex: number } | null {
  const unit = book.units.find((u) => u.id === unitId) ?? null
  if (!unit) return null
  const lessons = unit.lessons ?? []
  const lessonIndex = lessons.findIndex((l) => l.id === lessonId)
  if (lessonIndex < 0) return null
  return { unit, lesson: lessons[lessonIndex]!, lessonIndex }
}

export function findPartInLesson(
  lesson: BookLessonRecord,
  partId: string,
): { part: BookLessonPartRecord; partIndex: number } | null {
  const parts = lesson.parts ?? []
  const partIndex = parts.findIndex((p) => p.id === partId)
  if (partIndex < 0) return null
  return { part: parts[partIndex]!, partIndex }
}
