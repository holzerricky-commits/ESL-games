import type { BookLessonPartRecord, BookLessonPartTag, BookLessonRecord } from '@/lib/books/types'
import { BOOK_LESSON_PART_TAGS } from '@/lib/books/types'
import type { TocExtractProfileId } from '@/lib/books/toc-extract-profile'

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
  writing_narrate: 'Writing',
  genre: 'Genre',
  vocabulary_strategy: 'Vocab · strategy',
  literary_element: 'Literary element',
  phonics: 'Phonics',
  fluency: 'Fluency',
  structural_analysis: 'Structural analysis',
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

/** Wonders Workshop week: Vocab → Shared Read → Strategy → Skill → Genre → Vocab strategy → Writing. */
export const WONDERS_WORKSHOP_PART_ORDER_TEMPLATE: readonly BookLessonPartTag[] = [
  'vocabulary_in_context',
  'main_story',
  'comprehension',
  'comprehension',
  'genre',
  'vocabulary_strategy',
  'writing_narrate',
] as const

/** Wonders Literature week: Anchor → Paired. */
export const WONDERS_LITERATURE_PART_ORDER_TEMPLATE: readonly BookLessonPartTag[] = [
  'main_story',
  'paired_story',
] as const

export function partOrderTemplateForProfile(
  profile: TocExtractProfileId = 'journeys',
): readonly BookLessonPartTag[] {
  switch (profile) {
    case 'wonders_workshop':
      return WONDERS_WORKSHOP_PART_ORDER_TEMPLATE
    case 'wonders_literature':
      return WONDERS_LITERATURE_PART_ORDER_TEMPLATE
    case 'generic':
      return []
    case 'journeys':
    default:
      return JOURNEYS_LESSON_PART_ORDER_TEMPLATE
  }
}

export function templateTagForPartIndex(
  index: number,
  profile: TocExtractProfileId = 'journeys',
): BookLessonPartTag {
  const template = partOrderTemplateForProfile(profile)
  if (index < 0 || index >= template.length) return 'unspecified'
  return template[index]!
}

function normalizeSectionKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Week theme used as the shared-read title, without a "Week N:" prefix. */
function weekThemeKey(lessonTitle: string | undefined): string {
  const raw = (lessonTitle ?? '').replace(/^week\s*\d+\s*:\s*/i, '').trim()
  return normalizeSectionKey(raw)
}

/**
 * TOC row that is its own section, not a reading selection.
 * Known extra heads ("Phonics", "Spelling: …") and any short "Label: detail" row
 * stay out of the story slots. Bare story titles are left for the week matcher.
 */
export function isOwnSectionTitle(title: string): boolean {
  const n = normalizeSectionKey(title)
  if (!n) return false
  if (
    /^(spelling|handwriting|word work|oral vocabulary|oral language|decodable(?:\s+(?:reader|text|passage))?|high-frequency words|high frequency words|phonics|fluency|structural analysis)(?:\s*:\s*.+)?$/.test(
      n,
    )
  ) {
    return true
  }
  const labeled = n.match(/^([^:]{1,48}):\s+\S/)
  if (!labeled) return false
  const words = (labeled[1] ?? '').trim().split(' ').filter(Boolean)
  return words.length > 0 && words.length <= 4
}

/**
 * Tag all parts in a lesson: title heuristics first.
 * Literature and Workshop assign main/paired only among real selection titles, so an
 * extra TOC section (Phonics, Fluency, or any unknown labeled row) does not steal the story slot.
 */
export function computeStructureTagsForParts(
  parts: Array<Pick<BookLessonPartRecord, 'title'>>,
  profile: TocExtractProfileId = 'journeys',
  lessonTitle?: string,
): BookLessonPartTag[] {
  if (profile === 'wonders_literature') {
    let storyOrdinal = 0
    return parts.map((part) => {
      const inferred = inferStructureTagFromTitle(part.title, profile)
      if (inferred !== 'unspecified') return inferred
      return templateTagForPartIndex(storyOrdinal++, profile)
    })
  }
  if (profile === 'wonders_workshop') {
    return computeWorkshopStructureTags(parts, lessonTitle)
  }
  return parts.map((part, i) => computeStructureTagFromTitleAndIndex(part, i, profile))
}

