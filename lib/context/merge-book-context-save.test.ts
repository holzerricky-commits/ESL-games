import { describe, expect, it } from 'vitest'
import { mergeBookContextSaveWithExisting } from '@/lib/context/merge-book-context-save'
import type { BookContextRecord } from '@/lib/context/types'

function makeRecord(overrides: Partial<BookContextRecord> = {}): BookContextRecord {
  return {
    id: 'book:demo',
    kind: 'book',
    bookId: 'demo',
    summary: 'Summary',
    goals: ['Goal A'],
    pacing: ['Week 1'],
    instructionalPriorities: ['Vocab'],
    focusAreas: ['Selection'],
    focusNotesByLesson: { l1: { Selection: 'note' } },
    sourcePageRange: { startPage: 1, endPage: 10 },
    materials: [
      {
        type: 'pacing-guide',
        title: 'Pacing',
        url: 'https://example.com/pacing',
        notes: '',
        confidence: 'high',
      },
    ],
    evidence: [
      {
        field: 'summary',
        sourceUrl: 'https://example.com/pacing',
        snippet: 'snippet',
        confidence: 'medium',
      },
    ],
    contextVersion: '1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('mergeBookContextSaveWithExisting', () => {
  it('returns incoming unchanged when nothing is saved yet', () => {
    const incoming = makeRecord({ materials: [], evidence: [], goals: [] })
    expect(mergeBookContextSaveWithExisting(incoming, null)).toEqual(incoming)
  })

  it('preserves research fields when a focus-table save sends empties', () => {
    const existing = makeRecord()
    const incoming = makeRecord({
      summary: 'Edited summary',
      focusAreas: ['Selection', 'Grammar'],
      focusNotesByLesson: { l1: { Selection: 'updated' } },
      goals: [],
      pacing: [],
      instructionalPriorities: [],
      materials: [],
      evidence: [],
      sourcePageRange: null,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T12:00:00.000Z',
    })

    const merged = mergeBookContextSaveWithExisting(incoming, existing)

    expect(merged.summary).toBe('Edited summary')
    expect(merged.focusAreas).toEqual(['Selection', 'Grammar'])
    expect(merged.focusNotesByLesson).toEqual({ l1: { Selection: 'updated' } })
    expect(merged.updatedAt).toBe('2026-08-05T12:00:00.000Z')
    expect(merged.createdAt).toBe(existing.createdAt)
    expect(merged.materials).toEqual(existing.materials)
    expect(merged.evidence).toEqual(existing.evidence)
    expect(merged.goals).toEqual(existing.goals)
    expect(merged.pacing).toEqual(existing.pacing)
    expect(merged.instructionalPriorities).toEqual(existing.instructionalPriorities)
    expect(merged.sourcePageRange).toEqual(existing.sourcePageRange)
  })

  it('keeps non-empty incoming research fields from a fresh AI approve', () => {
    const existing = makeRecord()
    const incoming = makeRecord({
      goals: ['New goal'],
      materials: [
        {
          type: 'vocabulary',
          title: 'Word list',
          url: 'https://example.com/words',
          notes: '',
          confidence: 'high',
        },
      ],
      evidence: [],
      createdAt: 'ignored',
      updatedAt: '2026-08-05T12:00:00.000Z',
    })

    const merged = mergeBookContextSaveWithExisting(incoming, existing)

    expect(merged.goals).toEqual(['New goal'])
    expect(merged.materials).toEqual(incoming.materials)
    expect(merged.evidence).toEqual(existing.evidence)
    expect(merged.createdAt).toBe(existing.createdAt)
  })
})
