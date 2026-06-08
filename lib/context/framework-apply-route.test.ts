import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/context/framework/apply/route'
import { FileContextStore } from '@/lib/context/file-store'
import type { PartContextRecord } from '@/lib/context/types'
import { CONTEXT_VERSION, stableId } from '@/lib/context/utils'

async function cleanupContextRecords(bookId: string, unitId: string, lessonId: string, partId: string) {
  const contextDir = join(process.cwd(), 'data', 'context')
  const indexPath = join(contextDir, 'index.json')
  const ids = [
    stableId(`book:${bookId}`),
    stableId(`unit:${bookId}:${unitId}`),
    stableId(`lesson:${bookId}:${unitId}:${lessonId}`),
    stableId(`part:${bookId}:${unitId}:${lessonId}:${partId}`),
  ]
  await Promise.all(ids.map((id) => rm(join(contextDir, `${id}.json`), { force: true })))
  try {
    const raw = await readFile(indexPath, 'utf8')
    const index = JSON.parse(raw) as Record<string, string>
    delete index[`book::${bookId}`]
    delete index[`unit::${bookId}::${unitId}`]
    delete index[`lesson::${bookId}::${unitId}::${lessonId}`]
    delete index[`part::${bookId}::${unitId}::${lessonId}::${partId}`]
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8')
  } catch {
    // Test cleanup should not hide the route assertion result.
  }
}

describe('framework apply route', () => {
  it('preserves teacher-saved interactive vocabulary for an existing part', async () => {
    const suffix = Date.now().toString(36)
    const bookId = `book-${suffix}`
    const unitId = `unit-${suffix}`
    const lessonId = `lesson-${suffix}`
    const partId = `part-${suffix}`
    const store = new FileContextStore()
    const now = new Date().toISOString()
    const existingPart: PartContextRecord = {
      id: stableId(`part:${bookId}:${unitId}:${lessonId}:${partId}`),
      kind: 'part',
      bookId,
      unitId,
      lessonId,
      partId,
      partTitle: 'Warm Up',
      partGoals: ['Existing goal'],
      activityNotes: ['Existing note'],
      languageFocus: {
        grammarNotes: ['Existing grammar'],
        writingNotes: [],
      },
      sourcePageRange: { startPage: 3, endPage: 4 },
      scanProfile: 'balanced',
      contextVersion: CONTEXT_VERSION,
      createdAt: now,
      updatedAt: now,
      interactiveVocabulary: [
        {
          id: 'word-1',
          word: 'river',
          definition: 'A long body of water.',
          examples: ['The river is wide.'],
        },
      ],
    }

    await store.savePartContext(existingPart)
    try {
      const res = await POST(new Request('http://localhost/api/context/framework/apply', {
        method: 'POST',
        body: JSON.stringify({
          bookId,
          focusAreas: ['Vocabulary'],
          focusNotesByLesson: {
            [lessonId]: {
              Vocabulary: 'Warm Up: Practice target words aloud',
            },
          },
          rows: [
            {
              unitId,
              unitTitle: 'Unit',
              lessonId,
              lessonTitle: 'Lesson',
              sourcePageRange: { startPage: 3, endPage: 4 },
            },
          ],
          lessonParts: [
            {
              lessonId,
              parts: [
                {
                  partId,
                  partTitle: 'Warm Up',
                  sourcePageRange: { startPage: 3, endPage: 4 },
                },
              ],
            },
          ],
        }),
      }))
      const body = await res.json() as { ok?: boolean }
      expect(body.ok).toBe(true)

      const saved = await store.getPartContext(bookId, unitId, lessonId, partId)
      expect(saved?.interactiveVocabulary).toEqual(existingPart.interactiveVocabulary)
      expect(saved?.partGoals).toContain('Practice target words aloud')
      expect(saved?.partGoals).toContain('Existing goal')
      expect(saved?.activityNotes).toContain('Existing note')
      expect(saved?.languageFocus.grammarNotes).toContain('Existing grammar')
    } finally {
      await cleanupContextRecords(bookId, unitId, lessonId, partId)
    }
  })
})
