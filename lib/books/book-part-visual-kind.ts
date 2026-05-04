import type { BookLessonPartRecord } from '@/lib/books/types'
import { resolvePartStructureTag } from '@/lib/books/part-structure-tag'

/** Visual bucket for icons / story emphasis (structure wizard + books TOC). */
export type BookPartVisualKind =
  | 'vocabulary'
  | 'comprehension'
  | 'longStory'
  | 'yourTurn'
  | 'shortStory'
  | 'makingConnections'
  | 'grammarWrite'
  | 'other'

function classifyPartKind(title: string, partIndex: number): BookPartVisualKind {
  const normalized = title.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/\bvocab/.test(normalized)) return 'vocabulary'
  if (/\bcomprehension\b/.test(normalized)) return 'comprehension'
  if (/\byour turn\b/.test(normalized)) return 'yourTurn'
  if (/\bmaking connections?\b/.test(normalized)) return 'makingConnections'
  if (/\bgrammar\b|\bwrite to narrate\b/.test(normalized)) return 'grammarWrite'
  if (/\bshort story\b/.test(normalized)) return 'shortStory'
  if (/\bstory\b/.test(normalized)) return 'longStory'
  switch (partIndex) {
    case 0:
      return 'vocabulary'
    case 1:
      return 'comprehension'
    case 2:
      return 'longStory'
    case 3:
      return 'yourTurn'
    case 4:
      return 'shortStory'
    case 5:
      return 'makingConnections'
    case 6:
      return 'grammarWrite'
    default:
      return 'other'
  }
}

export function partVisualKindFromStructureTag(
  part: BookLessonPartRecord,
  title: string,
  partIndex: number,
): BookPartVisualKind {
  const tag = resolvePartStructureTag(part, partIndex)
  switch (tag) {
    case 'unspecified':
      return classifyPartKind(title, partIndex)
    case 'vocabulary_in_context':
    case 'vocabulary_background':
      return 'vocabulary'
    case 'comprehension':
      return 'comprehension'
    case 'main_story':
      return 'longStory'
    case 'your_turn':
      return 'yourTurn'
    case 'paired_story':
      return 'shortStory'
    case 'making_connections':
      return 'makingConnections'
    case 'grammar':
    case 'writing_narrate':
      return 'grammarWrite'
    default:
      return 'other'
  }
}

export function storySubtitleForVisualKind(kind: BookPartVisualKind): string {
  if (kind === 'longStory') return 'Main story'
  if (kind === 'shortStory') return 'Paired story'
  return ''
}
