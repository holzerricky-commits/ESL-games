import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateVocabularySet } from '@/lib/vocabulary/generate-from-pages'

const baseInput = {
  context: {
    studentId: 'student-1',
    classId: 'class-1',
    classTitle: 'Unit vocab',
    bookId: 'book-1',
    unitId: 'unit-1',
    pageRange: { startPage: 4, endPage: 6 },
  },
}

describe('generateVocabularySet', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.GEMINI_API_KEY
  })

  it('falls back to seed words when no api key is available', async () => {
    const set = await generateVocabularySet({
      ...baseInput,
      seedWords: ['river', 'forest', 'river'],
      requestedCount: 6,
    })
    expect(set.status).toBe('draft')
    expect(set.entries.length).toBe(2)
    expect(set.entries.map((entry) => entry.word)).toEqual(['river', 'forest'])
    expect(set.entries[0]?.reviewFlags).toContain('low_confidence')
  })

  it('sanitizes model output and keeps requested count max', async () => {
    process.env.GEMINI_API_KEY = 'fake-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      words: [
                        {
                          word: 'River!',
                          lemma: 'River',
                          definition: 'water path',
                          examples: ['The river is long.', 'Fish live in the river.'],
                          synonyms: ['stream'],
                          antonyms: ['desert'],
                          relevanceTags: ['skill_support'],
                          confidence: 0.91,
                          reviewFlags: [],
                          sourcePage: 100,
                        },
                        {
                          word: 'River!',
                          lemma: 'river',
                          definition: 'duplicate',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      })),
    )

    const set = await generateVocabularySet({ ...baseInput, requestedCount: 1 })
    expect(set.entries).toHaveLength(1)
    expect(set.entries[0]?.lemma).toBe('river')
    expect(set.entries[0]?.sourcePage).toBe(6)
    expect(set.entries[0]?.relevanceTags).toContain('skill_support')
    expect(set.entries[0]?.confidence).toBe(0.91)
  })
})
