import { describe, expect, it, beforeEach } from 'vitest'
import {
  applyCorrectionToText,
  getTokenBeforeCaret,
  tryRevertLastCorrection,
} from '@/lib/writing-assist/autocorrect'
import { suggestLonePronounI } from '@/lib/writing-assist/auto-capitalize'
import { suggestCommonTypo } from '@/lib/writing-assist/common-typos'
import { suggestContraction, contractionLookupKey } from '@/lib/writing-assist/contractions'
import { handleTextareaTriggerAutocorrect } from '@/lib/writing-assist/caret-text'
import { loadLearnedWords, rememberLearnedWord, resetLearnedWordsForTests } from '@/lib/writing-assist/learned-words'
import { findUnknownWordSpans, findWritingAssistMarkerSpans } from '@/lib/writing-assist/spell-markers'
import {
  capitalizeClosingSentence,
  findSentenceStartBeforePunctuation,
  findUncapitalizedSentenceStartSpans,
} from '@/lib/writing-assist/sentence-capitalization'
import {
  createSpellEngineForTest,
  pickBestCandidate,
  resetSpellEngineForTests,
  typoSuggestsAdverbSuffix,
} from '@/lib/writing-assist/spell-engine'
import { normalizeBeforePunctuation, runTriggerAutocorrect } from '@/lib/writing-assist/trigger-pipeline'
import { getPreviousWord, suggestNextWord, suggestNextWords, isBlockedGlueSuggestion } from '@/lib/writing-assist/ghost-complete'

describe('autocorrect token helpers', () => {
  it('extracts word before caret', () => {
    expect(getTokenBeforeCaret('hello worl', 10)).toEqual({
      token: 'worl',
      start: 6,
      end: 10,
    })
  })

  it('applies correction and space', () => {
    const token = { token: 'worl', start: 6, end: 10 }!
    const applied = applyCorrectionToText('hello worl', token, { from: 'worl', to: 'world' }, ' ')
    expect(applied.text).toBe('hello world ')
    expect(applied.caret).toBe(12)
  })

  it('applies correction before sentence-ending period', () => {
    const token = { token: 'teh', start: 7, end: 10 }!
    const applied = applyCorrectionToText('I like teh', token, { from: 'teh', to: 'the' }, '.')
    expect(applied.text).toBe('I like the.')
    expect(applied.caret).toBe(11)
  })

  it('reverts last correction on backspace position', () => {
    const last = {
      start: 6,
      end: 13,
      original: 'worl',
      replacement: 'world',
      spaceInserted: true,
    }
    const reverted = tryRevertLastCorrection('hello world ', 13, last)
    expect(reverted?.text).toBe('hello worl')
    expect(reverted?.caret).toBe(10)
  })

  it('corrects the last word when period ends the sentence', () => {
    const result = handleTextareaTriggerAutocorrect(
      { value: 'I like teh', selectionStart: 10, selectionEnd: 10 },
      (word) => (word === 'teh' ? { from: 'teh', to: 'the' } : null),
      '.',
    )
    expect(result?.state.value).toBe('I like the.')
    expect(result?.state.selectionStart).toBe(11)
  })

  it('corrects on comma and Enter', () => {
    const suggest = (word: string) => (word === 'teh' ? { from: 'teh', to: 'the' } : null)
    expect(
      handleTextareaTriggerAutocorrect(
        { value: 'see teh', selectionStart: 7, selectionEnd: 7 },
        suggest,
        ',',
      )?.state.value,
    ).toBe('see the,')
    expect(
      handleTextareaTriggerAutocorrect(
        { value: 'see teh', selectionStart: 7, selectionEnd: 7 },
        suggest,
        '\n',
      )?.state.value,
    ).toBe('see the\n')
  })
})

