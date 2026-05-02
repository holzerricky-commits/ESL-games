import { describe, expect, it } from 'vitest'
import { FileVocabularyStore } from '@/lib/vocabulary/file-store'
import type { VocabularySet } from '@/lib/vocabulary/types'

function makeSet(id: string): VocabularySet {
  const now = new Date().toISOString()
  return {
    id,
    status: 'draft',
    generationVersion: 'test',
    createdAt: now,
    updatedAt: now,
    context: {
      studentId: 'student-1',
      classId: 'class-1',
      classTitle: 'test',
      bookId: 'book-1',
      unitId: 'unit-1',
      pageRange: { startPage: 1, endPage: 2 },
    },
    entries: [
      {
        id: `${id}-entry-1`,
        word: 'river',
        lemma: 'river',
        definition: 'water path',
        examples: ['A river is long.'],
        synonyms: [],
        antonyms: [],
        relevanceTags: ['theme_core'],
        confidence: 0.8,
        reviewFlags: [],
        sourcePage: 1,
        approved: false,
        updatedAt: now,
      },
    ],
  }
}

describe('FileVocabularyStore', () => {
  it('saves, updates, removes and publishes sets', async () => {
    const store = new FileVocabularyStore()
    const setId = `test-set-${Date.now()}`
    await store.saveDraftSet(makeSet(setId))

    const byId = await store.getSet(setId)
    expect(byId?.id).toBe(setId)

    const updated = await store.updateEntry(setId, `${setId}-entry-1`, {
      approved: true,
      definition: 'moving natural water',
    })
    expect(updated?.entries[0]?.approved).toBe(true)

    const published = await store.setStatus(setId, 'published')
    expect(published?.status).toBe('published')

    const removed = await store.removeEntry(setId, `${setId}-entry-1`)
    expect(removed?.entries).toHaveLength(0)
  })

  it('sorts by risk and supports guarded bulk updates', async () => {
    const store = new FileVocabularyStore()
    const setId = `test-set-risk-${Date.now()}`
    const seed = makeSet(setId)
    seed.entries = [
      {
        ...seed.entries[0],
        id: `${setId}-safe`,
        word: 'safe',
        lemma: 'safe',
        confidence: 0.9,
        reviewFlags: [],
      },
      {
        ...seed.entries[0],
        id: `${setId}-low`,
        word: 'low',
        lemma: 'low',
        confidence: 0.4,
        reviewFlags: ['low_confidence'],
      },
      {
        ...seed.entries[0],
        id: `${setId}-offscope`,
        word: 'offscope',
        lemma: 'offscope',
        confidence: 0.95,
        reviewFlags: ['off_scope'],
      },
    ]
    await store.saveDraftSet(seed)

    const ordered = await store.listEntriesByRisk(setId, { excludeApproved: true })
    expect(ordered?.map((entry) => entry.id)).toEqual([`${setId}-offscope`, `${setId}-low`, `${setId}-safe`])

    const updated = await store.bulkUpdateEntries(
      setId,
      (entry) => (entry.confidence ?? 0) >= 0.75 && !(entry.reviewFlags ?? []).includes('off_scope'),
      { approved: true },
    )
    expect(updated?.entries.find((entry) => entry.id === `${setId}-safe`)?.approved).toBe(true)
    expect(updated?.entries.find((entry) => entry.id === `${setId}-offscope`)?.approved).toBe(false)
  })
})
