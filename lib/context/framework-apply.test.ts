import { describe, expect, it } from 'vitest'
import { preservePartContextTeacherFields } from '@/lib/context/framework-apply'
import type { PartContextRecord } from '@/lib/context/types'

function partRecord(overrides: Partial<PartContextRecord> = {}): PartContextRecord {
  const now = new Date().toISOString()
  return {
    id: 'part-record',
    kind: 'part',
    bookId: 'book-1',
    unitId: 'unit-1',
    lessonId: 'lesson-1',
    partId: 'part-1',
    partTitle: 'Vocabulary in Context',
    partGoals: ['new framework goal'],
    activityNotes: ['new framework note'],
    languageFocus: { grammarNotes: [], writingNotes: [] },
    sourcePageRange: { startPage: 10, endPage: 11 },
    scanProfile: 'balanced',
    contextVersion: 'v1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('preservePartContextTeacherFields', () => {
  it('keeps teacher-authored interactive vocabulary during framework refreshes', () => {
    const existingWords = [
      {
        id: 'word-1',
        word: 'athlete',
        definition: 'A person who trains and plays a sport.',
        examples: ['The athlete raced in the Olympics.'],
      },
    ]
    const existing = partRecord({ interactiveVocabulary: existingWords })
    const next = partRecord({ partGoals: ['refreshed framework goal'] })

    expect(preservePartContextTeacherFields(next, existing)).toEqual({
      ...next,
      interactiveVocabulary: existingWords,
    })
  })

  it('does not invent an interactive vocabulary field when none exists', () => {
    const next = partRecord()

    expect(preservePartContextTeacherFields(next, null)).toBe(next)
  })
}
