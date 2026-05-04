import type { BookLessonPartRecord, BookLessonPartTag, BookLessonRecord } from '@/lib/books/types'
import { BOOK_LESSON_PART_TAGS } from '@/lib/books/types'

/** Short labels for compact UI (dropdown options). */
export const BOOK_LESSON_PART_TAG_LABELS: Record<BookLessonPartTag, string> = {
  unspecified: 'Unspecified',
  vocabulary_in_context: 'Vocab · in context',
  vocabulary_background: 'Vocab · background',
  comprehension: 'Comprehension',
  main_story: 'Main story',
  your_turn: 'Your Turn',
  paired_story: 'Paired story',
  making_connections: 'Making connections',
  grammar: 'Grammar',
  writing_narrate: 'Write to narrate',
}

export function isBookLessonPartTag(value: unknown): value is BookLessonPartTag {
  return typeof value === 'string' && (BOOK_LESSON_PART_TAGS as readonly string[]).includes(value)
}

/** Default Journeys-style part order when titles are generic (Part 1, Part 2, …). */
export const JOURNEYS_LESSON_PART_ORDER_TEMPLATE: readonly BookLessonPartTag[] = [
  'vocabulary_in_context',
  'comprehension',
  'main_story',
  'your_turn',
  'paired_story',
  'making_connections',
  'grammar',
  'writing_narrate',
] as const

export function templateTagForPartIndex(index: number): BookLessonPartTag {
  if (index < 0 || index >= JOURNEYS_LESSON_PART_ORDER_TEMPLATE.length) return 'unspecified'
  return JOURNEYS_LESSON_PART_ORDER_TEMPLATE[index]!
}

/** Tag from title heuristics, then template slot; used when `structureTag` is not stored. */
export function computeStructureTagFromTitleAndIndex(
  part: Pick<BookLessonPartRecord, 'title'>,
  partIndexInLesson: number,
): BookLessonPartTag {
  const inferred = inferStructureTagFromTitle(part.title)
  if (inferred !== 'unspecified') return inferred
  const templated = templateTagForPartIndex(partIndexInLesson)
  return templated
}

/** Saved tag wins; otherwise title inference, then slot template. */
export function resolvePartStructureTag(part: BookLessonPartRecord, partIndexInLesson: number): BookLessonPartTag {
  if (part.structureTag != null) return part.structureTag
  return computeStructureTagFromTitleAndIndex(part, partIndexInLesson)
}

export function inferStructureTagFromTitle(title: string): BookLessonPartTag {
  const n = title.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!n) return 'unspecified'

  if (n === 'vocabulary in context' || (n.includes('vocabulary') && n.includes('context'))) {
    return 'vocabulary_in_context'
  }
  if (/\bbackground\b/.test(n)) return 'vocabulary_background'
  if (/\bvocab|target vocabulary|word study|words to know\b/.test(n)) return 'vocabulary_in_context'

  if (/\bcomprehension\b/.test(n)) return 'comprehension'
  if (/\byour turn\b/.test(n)) return 'your_turn'
  if (/\bmaking connections?\b/.test(n)) return 'making_connections'

  if (/\bwrite to narrat/.test(n) || /\bnarrative writing\b/.test(n) || /\bwrite to narrate\b/.test(n)) {
    return 'writing_narrate'
  }
  if (/\bgrammar\b/.test(n) && !/\bwrite to narrat/.test(n)) return 'grammar'

  if (/\bpaired selection\b/.test(n) || /\bshort story\b/.test(n) || /\bscience for sports\b/.test(n)) {
    return 'paired_story'
  }
  if (/\bmain selection\b/.test(n) || /\banchor text\b/.test(n)) return 'main_story'
  if (/\bauthor\b.*\billustrat|\billustrat.*\bauthor\b/.test(n)) return 'main_story'
  if (/\bfrom the life of\b/.test(n) || /\bgenre:\s*biography\b/.test(n)) return 'main_story'
  // Standalone selection titles (e.g. "The River Story") — beats index template when lesson order differs.
  if (
    /\bstory\b/.test(n) &&
    !/\bvocab|vocabulary|grammar|comprehension|your turn|making connections|word study|words to know\b/.test(n)
  ) {
    return 'main_story'
  }

  return 'unspecified'
}

/** @deprecated Prefer `resolvePartStructureTag(part, index)` — template needs index. */
export function effectivePartStructureTag(part: BookLessonPartRecord): BookLessonPartTag {
  if (part.structureTag != null) return part.structureTag
  return inferStructureTagFromTitle(part.title)
}

export function normalizeLessonPartsStructureTags(lesson: {
  parts?: BookLessonPartRecord[] | undefined
}): { parts?: BookLessonPartRecord[] } {
  const parts = lesson.parts
  if (!parts?.length) return {}
  return {
    parts: parts.map((p, i) => ({
      ...p,
      structureTag: p.structureTag != null ? p.structureTag : computeStructureTagFromTitleAndIndex(p, i),
    })),
  }
}

export function normalizeLessonsStructureTags(lessons: BookLessonRecord[]): BookLessonRecord[] {
  return lessons.map((lesson) => ({
    ...lesson,
    ...normalizeLessonPartsStructureTags(lesson),
  }))
}