function computeWorkshopStructureTags(
  parts: Array<Pick<BookLessonPartRecord, 'title'>>,
  lessonTitle?: string,
): BookLessonPartTag[] {
  const themeKey = weekThemeKey(lessonTitle)
  const inferred = parts.map((part) => inferStructureTagFromTitle(part.title, 'wonders_workshop'))
  const isWeekStory = parts.map((part, index) => {
    if (inferred[index] !== 'unspecified') return false
    if (isOwnSectionTitle(part.title)) return false
    const key = normalizeSectionKey(part.title)
    return themeKey.length > 0 && key === themeKey
  })
  const weekStoryExists = isWeekStory.some(Boolean)
  let bareStoryCount = 0
  return parts.map((part, index) => {
    const tag = inferred[index]!
    if (tag !== 'unspecified') return tag
    if (isOwnSectionTitle(part.title)) return 'unspecified'
    if (isWeekStory[index]) return 'main_story'
    if (!weekStoryExists && bareStoryCount === 0) {
      bareStoryCount += 1
      return 'main_story'
    }
    bareStoryCount += 1
    return 'paired_story'
  })
}

/** Tag from title heuristics, then template slot; used when `structureTag` is not stored. */
export function computeStructureTagFromTitleAndIndex(
  part: Pick<BookLessonPartRecord, 'title'>,
  partIndexInLesson: number,
  profile: TocExtractProfileId = 'journeys',
): BookLessonPartTag {
  const inferred = inferStructureTagFromTitle(part.title, profile)
  if (inferred !== 'unspecified') return inferred
  if (profile === 'wonders_workshop' && isOwnSectionTitle(part.title)) return 'unspecified'
  return templateTagForPartIndex(partIndexInLesson, profile)
}

/** Saved tag wins; otherwise title inference, then slot template. */
export function resolvePartStructureTag(
  part: BookLessonPartRecord,
  partIndexInLesson: number,
  profile: TocExtractProfileId = 'journeys',
): BookLessonPartTag {
  if (part.structureTag != null) return part.structureTag
  return computeStructureTagFromTitleAndIndex(part, partIndexInLesson, profile)
}

/** Main / paired only — same resolution as the outline (title + lesson slot). */
export function resolvePartStoryKind(
  part: BookLessonPartRecord,
  partIndexInLesson: number,
  profile: TocExtractProfileId = 'journeys',
): 'main_story' | 'paired_story' | undefined {
  const tag = resolvePartStructureTag(part, partIndexInLesson, profile)
  if (tag === 'main_story' || tag === 'paired_story') return tag
  return undefined
}

