import { describe, expect, it } from 'vitest'
import { generateMeaningMatchPracticeItems } from '@/lib/vocabulary/practice-generator'
import type { VocabularySet } from '@/lib/vocabulary/types'

function makeSet(): VocabularySet {
  const now = new Date().toISOString()
  return {
    id: 'set-1',
    status: 'published',
    generationVersion: 'test',
    createdAt: now,
    updatedAt: now,
    context: {
      studentId: 's1',
      classId: 'c1',
      classTitle: 'Class',
      bookId: 'b1',
      unitId: 'u1',
      pageRange: { startPage: 1, endPage: 2 },
    },
    entries: [
      { id: 'e1', word: 'river', lemma: 'river', definition: 'a natural stream of water', examples: [], synonyms: [], antonyms: [], relevanceTags: [], confidence: 0.8, reviewFlags: [], sourcePage: 1, approved: true, updatedAt: now },
      { id: 'e2', word: 'valley', lemma: 'valley', definition: 'low land between hills', examples: [], synonyms: [], antonyms: [], relevanceTags: [], confidence: 0.8, reviewFlags: [], sourcePage: 1, approved: true, updatedAt: now },
      { id: 'e3', word: 'forest', lemma: 'forest', definition: 'a large area covered with trees', examples: [], synonyms: [], antonyms: [], relevanceTags: [], confidence: 0.8, reviewFlags: [], sourcePage: 1, approved: false, updatedAt: now },
    ],
  }
}

describe('generateMeaningMatchPracticeItems', () => {
  it('creates practice items from approved vocabulary entries', () => {
    const items = generateMeaningMatchPracticeItems(makeSet(), 4)
    expect(items.length).toBe(2)
    expect(items[0]?.type).toBe('meaning_match')
    expect(items[0]?.choices.length).toBeGreaterThanOrEqual(2)
    expect(items[0]?.correctChoiceIndex).toBe(0)
  })
})
