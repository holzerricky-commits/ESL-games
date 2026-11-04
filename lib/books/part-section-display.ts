import type { BookLessonPartTag } from '@/lib/books/types'

const PRIMARY_BY_TAG: Record<BookLessonPartTag, string> = {
  unspecified: 'Section',
  vocabulary_in_context: 'Vocabulary',
  vocabulary_background: 'Background',
  comprehension: 'Comprehension',
  main_story: 'Main story',
  your_turn: 'Your Turn',
  paired_story: 'Paired story',
  making_connections: 'Making connections',
  grammar: 'Grammar',
  writing_narrate: 'Writing',
  genre: 'Genre',
  vocabulary_strategy: 'Vocab strategy',
  literary_element: 'Literary element',
  phonics: 'Phonics',
  fluency: 'Fluency',
  structural_analysis: 'Structural analysis',
}

/** Strip common leading skill labels so the rest reads as the lesson-specific line. */
function stripComprehensionNoise(raw: string): string {
  let t = raw.trim()
  const lower = t.toLowerCase()
  const prefixes = [
    /^comprehension\s*:\s*/i,
    /^comprehension\s*[·•]\s*/i,
    /^skill\s*:\s*/i,
    /^strategy\s*:\s*/i,
  ]
  for (const re of prefixes) {
    t = t.replace(re, '').trim()
  }
  return t || raw.trim()
}

const STORY_TYPE_PREFIX =
  /^(shared\s+read|main\s+selection|paired\s+selection|paired\s+read|anchor\s+text|main\s+story|paired\s+story)\s*[:·-]?\s*/i

/**
 * Drop leading lesson-part type words (“Shared Read …”) so only the story name remains.
 * Returns '' when the title was only a type label.
 */
export function stripLessonPartTypePrefix(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (!STORY_TYPE_PREFIX.test(t)) return t
  return t.replace(STORY_TYPE_PREFIX, '').trim()
}

function stripStoryNoise(raw: string): string {
  const cleaned = stripLessonPartTypePrefix(raw)
  return cleaned || raw.trim()
}

/**
 * One-line teacher-facing label for a part row (stable blocks vs TOC detail).
 */
function stripLabeledPrefix(raw: string, prefixes: RegExp[]): string {
  let t = raw.trim()
  for (const re of prefixes) {
    t = t.replace(re, '').trim()
  }
  return t || raw.trim()
}

export function getPartPrimaryLabel(tag: BookLessonPartTag, rawTitle: string): string {
  const raw = rawTitle.trim()
  if (tag === 'comprehension') {
    const cleaned = stripComprehensionNoise(raw)
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG.comprehension
  }
  if (tag === 'genre') {
    const cleaned = stripLabeledPrefix(raw, [/^genre\s*:\s*/i, /^genre\s*[·•]\s*/i])
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG.genre
  }
  if (tag === 'vocabulary_strategy') {
    const cleaned = stripLabeledPrefix(raw, [
      /^vocabulary\s*strategy\s*:\s*/i,
      /^vocab\s*strategy\s*:\s*/i,
    ])
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG.vocabulary_strategy
  }
  if (tag === 'literary_element') {
    const cleaned = stripLabeledPrefix(raw, [/^literary\s*element\s*:\s*/i])
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG.literary_element
  }
  if (tag === 'phonics') {
    const cleaned = stripLabeledPrefix(raw, [/^phonics\s*:\s*/i])
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG.phonics
  }
  if (tag === 'fluency') {
    const cleaned = stripLabeledPrefix(raw, [/^fluency\s*:\s*/i])
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG.fluency
  }
  if (tag === 'structural_analysis') {
    const cleaned = stripLabeledPrefix(raw, [/^structural\s*analysis\s*:\s*/i])
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG.structural_analysis
  }
  if (tag === 'writing_narrate') {
    const cleaned = stripLabeledPrefix(raw, [/^writing\s*:\s*/i, /^write to narrate\s*:\s*/i])
    return cleaned.length > 0 && cleaned.toLowerCase() !== 'writing' ? cleaned : PRIMARY_BY_TAG.writing_narrate
  }
  if (tag === 'main_story' || tag === 'paired_story') {
    const cleaned = stripStoryNoise(raw)
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG[tag]
  }
  if (tag === 'unspecified' && raw.length > 0) return raw
  return PRIMARY_BY_TAG[tag] ?? (raw || 'Section')
}

export function buildSectionPathLabel(
  bookTitle: string,
  unitTitle: string,
  lessonTitle: string,
  partDisplayTitle: string,
): string {
  return [bookTitle, unitTitle, lessonTitle, partDisplayTitle].filter(Boolean).join(' / ')
}
