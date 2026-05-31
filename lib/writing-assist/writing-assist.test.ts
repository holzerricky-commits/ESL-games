import { describe, expect, it, beforeEach } from 'vitest'
import {
  applyCorrectionToText,
  getTokenBeforeCaret,
  tryRevertLastCorrection,
} from '@/lib/writing-assist/autocorrect'
import {
  createSpellEngineForTest,
  pickBestCandidate,
  resetSpellEngineForTests,
  typoSuggestsAdverbSuffix,
} from '@/lib/writing-assist/spell-engine'
import { suggestNextWord } from '@/lib/writing-assist/ghost-complete'

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
    const applied = applyCorrectionToText('hello worl', token, { from: 'worl', to: 'world' }, true)
    expect(applied.text).toBe('hello world ')
    expect(applied.caret).toBe(12)
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

  it('skips valid words', () => {
    const engine = createSpellEngineForTest([['phonics', 500]])
    engine.setLessonWords(['phonics'])
    expect(engine.suggestCorrection('phonics')).toBeNull()
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

  it('suggests next word after common prev without typing partial', () => {
    const hit = suggestNextWord('you', '', new Map(), new Set(), null)
    expect(hit?.word).toBe('are')
    expect(hit?.suffix).toBe('are')
  })

  it('suggests after hello with expanded bigrams', () => {
    const hit = suggestNextWord('hello', '', new Map(), new Set(), null)
    expect(hit?.word).toBeTruthy()
    expect(hit?.suffix).toBeTruthy()
  })
})
