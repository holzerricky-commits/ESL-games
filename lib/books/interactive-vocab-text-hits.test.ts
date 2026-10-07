import { describe, expect, it } from 'vitest'
import {
  buildSpanConcatMap,
  findHeadwordRangesInText,
  matchVocabWordsToSpanTexts,
  normalizeVocabMatchToken,
  spanIndicesForRanges,
} from '@/lib/books/interactive-vocab-text-hits'

describe('normalizeVocabMatchToken', () => {
  it('lowercases and strips edge punctuation', () => {
    expect(normalizeVocabMatchToken('  Athlete! ')).toBe('athlete')
    expect(normalizeVocabMatchToken('"court,"')).toBe('court')
  })

  it('keeps inner apostrophes', () => {
    expect(normalizeVocabMatchToken("don't")).toBe("don't")
  })
})

describe('findHeadwordRangesInText', () => {
  it('finds case-insensitive whole words', () => {
    expect(findHeadwordRangesInText('The Athlete ran.', 'athlete')).toEqual([{ start: 4, end: 11 }])
  })

  it('ignores substring matches inside longer words', () => {
    expect(findHeadwordRangesInText('championship game', 'champion')).toEqual([])
  })

  it('matches when surrounded by punctuation', () => {
    expect(findHeadwordRangesInText('(court).', 'court')).toEqual([{ start: 1, end: 6 }])
  })

  it('finds multiple occurrences', () => {
    expect(findHeadwordRangesInText('power and power', 'power')).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 15 },
    ])
  })
})

describe('buildSpanConcatMap + spanIndicesForRanges', () => {
  it('maps char ranges across split spans', () => {
    const { concat, slices } = buildSpanConcatMap(['ath', 'lete', ' ran'])
    expect(concat).toBe('athlete ran')
    const ranges = findHeadwordRangesInText(concat, 'athlete')
    expect(ranges).toEqual([{ start: 0, end: 7 }])
    expect(spanIndicesForRanges(slices, ranges)).toEqual([0, 1])
  })
})

describe('matchVocabWordsToSpanTexts', () => {
  it('matches single-span headwords', () => {
    const hits = matchVocabWordsToSpanTexts(['The ', 'athlete', ' won.'], [
      { id: 'athlete', word: 'athlete' },
      { id: 'court', word: 'court' },
    ])
    expect(hits).toEqual([{ wordId: 'athlete', word: 'athlete', spanIndices: [1] }])
  })

  it('matches headwords split across spans', () => {
    const hits = matchVocabWordsToSpanTexts(['com', 'pet', 'itor'], [
      { id: 'competitor', word: 'competitor' },
    ])
    expect(hits).toHaveLength(1)
    expect(hits[0]?.spanIndices).toEqual([0, 1, 2])
  })

  it('matches punctuation-wrapped tokens via concat', () => {
    const hits = matchVocabWordsToSpanTexts(['power,', ' then'], [{ id: 'power', word: 'power' }])
    expect(hits).toHaveLength(1)
    expect(hits[0]?.spanIndices).toEqual([0])
  })

  it('prefers longer headword when both could apply at boundaries', () => {
    const hits = matchVocabWordsToSpanTexts(['championship'], [
      { id: 'champ', word: 'champ' },
      { id: 'championship', word: 'championship' },
    ])
    expect(hits.map((h) => h.wordId)).toEqual(['championship'])
  })
})
