import { describe, expect, it } from 'vitest'
import {
  buildInteractiveVocabPack,
  INTERACTIVE_VOCAB_PACKS,
  getInteractiveVocabPackForPartKey,
  interactiveVocabPartKey,
  isVocabularyInContextPartTitle,
} from '@/lib/books/interactive-vocab'

describe('interactive vocab', () => {
  it('detects Vocabulary in Context title', () => {
    expect(isVocabularyInContextPartTitle('Vocabulary in Context')).toBe(true)
    expect(isVocabularyInContextPartTitle('  vocabulary  in   context  ')).toBe(true)
    expect(isVocabularyInContextPartTitle('Vocabulary')).toBe(false)
  })

  it('buildInteractiveVocabPack prefers saved words over hardcoded', () => {
    const key = interactiveVocabPartKey('b', 'u', 'l', 'p')
    const hardcoded = getInteractiveVocabPackForPartKey(
      interactiveVocabPartKey('journeys-g3-book-1', 'unit-3-3e7eaa87', 'lesson-2d6f0fe0', 'part-621e469f'),
    )
    const saved = [{ id: 'a', word: 'alpha', definition: 'one', examples: ['ex'] }]
    const merged = buildInteractiveVocabPack(key, 'Vocab', saved, hardcoded)
    expect(merged?.words).toHaveLength(1)
    expect(merged?.words[0]?.word).toBe('alpha')
    const fallback = buildInteractiveVocabPack(key, 'Vocab', [], hardcoded)
    expect(fallback?.words.length).toBe(hardcoded?.words.length)
  })

  it('loads seeded Lesson 11 pack', () => {
    const key = interactiveVocabPartKey(
      'journeys-g3-book-1',
      'unit-3-3e7eaa87',
      'lesson-2d6f0fe0',
      'part-621e469f',
    )
    const pack = getInteractiveVocabPackForPartKey(key)
    expect(pack).not.toBeNull()
    expect(pack!.words).toHaveLength(8)
    expect(INTERACTIVE_VOCAB_PACKS[key]?.words[0]?.word).toBe('athlete')
  })
})
