import { describe, expect, it } from 'vitest'
import { preferPartEntries, preparedMeaningFromEntries } from './prepared-meaning'

const entries = [
  { word: 'court', definition: 'A special playing area for sports like basketball, tennis, or volleyball.' },
  { word: 'athlete', definition: 'A person who trains and plays a sport.' },
  { word: 'bank', definition: 'The land beside a river.' },
]

describe('prepared vault meaning', () => {
  it('uses the lesson definition, including a simple plural of the headword', () => {
    expect(preparedMeaningFromEntries('Athlete', entries, '')).toBe('A person who trains and plays a sport.')
    expect(preparedMeaningFromEntries('athletes', entries, '')).toBe('A person who trains and plays a sport.')
    expect(preparedMeaningFromEntries('shell', entries, '')).toBe('')
  })

  it('skips a definition that is only the context sentence', () => {
    const sentence = 'The racer led the entire way.'
    expect(preparedMeaningFromEntries('entire', [{ word: 'entire', definition: sentence }], sentence)).toBe('')
    expect(preparedMeaningFromEntries('thing', [{ word: 'thing', definition: 'Vocabulary: thing' }], '')).toBe('')
  })

  it('prefers the part the word was saved from', () => {
    const words = preferPartEntries(
      [
        { partId: 'story', words: [{ word: 'bank', definition: 'A place that keeps money.' }] },
        { partId: 'vocab', words: [{ word: 'bank', definition: 'The land beside a river.' }] },
      ],
      'vocab',
    )
    expect(preparedMeaningFromEntries('bank', words, '')).toBe('The land beside a river.')
  })
})
