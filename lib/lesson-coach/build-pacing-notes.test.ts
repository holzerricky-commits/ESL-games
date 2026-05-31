import { describe, expect, it } from 'vitest'
import { buildPacingNotes } from '@/lib/lesson-coach/build-pacing-notes'

describe('buildPacingNotes', () => {
  it('includes part goals and book pacing', () => {
    const text = buildPacingNotes({
      bookTitle: 'Grade 3',
      unitTitle: 'Unit 2',
      partTitle: 'Vocabulary',
      part: {
        partGoals: ['Introduce unit words'],
        activityNotes: ['Use picture cards'],
        languageFocus: { grammarNotes: [], writingNotes: [] },
      },
      book: {
        summary: '',
        goals: [],
        pacing: ['Week 1: phonics review'],
        instructionalPriorities: [],
      },
    })
    expect(text).toContain('Vocabulary')
    expect(text).toContain('Introduce unit words')
    expect(text).toContain('Week 1: phonics review')
  })

  it('returns placeholder when no context', () => {
    expect(buildPacingNotes({})).toContain('book context not saved')
  })
})
