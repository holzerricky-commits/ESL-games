import { describe, expect, it } from 'vitest'
import {
  buildGrammarGeneratePrompt,
  GRAMMAR_GENERATE_MAX_ITEMS,
  parseGeneratedGrammar,
} from '@/lib/lesson-grammar/generate'

describe('buildGrammarGeneratePrompt', () => {
  it('includes lesson, rule, notes, saved sentences and page text', () => {
    const prompt = buildGrammarGeneratePrompt({
      lessonTitle: 'The Trial of Cardigan Jones',
      pages: [
        { pdfPage: 12, text: 'Grammar\nThe dog runs. The dogs run.' },
        { pdfPage: 13, text: '' },
      ],
      grammarNotes: ['Subject-verb agreement', '  '],
      rule: 'Subject-Verb Agreement',
      existingSentences: ['The dog runs.'],
    })
    expect(prompt).toContain('Lesson: The Trial of Cardigan Jones')
    expect(prompt).toContain("Teacher's grammar point: Subject-Verb Agreement")
    expect(prompt).toContain('Lesson plan grammar notes: Subject-verb agreement')
    expect(prompt).toContain('Already saved sentences: "The dog runs."')
    expect(prompt).toContain('--- Page 12 ---\nGrammar\nThe dog runs. The dogs run.')
    expect(prompt).not.toContain('--- Page 13 ---')
  })

  it('says (none) for missing context and caps long page text', () => {
    const prompt = buildGrammarGeneratePrompt({
      lessonTitle: '',
      pages: [{ pdfPage: 1, text: 'a'.repeat(20000) }],
      grammarNotes: [],
      rule: '',
      existingSentences: [],
    })
    expect(prompt).toContain("Teacher's grammar point: (none yet)")
    expect(prompt).toContain('Lesson plan grammar notes: (none)')
    expect(prompt.length).toBeLessThan(9000)
  })
})

describe('parseGeneratedGrammar', () => {
  it('keeps marked sentences with up to three wrong options', () => {
    const out = parseGeneratedGrammar(
      JSON.stringify({
        rule: '  Use runs with one,\n run with many. ',
        items: [
          { sentence: 'The  dog runs fast.', target: 'RUNS', distractors: ['run', 'running', 'runned', 'ran', 'runs'] },
        ],
      }),
    )
    expect(out.rule).toBe('Use runs with one, run with many.')
    expect(out.items).toEqual([{ sentence: 'The dog runs fast.', target: 'runs', distractors: ['run', 'running', 'runned'] }])
  })

  it('accepts fenced JSON', () => {
    const out = parseGeneratedGrammar('```json\n{"rule":"R","items":[{"sentence":"She is happy.","target":"is","distractors":["are"]}]}\n```')
    expect(out.items).toHaveLength(1)
  })

  it('leaves items unmarked (no wrong options) when the target is not in the sentence', () => {
    const out = parseGeneratedGrammar(
      JSON.stringify({ items: [{ sentence: 'They walked home.', target: 'walk', distractors: ['walks'] }] }),
    )
    expect(out.items).toEqual([{ sentence: 'They walked home.', target: '', distractors: [] }])
  })

  it('drops long, duplicate, already-saved and malformed sentences', () => {
    const long = Array.from({ length: 25 }, () => 'word').join(' ')
    const out = parseGeneratedGrammar(
      JSON.stringify({
        items: [
          { sentence: long, target: 'word' },
          { sentence: 'We play outside.', target: 'play' },
          { sentence: 'we play  outside.', target: 'play' },
          { sentence: 'The cat sleeps.', target: 'sleeps' },
          null,
          { target: 'x' },
          'text',
        ],
      }),
      ['The cat sleeps.'],
    )
    expect(out.items.map((item) => item.sentence)).toEqual(['We play outside.'])
  })

  it('caps the number of items', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ sentence: `Tom has ${i} apples.`, target: 'has', distractors: ['have'] }))
    expect(parseGeneratedGrammar(JSON.stringify({ items })).items).toHaveLength(GRAMMAR_GENERATE_MAX_ITEMS)
  })

  it('returns nothing for invalid JSON', () => {
    expect(parseGeneratedGrammar('not json')).toEqual({ rule: '', items: [] })
    expect(parseGeneratedGrammar('[1,2]')).toEqual({ rule: '', items: [] })
  })
})
