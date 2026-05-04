import { describe, expect, it } from 'vitest'
import {
  computeStructureTagFromTitleAndIndex,
  effectivePartStructureTag,
  inferStructureTagFromTitle,
  normalizeLessonsStructureTags,
  resolvePartStructureTag,
  templateTagForPartIndex,
} from '@/lib/books/part-structure-tag'
import type { BookLessonPartRecord } from '@/lib/books/types'

describe('part-structure-tag', () => {
  it('infers vocabulary in context', () => {
    expect(inferStructureTagFromTitle('Vocabulary in Context')).toBe('vocabulary_in_context')
  })

  it('infers grammar vs writing', () => {
    expect(inferStructureTagFromTitle('Grammar: More Plural Nouns')).toBe('grammar')
    expect(inferStructureTagFromTitle('Write to Narrate: Descriptive Paragraph')).toBe('writing_narrate')
  })

  it('infers main story from standalone story title', () => {
    expect(inferStructureTagFromTitle('The River Story')).toBe('main_story')
  })

  it('effective uses saved tag when set', () => {
    const part: BookLessonPartRecord = {
      id: 'p1',
      title: 'Random',
      structureTag: 'grammar',
    }
    expect(effectivePartStructureTag(part)).toBe('grammar')
  })

  it('effective falls back to inference when tag absent', () => {
    const part: BookLessonPartRecord = { id: 'p1', title: 'Vocabulary in Context' }
    expect(effectivePartStructureTag(part)).toBe('vocabulary_in_context')
  })

  it('normalizes lessons', () => {
    const out = normalizeLessonsStructureTags([
      {
        id: 'l1',
        title: 'Lesson 1',
        parts: [{ id: 'p1', title: 'Your Turn' }],
      },
    ])
    expect(out[0]?.parts?.[0]?.structureTag).toBe('your_turn')
  })

  it('template maps part index when title is generic', () => {
    expect(templateTagForPartIndex(0)).toBe('vocabulary_in_context')
    expect(templateTagForPartIndex(1)).toBe('comprehension')
    expect(computeStructureTagFromTitleAndIndex({ title: 'Part 1' }, 0)).toBe('vocabulary_in_context')
  })

  it('resolvePartStructureTag prefers saved tag', () => {
    const part: BookLessonPartRecord = { id: 'p1', title: 'Part 9', structureTag: 'grammar' }
    expect(resolvePartStructureTag(part, 0)).toBe('grammar')
  })
})
