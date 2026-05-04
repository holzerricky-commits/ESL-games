import { describe, expect, it } from 'vitest'
import { buildSectionPathLabel, getPartPrimaryLabel } from '@/lib/books/part-section-display'

describe('part-section-display', () => {
  it('uses fixed labels for stable tags', () => {
    expect(getPartPrimaryLabel('vocabulary_in_context', 'Vocabulary in Context')).toBe('Vocabulary')
    expect(getPartPrimaryLabel('your_turn', 'Your Turn: Foo')).toBe('Your Turn')
  })

  it('surfaces comprehension detail from title', () => {
    expect(getPartPrimaryLabel('comprehension', 'Comprehension: Summarize')).toBe('Summarize')
  })

  it('builds path label', () => {
    expect(buildSectionPathLabel('Book', 'U1', 'L1', 'Vocabulary')).toBe('Book / U1 / L1 / Vocabulary')
  })
})
