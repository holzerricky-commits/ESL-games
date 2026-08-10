import { describe, expect, it } from 'vitest'
import {
  hasPrepExtras,
  prepExtrasFromAiSuggestion,
  prepRevisitWordLabels,
  sanitizeClassPrepExtras,
} from '@/lib/students/class-prep-extras'

describe('class prep extras', () => {
  it('sanitizes and dedupes AI extras', () => {
    const extras = prepExtrasFromAiSuggestion({
      priorities: ['  Focus speaking ', 'Focus speaking', ''],
      activities: ['Role play'],
      checkpointMoments: ['Mid-class check'],
      wordsToRevisit: [{ word: 'hello', reason: 'Often missed' }, { word: '', reason: 'x' }],
      differentiationTips: ['Pair strong with weak'],
      homeworkOrCarryOver: ['Review vocab'],
    })
    expect(extras.prepPriorities).toEqual(['Focus speaking'])
    expect(extras.prepWordsToRevisit).toEqual([{ word: 'hello', reason: 'Often missed' }])
    expect(hasPrepExtras(extras)).toBe(true)
  })

  it('returns false when no extras', () => {
    expect(hasPrepExtras(sanitizeClassPrepExtras({}))).toBe(false)
  })

  it('maps revisit word labels', () => {
    const labels = prepRevisitWordLabels({
      prepWordsToRevisit: [{ word: 'cat', reason: 'r' }, { word: 'dog', reason: 'r' }],
    })
    expect(labels).toEqual(['cat', 'dog'])
  })
})