export function inferStructureTagFromTitle(
  title: string,
  profile: TocExtractProfileId = 'journeys',
): BookLessonPartTag {
  const n = title.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!n) return 'unspecified'

  // Wonders-specific labels first (before broad "vocab" / "story" matches).
  if (/\bliterary\s*element\b/.test(n)) return 'literary_element'
  if (/\bvocabulary\s*strategy\b|\bvocab\s*strategy\b/.test(n)) return 'vocabulary_strategy'
  if (/^genre\b|\bgenre\s*:/.test(n)) return 'genre'
  if (/^writing\b|\bwriting\s*:/.test(n) || /\bwrite to narrat/.test(n) || /\bnarrative writing\b/.test(n)) {
    return 'writing_narrate'
  }

  if (n === 'vocabulary in context' || (n.includes('vocabulary') && n.includes('context'))) {
    return 'vocabulary_in_context'
  }
  if (/\bbackground\b/.test(n)) return 'vocabulary_background'
  if (
    n === 'vocabulary' ||
    /\bwords to know\b/.test(n) ||
    /\btarget vocabulary\b/.test(n) ||
    /\bword study\b/.test(n) ||
    (/^\s*vocab\b/.test(n) && !/\bstrategy\b/.test(n))
  ) {
    return 'vocabulary_in_context'
  }
  if (/\bvocab\b/.test(n) && !/\bstrategy\b/.test(n)) return 'vocabulary_in_context'

  if (/\bcomprehension\b/.test(n)) return 'comprehension'
  if (/\byour turn\b/.test(n)) return 'your_turn'
  // Literature / anthology post-read (before "story" heuristics).
  if (/\brespond\b/.test(n)) return 'your_turn'
  if (/\babout the (author|illustrator)s?\b/.test(n) || /\babout\b.*\b(author|illustrator)\b/.test(n)) {
    return 'your_turn'
  }
  if (/\bmaking connections?\b/.test(n)) return 'making_connections'
  if (/^connect\b|\bconnect to\b|\bconnect\s*to\b/.test(n)) return 'making_connections'

  if (/\bgrammar\b/.test(n)) return 'grammar'
  if (/\bphonics\b/.test(n)) return 'phonics'
  if (/\bfluency\b/.test(n)) return 'fluency'
  if (/\bstructural\s+analysis\b/.test(n)) return 'structural_analysis'
  if (/\bhigh[-\s]?frequency\s+words\b/.test(n)) return 'vocabulary_in_context'

  if (
    /\bpaired selection\b/.test(n) ||
    /\bpaired read\b/.test(n) ||
    /\bshort story\b/.test(n) ||
    /\bscience for sports\b/.test(n)
  ) {
    return 'paired_story'
  }
  if (
    /\bmain selection\b/.test(n) ||
    /\banchor text\b/.test(n) ||
    /\bshared read\b/.test(n)
  ) {
    return 'main_story'
  }
  if (/\bfrom the life of\b/.test(n) || /\bgenre:\s*biography\b/.test(n)) return 'main_story'

  // Standalone selection titles (e.g. "The River Story", "Pedal Power", "My Light").
  // Literature: first untitled story → main; second often paired via template.
  if (
    /\bstory\b/.test(n) &&
    !/\bvocab|vocabulary|grammar|comprehension|your turn|making connections|respond|word study|words to know|genre|writing|strategy|illustrator|author\b/.test(
      n,
    )
  ) {
    return 'main_story'
  }

  // Workshop/Literature: bare story titles with no skill keywords — leave unspecified so
  // the profile template can assign main_story vs paired_story by story ordinal / index.
  if (profile === 'wonders_literature' || profile === 'wonders_workshop') {
    const looksLikeSkillRow =
      /\b(vocabulary|comprehension|genre|writing|grammar|strategy|skill|literary|words to know|respond|connect|phonics|fluency|structural|spelling|handwriting)\b/.test(
        n,
      )
    if (!looksLikeSkillRow && n.length >= 2) {
      return 'unspecified'
    }
  }

  return 'unspecified'
}

/** @deprecated Prefer `resolvePartStructureTag(part, index)` — template needs index. */
export function effectivePartStructureTag(part: BookLessonPartRecord): BookLessonPartTag {
  if (part.structureTag != null) return part.structureTag
  return inferStructureTagFromTitle(part.title)
}

export function normalizeLessonPartsStructureTags(
  lesson: {
    parts?: BookLessonPartRecord[] | undefined
  },
  profile: TocExtractProfileId = 'journeys',
): { parts?: BookLessonPartRecord[] } {
  const parts = lesson.parts
  if (!parts?.length) return {}
  const computed = computeStructureTagsForParts(parts, profile)
  return {
    parts: parts.map((p, i) => ({
      ...p,
      structureTag: p.structureTag != null ? p.structureTag : computed[i]!,
    })),
  }
}

export function normalizeLessonsStructureTags(
  lessons: BookLessonRecord[],
  profile: TocExtractProfileId = 'journeys',
): BookLessonRecord[] {
  return lessons.map((lesson) => ({
    ...lesson,
    ...normalizeLessonPartsStructureTags(lesson, profile),
  }))
}
