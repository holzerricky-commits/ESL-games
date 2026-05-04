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

function stripStoryNoise(raw: string): string {
  let t = raw.trim()
  t = t.replace(/^main\s*selection\s*:\s*/i, '').trim()
  t = t.replace(/^paired\s*selection\s*:\s*/i, '').trim()
  t = t.replace(/^anchor\s*text\s*:\s*/i, '').trim()
  return t || raw.trim()
}

/**
 * One-line teacher-facing label for a part row (stable blocks vs TOC detail).
 */
export function getPartPrimaryLabel(tag: BookLessonPartTag, rawTitle: string): string {
  const raw = rawTitle.trim()
  if (tag === 'comprehension') {
    const cleaned = stripComprehensionNoise(raw)
    return cleaned.length > 0 ? cleaned : PRIMARY_BY_TAG.comprehension
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
