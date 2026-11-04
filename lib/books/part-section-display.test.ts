import { describe, expect, it } from 'vitest'
import {
  buildSectionPathLabel,
  getPartPrimaryLabel,
  stripLessonPartTypePrefix,
} from '@/lib/books/part-section-display'

describe('part-section-display', () => {
  it('strips Shared Read / selection type prefixes from story titles', () => {
    expect(stripLessonPartTypePrefix('Shared Read Eagles and Eaglets')).toBe('Eagles and Eaglets')
    expect(stripLessonPartTypePrefix('Shared Read: Dive Teams')).toBe('Dive Teams')
    expect(stripLessonPartTypePrefix('Main Selection Little Flap Learns to Fly')).toBe(
      'Little Flap Learns to Fly',
    )
    expect(stripLessonPartTypePrefix('Shared Read')).toBe('')
    expect(stripLessonPartTypePrefix('From the tide pool')).toBe('From the tide pool')
  })

  it('uses fixed labels for stable tags', () => {
    expect(getPartPrimaryLabel('vocabulary_in_context', 'Vocabulary in Context')).toBe('Vocabulary')
    expect(getPartPrimaryLabel('your_turn', 'Your Turn: Foo')).toBe('Your Turn')
  })

  it('keeps story name without Shared Read for main/paired tags', () => {
    expect(getPartPrimaryLabel('main_story', 'Shared Read Eagles and Eaglets')).toBe(
      'Eagles and Eaglets',
    )
  })

  it('surfaces comprehension detail from title', () => {
    expect(getPartPrimaryLabel('comprehension', 'Comprehension: Summarize')).toBe('Summarize')
  })

  it('surfaces genre / vocab strategy / writing detail from title', () => {
    expect(getPartPrimaryLabel('genre', 'Genre: Expository Text')).toBe('Expository Text')
    expect(getPartPrimaryLabel('vocabulary_strategy', 'Vocabulary Strategy: Paragraph Clues')).toBe(
      'Paragraph Clues',
    )
    expect(getPartPrimaryLabel('writing_narrate', 'Writing: Word Choice')).toBe('Word Choice')
  })

  it('builds path label', () => {
    expect(buildSectionPathLabel('Book', 'U1', 'L1', 'Vocabulary')).toBe('Book / U1 / L1 / Vocabulary')
  })
})