describe('trigger pipeline', () => {
  it('trims space before punctuation', () => {
    expect(normalizeBeforePunctuation('word  ', 6, '.')).toEqual({ text: 'word', caret: 4 })
    const result = runTriggerAutocorrect('word  ', 6, '.', () => null)
    expect(result.text).toBe('Word.')
  })

  it('capitalizes lone i on space', () => {
    const result = runTriggerAutocorrect('well i', 6, ' ', () => null)
    expect(result.text).toBe('well I ')
  })

  it('capitalizes the closing sentence on . ! ?', () => {
    expect(runTriggerAutocorrect('hello world', 11, '.', () => null).text).toBe('Hello world.')
    expect(runTriggerAutocorrect('hello', 5, '.', () => null).text).toBe('Hello.')
    expect(runTriggerAutocorrect('Hello. world', 12, '.', () => null).text).toBe('Hello. World.')
    expect(runTriggerAutocorrect('wow', 3, '!', () => null).text).toBe('Wow!')
    expect(runTriggerAutocorrect('really', 6, '?', () => null).text).toBe('Really?')
  })

  it('keeps lowercase after punctuation for the next phrase', () => {
    const closed = runTriggerAutocorrect('hello world', 11, '.', () => null)
    expect(closed.text).toBe('Hello world.')
    expect(capitalizeClosingSentence(`${closed.text}and`, closed.text.length + 3, '.').text).toBe(
      'Hello world.and',
    )
  })

  it('capitalizes after autocorrect on the same trigger', () => {
    const result = runTriggerAutocorrect(
      'hello teh',
      9,
      '.',
      (word) => (word === 'teh' ? { from: 'teh', to: 'the' } : null),
    )
    expect(result.text).toBe('Hello the.')
  })
})

describe('sentence capitalization helpers', () => {
  it('finds sentence start before closing punctuation', () => {
    expect(findSentenceStartBeforePunctuation('hello world.', 11)).toBe(0)
    expect(findSentenceStartBeforePunctuation('Hello. world.', 12)).toBe(7)
  })

  it('capitalizes closing sentence in place', () => {
    expect(capitalizeClosingSentence('hello world.', 12, '.').text).toBe('Hello world.')
  })
})

describe('sentence capitalization markers', () => {
  it('flags lowercase at document start', () => {
    expect(findUncapitalizedSentenceStartSpans('hello')).toEqual([
      { start: 0, end: 1, kind: 'capitalization' },
    ])
  })

  it('flags lowercase after . ! ? with space or newline', () => {
    expect(findUncapitalizedSentenceStartSpans('Hello. world')).toEqual([
      { start: 7, end: 8, kind: 'capitalization' },
    ])
    expect(findUncapitalizedSentenceStartSpans('Wow! no')).toEqual([
      { start: 5, end: 6, kind: 'capitalization' },
    ])
    expect(findUncapitalizedSentenceStartSpans('One.\nTwo')).toEqual([])
    expect(findUncapitalizedSentenceStartSpans('one.\ntwo')).toEqual([
      { start: 0, end: 1, kind: 'capitalization' },
      { start: 5, end: 6, kind: 'capitalization' },
    ])
  })

  it('ignores mid-sentence lowercase and already capitalized starts', () => {
    expect(findUncapitalizedSentenceStartSpans('Hello still')).toEqual([])
    expect(findUncapitalizedSentenceStartSpans('Hello. Still')).toEqual([])
  })

  it('suggests I for lone i', () => {
    expect(suggestLonePronounI('i')).toBe('I')
  })
})

describe('contractions and common typos', () => {
  it('expands dont', () => {
    expect(suggestContraction('dont')).toBe("don't")
  })

  it('expands shouldnt and couldnt', () => {
    expect(suggestContraction('shouldnt')).toBe("shouldn't")
    expect(suggestContraction('couldnt')).toBe("couldn't")
    expect(suggestContraction('wouldnt')).toBe("wouldn't")
  })

  it('expands contractions typed with smart apostrophes or wrong placement', () => {
    expect(suggestContraction('shouldn\u2019t')).toBe("shouldn't")
    expect(suggestContraction('couldn\u2019t')).toBe("couldn't")
    expect(suggestContraction("should'nt")).toBe("shouldn't")
  })

  it('leaves canonical contractions unchanged', () => {
    expect(suggestContraction("shouldn't")).toBeNull()
    expect(suggestContraction("don't")).toBeNull()
  })

  it('normalizes lookup keys without apostrophes', () => {
    expect(contractionLookupKey("shouldn't")).toBe('shouldnt')
    expect(contractionLookupKey('shouldnt')).toBe('shouldnt')
  })

  it('expands shouldve and couldve', () => {
    expect(suggestContraction('shouldve')).toBe("should've")
    expect(suggestContraction('couldve')).toBe("could've")
  })

  it('fixes teh via common typos', () => {
    expect(suggestCommonTypo('teh')).toBe('the')
  })
})

