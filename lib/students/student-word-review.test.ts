import { describe, expect, it } from 'vitest'
import {
  aggregatedRowsFromVocabSignals,
  buildSeedEntriesFromRows,
  buildStudentWordReviewView,
  mergeWordReviewView,
  resolveVocabSignalsFromWordReview,
  sanitizeWordReviewEntries,
} from '@/lib/students/student-word-review'

describe('student word review', () => {
  it('merges aggregated rows with teacher entries', () => {
    const view = mergeWordReviewView({
      entries: [{ word: 'hello', strength: 'strong', source: 'manual', updatedAt: '2026-01-01T00:00:00.000Z' }],
      hidden: [],
      aggregatedRows: [
        { word: 'hello', strength: 'needs_practice', source: 'class_outcome' },
        { word: 'world', strength: 'needs_practice', source: 'class_outcome' },
      ],
    })
    expect(view.goingWell.map((row) => row.word)).toEqual(['hello'])
    expect(view.needsPractice.map((row) => row.word)).toEqual(['world'])
  })

  it('hides removed words from the merged view', () => {
    const view = mergeWordReviewView({
      entries: [],
      hidden: ['world'],
      aggregatedRows: [{ word: 'world', strength: 'needs_practice', source: 'class_outcome' }],
    })
    expect(view.needsPractice).toEqual([])
    expect(view.goingWell).toEqual([])
  })

  it('seeds entries from aggregated signals', () => {
    const rows = aggregatedRowsFromVocabSignals({
      needsPracticeWords: ['cat'],
      strongWords: ['dog'],
      savedNotebookWords: ['bird'],
    })
    const seeded = buildSeedEntriesFromRows(rows, '2026-07-01T10:00:00.000Z')
    expect(seeded).toEqual(
      expect.arrayContaining([
        { word: 'cat', strength: 'needs_practice', source: 'seeded', updatedAt: '2026-07-01T10:00:00.000Z' },
        { word: 'dog', strength: 'strong', source: 'seeded', updatedAt: '2026-07-01T10:00:00.000Z' },
      ]),
    )
  })

  it('maps review view back to prep vocab signals', () => {
    const view = buildStudentWordReviewView(
      {
        wordReviewEntries: sanitizeWordReviewEntries([
          { word: 'focus', strength: 'needs_practice', source: 'manual', updatedAt: '2026-01-01' },
        ]),
        wordReviewHidden: [],
      },
      [{ word: 'stable', strength: 'strong', source: 'class_outcome' }],
    )
    const signals = resolveVocabSignalsFromWordReview(view)
    expect(signals.needsPracticeWords).toEqual(['focus'])
    expect(signals.strongWords).toEqual(['stable'])
  })
})
