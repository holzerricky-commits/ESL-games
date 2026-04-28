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
})