describe('learned words', () => {
  beforeEach(() => {
    resetLearnedWordsForTests()
  })

  it('remembers and loads words', () => {
    rememberLearnedWord('Mirja')
    expect(loadLearnedWords().has('mirja')).toBe(true)
  })
})

describe('SpellEngine', () => {
  beforeEach(() => {
    resetSpellEngineForTests()
  })

  it('corrects obvious typo uncomfortuble', () => {
    const engine = createSpellEngineForTest([['uncomfortable', 1000]])
    const hit = engine.suggestCorrection('uncomfortuble')
    expect(hit?.to).toBe('uncomfortable')
  })

  it('corrects transpose si to is', () => {
    const engine = createSpellEngineForTest([['is', 5000]])
    const hit = engine.suggestCorrection('si')
    expect(hit?.to).toBe('is')
  })

  it('expands dont before SymSpell', () => {
    const engine = createSpellEngineForTest([['done', 100]])
    expect(engine.suggestCorrection('dont')?.to).toBe("don't")
  })

  it('expands shouldnt before SymSpell', () => {
    const engine = createSpellEngineForTest([
      ['shoulder', 5000],
      ['sholder', 4000],
      ['coolant', 3000],
    ])
    expect(engine.suggestCorrection('shouldnt')?.to).toBe("shouldn't")
    expect(engine.suggestCorrection('couldnt')?.to).toBe("couldn't")
  })

  it('still expands learned contraction typos', () => {
    const engine = createSpellEngineForTest([['shoulder', 5000]])
    engine.setLearnedWords(['shouldnt', 'couldnt'])
    expect(engine.suggestCorrection('shouldnt')?.to).toBe("shouldn't")
    expect(engine.suggestCorrection('couldnt')?.to).toBe("couldn't")
  })

  it('expands shouldnt on space trigger', () => {
    const suggest = (word: string) => {
      const to = suggestContraction(word)
      return to ? { from: word, to } : null
    }
    expect(runTriggerAutocorrect('I shouldnt', 10, ' ', suggest).text).toBe("I shouldn't ")
    expect(runTriggerAutocorrect('we couldn\u2019t', 11, ' ', suggest).text).toBe("we couldn't ")
  })

  it('skips valid words', () => {
    const engine = createSpellEngineForTest([['phonics', 500]])
    engine.setLessonWords(['Phonics'])
    expect(engine.suggestCorrection('Phonics')).toBeNull()
  })

  it('skips learned words', () => {
    const engine = createSpellEngineForTest([['hello', 5000]])
    engine.setLearnedWords(['helo'])
    expect(engine.suggestCorrection('helo')).toBeNull()
  })

  it('does not correct lesson vocabulary tokens', () => {
    const engine = createSpellEngineForTest([['esperanto', 100]])
    engine.setLessonWords(['Phonics'])
    expect(engine.isValidWord('Phonics')).toBe(true)
    expect(engine.suggestCorrection('Phonics')).toBeNull()
  })

  it('skips ambiguous corrections when top candidates tie in frequency', () => {
    const engine = createSpellEngineForTest([
      ['there', 5000],
      ['their', 5000],
    ])
    expect(engine.suggestCorrection('ther')).toBeNull()
  })

  it('prefers horizontally over horizontal for horizontaly', () => {
    const engine = createSpellEngineForTest([
      ['horizontal', 10_000_000],
      ['horizontally', 1_000_000],
    ])
    expect(engine.suggestCorrection('horizontaly')?.to).toBe('horizontally')
  })

  it('prefers longer -ly form over shorter high-frequency word', () => {
    const engine = createSpellEngineForTest([
      ['quick', 10_000_000],
      ['quickly', 1_000_000],
    ])
    expect(engine.suggestCorrection('quickli')?.to).toBe('quickly')
  })

  it('finds unknown word spans', () => {
    const engine = createSpellEngineForTest([['the', 5000]])
    const spans = findUnknownWordSpans('I like teh', engine)
    expect(spans).toEqual([{ start: 7, end: 10, kind: 'spell' }])
  })
})

describe('pickBestCandidate', () => {
  it('detects adverb suffix hint on typo', () => {
    expect(typoSuggestsAdverbSuffix('horizontaly')).toBe(true)
    expect(typoSuggestsAdverbSuffix('box')).toBe(false)
  })

  it('ranks longer -ly word above shorter prefix', () => {
    const best = pickBestCandidate(
      'horizontaly',
      [
        { term: 'horizontal', distance: 1, count: 10_000_000 },
        { term: 'horizontally', distance: 1, count: 1_000_000 },
      ],
      new Map([
        ['horizontal', 10_000_000],
        ['horizontally', 1_000_000],
      ]),
      new Set(),
    )
    expect(best?.term).toBe('horizontally')
  })
})

describe('getPreviousWord', () => {
  it('reads the word before a trailing space', () => {
    expect(getPreviousWord('hello ', 6)).toBe('hello')
    expect(getPreviousWord('I ', 2)).toBe('I')
  })

  it('reads the word after sentence punctuation', () => {
    expect(getPreviousWord('hello.', 6)).toBe('hello')
    expect(getPreviousWord('Hello. ', 7)).toBe('Hello')
    expect(getPreviousWord('Wow! ', 5)).toBe('Wow')
  })
})

describe('suggestNextWord', () => {
  it('suggests by dictionary prefix while typing', () => {
    const engine = createSpellEngineForTest([
      ['student', 5000],
      ['study', 3000],
      ['stuff', 100],
    ])
    const hit = suggestNextWord('', 'stu', new Map(), new Set(), engine)
    expect(hit?.word).toBe('student')
    expect(hit?.suffix).toBe('dent')
  })

  it('returns nothing until at least two characters are typed', () => {
    const engine = createSpellEngineForTest([
      ['hello', 5000],
      ['help', 3000],
    ])
    expect(suggestNextWord('', '', new Map(), new Set(), engine)).toBeNull()
    expect(suggestNextWord('', 'h', new Map(), new Set(), engine)).toBeNull()
    expect(suggestNextWords('', '', new Map(), new Set(), null, { text: '', caret: 0 })).toEqual([])
    expect(suggestNextWord('you', '', new Map(), new Set(), null, { text: 'you ', caret: 4 })).toBeNull()
  })

  it('does not suggest glue words without typed partial', () => {
    expect(isBlockedGlueSuggestion('the', '')).toBe(true)
    expect(isBlockedGlueSuggestion('the', 'th')).toBe(false)
  })

  it('suggests glue words when the student types them', () => {
    const engine = createSpellEngineForTest([['the', 5000], ['they', 3000], ['there', 2000]])
    const hit = suggestNextWord('', 'th', new Map(), new Set(), engine)
    expect(hit?.word).toBe('the')
    expect(hit?.suffix).toBe('e')
  })

  it('keeps suggesting when partial is a valid prefix word (e.g. an → animal)', () => {
    const engine = createSpellEngineForTest([
      ['an', 4000],
      ['animal', 3000],
      ['and', 2000],
    ])
    const hit = suggestNextWord('i', 'an', new Map(), new Set(), engine)
    expect(hit?.word).toBe('animal')
    expect(hit?.suffix).toBe('imal')
  })

  it('narrows suffix while accept-typing a suggested word', () => {
    const engine = createSpellEngineForTest([
      ['hello', 5000],
      ['help', 3000],
    ])
    expect(suggestNextWord('', 'h', new Map(), new Set(), engine)).toBeNull()
    expect(suggestNextWord('', 'he', new Map(), new Set(), engine)?.suffix).toBe('llo')
    expect(suggestNextWord('', 'hel', new Map(), new Set(), engine)?.suffix).toBe('lo')
  })
})
