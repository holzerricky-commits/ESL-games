import { describe, expect, it } from 'vitest'
import {
  addNewLessonGrammarItems,
  findTargetInSentence,
  grammarItemsForLesson,
  grammarItemsForLessons,
  grammarRuleForLesson,
  grammarRuleForLessons,
  grammarSaveFromPick,
  grammarTargetText,
  normalizeLessonGrammarDiskPayload,
  parseGrammarDistractors,
  removeLessonGrammarItem,
  restoreLessonGrammarItem,
  setLessonGrammarRule,
  toggleGrammarTargetWord,
  updateLessonGrammarItem,
  upsertLessonGrammarItem,
  type LessonGrammarSaveInput,
} from '@/lib/lesson-grammar/types'

const base: LessonGrammarSaveInput = {
  bookId: 'b1',
  unitId: 'u1',
  lessonId: 'l1',
  lessonTitle: 'Turtles',
  partId: 'p7',
  partTitle: 'Grammar',
  sentence: 'Yesterday the turtle went to the beach.',
  target: 'went',
  pdfPage: 40,
}

let n = 0
const opts = () => ({ now: '2026-10-09T12:00:00.000Z', createId: () => `g-${++n}` })
const SENTENCE = 'She ate an apple and an orange.'

describe('grammar targets', () => {
  it('finds whole words only, ignoring case', () => {
    expect(findTargetInSentence('The cat sat on the mat.', 'at')).toBeNull()
    expect(findTargetInSentence('The cat sat on the mat.', 'THE')).toEqual({ start: 0, end: 3 })
    expect(findTargetInSentence('He has  gone home.', 'has gone')).toEqual({ start: 3, end: 12 })
  })

  it('marks, grows, trims and clears with word clicks', () => {
    // words: She(0) ate(1) an(2) apple(3) and(4) an(5) orange(6)
    const an = toggleGrammarTargetWord(SENTENCE, null, 5)
    expect(SENTENCE.slice(an!.start, an!.end)).toBe('an')
    expect(an!.start).toBe(21)

    const grown = toggleGrammarTargetWord(SENTENCE, an, 6)
    expect(SENTENCE.slice(grown!.start, grown!.end)).toBe('an orange')

    const trimmed = toggleGrammarTargetWord(SENTENCE, grown, 5)
    expect(SENTENCE.slice(trimmed!.start, trimmed!.end)).toBe('orange')

    const elsewhere = toggleGrammarTargetWord(SENTENCE, trimmed, 1)
    expect(SENTENCE.slice(elsewhere!.start, elsewhere!.end)).toBe('ate')

    expect(toggleGrammarTargetWord(SENTENCE, elsewhere, 1)).toBeNull()
  })

  it('treats long picks as the whole sentence', () => {
    expect(grammarSaveFromPick('went', 'Yesterday the turtle went to the beach.')).toEqual({
      sentence: 'Yesterday the turtle went to the beach.',
      target: 'went',
    })
    expect(grammarSaveFromPick('the turtle went to the beach', 'Yesterday the turtle went to the beach.').target).toBe('')
    expect(grammarSaveFromPick('Grammar Review', '')).toEqual({ sentence: 'Grammar Review', target: '' })
  })

  it('parses wrong options without repeats or the target', () => {
    expect(parseGrammarDistractors('go, goes; Went, go ,, gone', 'went')).toEqual(['go', 'goes', 'gone'])
  })
})

describe('grammar store', () => {
  it('adds a sentence with its target marked', () => {
    const { items, mode, item } = upsertLessonGrammarItem([], base, opts())
    expect(mode).toBe('added')
    expect(items).toHaveLength(1)
    expect(grammarTargetText(item)).toBe('went')
  })

  it('re-marks an existing sentence and drops old wrong options', () => {
    const first = upsertLessonGrammarItem([], base, opts())
    const withOptions = updateLessonGrammarItem(first.items, first.item.id, { distractors: ['go', 'goes'] }, 'now')!
    const again = upsertLessonGrammarItem(withOptions.items, { ...base, target: 'turtle' }, opts())
    expect(again.mode).toBe('updated')
    expect(again.items).toHaveLength(1)
    expect(grammarTargetText(again.item)).toBe('turtle')
    expect(again.item.distractors).toEqual([])
  })

  it('keeps the mark when the edited sentence still contains it', () => {
    const { items, item } = upsertLessonGrammarItem([], base, opts())
    const edited = updateLessonGrammarItem(items, item.id, { sentence: 'Last week the turtle went home.' }, 'now')!
    expect(grammarTargetText(edited.item)).toBe('went')
    const lost = updateLessonGrammarItem(edited.items, item.id, { sentence: 'The turtle swims.' }, 'now')!
    expect(lost.item.targetStart).toBe(-1)
  })

  it('removes and restores in place', () => {
    const a = upsertLessonGrammarItem([], base, opts())
    const b = upsertLessonGrammarItem(a.items, { ...base, sentence: 'They ran fast.', target: 'ran' }, opts())
    const removed = removeLessonGrammarItem(b.items, a.item.id)!
    expect(removed.items).toHaveLength(1)
    const restored = restoreLessonGrammarItem(removed.items, removed.removed, removed.index)
    expect(restored.map((i) => i.id)).toEqual([a.item.id, b.item.id])
  })

  it('filters by lesson and stores one rule per lesson', () => {
    const a = upsertLessonGrammarItem([], base, opts())
    const b = upsertLessonGrammarItem(a.items, { ...base, lessonId: 'l2' }, opts())
    expect(grammarItemsForLesson(b.items, base)).toHaveLength(1)

    let rules = setLessonGrammarRule([], base, 'Past tense', 'now')
    rules = setLessonGrammarRule(rules, base, 'Past tense: add -ed', 'now')
    expect(rules).toHaveLength(1)
    expect(grammarRuleForLesson(rules, base)).toBe('Past tense: add -ed')
    expect(setLessonGrammarRule(rules, base, '  ', 'now')).toEqual([])
  })

  it('unions a teaching week and prefers the first lesson rule', () => {
    const workshop = upsertLessonGrammarItem([], { ...base, bookId: 'ws', lessonId: 'ws-1', sentence: 'Friends help.' }, opts())
    const both = upsertLessonGrammarItem(
      workshop.items,
      { ...base, bookId: 'lit', unitId: 'lit-u', lessonId: 'lit-1', sentence: 'The river runs.' },
      opts(),
    )
    const refs = [
      { bookId: 'ws', unitId: 'u1', lessonId: 'ws-1' },
      { bookId: 'lit', unitId: 'lit-u', lessonId: 'lit-1' },
    ]
    expect(grammarItemsForLessons(both.items, refs).map((item) => item.sentence)).toEqual([
      'Friends help.',
      'The river runs.',
    ])
    const rules = setLessonGrammarRule(
      setLessonGrammarRule([], refs[1]!, 'Literature rule', 'now'),
      refs[0]!,
      'Workshop rule',
      'now',
    )
    expect(grammarRuleForLessons(rules, refs)).toBe('Workshop rule')
    expect(grammarRuleForLessons(rules, [refs[1]!])).toBe('Literature rule')
    expect(grammarRuleForLessons(rules, [])).toBe('')
  })

  it('drops broken entries and bad target ranges when normalizing', () => {
    const payload = normalizeLessonGrammarDiskPayload({
      byStudent: {
        s1: [
          { id: 'x', bookId: 'b1', unitId: 'u1', lessonId: 'l1', sentence: 'Hi there.', targetStart: 3, targetEnd: 99 },
          { id: 'y', bookId: 'b1', unitId: 'u1', lessonId: 'l1', sentence: '' },
        ],
      },
      rulesByStudent: { s1: [{ bookId: 'b1', unitId: 'u1', lessonId: 'l1', text: 'Greetings' }] },
    })
    expect(payload.byStudent.s1).toHaveLength(1)
    expect(payload.byStudent.s1![0]!.targetStart).toBe(-1)
    expect(payload.rulesByStudent.s1).toHaveLength(1)
    expect(normalizeLessonGrammarDiskPayload(null)).toEqual({ byStudent: {}, rulesByStudent: {} })
  })

  it('keeps the AI draft flag through normalizing and ignores unknown sources', () => {
    const payload = normalizeLessonGrammarDiskPayload({
      byStudent: {
        s1: [
          { id: 'x', bookId: 'b1', unitId: 'u1', lessonId: 'l1', sentence: 'Hi there.', source: 'ai' },
          { id: 'y', bookId: 'b1', unitId: 'u1', lessonId: 'l1', sentence: 'Bye now.', source: 'robot' },
        ],
      },
    })
    expect(payload.byStudent.s1![0]!.source).toBe('ai')
    expect('source' in payload.byStudent.s1![1]!).toBe(false)
  })
})

describe('adding AI drafts', () => {
  const draft = (sentence: string, target: string, distractors: string[] = []): LessonGrammarSaveInput => ({
    ...base,
    sentence,
    target,
    distractors,
    source: 'ai',
  })

  it('adds new sentences with marks, wrong options and the AI flag', () => {
    const { items, added } = addNewLessonGrammarItems([], [draft('They went home.', 'went', ['go', 'Went', 'goes'])], opts())
    expect(items).toHaveLength(1)
    expect(added[0]!.source).toBe('ai')
    expect(grammarTargetText(added[0]!)).toBe('went')
    expect(added[0]!.distractors).toEqual(['go', 'goes'])
  })

  it('drops wrong options when the target is not in the sentence', () => {
    const { added } = addNewLessonGrammarItems([], [draft('They went home.', 'gone', ['go'])], opts())
    expect(added[0]!.targetStart).toBe(-1)
    expect(added[0]!.distractors).toEqual([])
  })

  it('skips sentences already in the lesson or repeated in the batch, and leaves them untouched', () => {
    const existing = upsertLessonGrammarItem([], base, opts())
    const { items, added } = addNewLessonGrammarItems(
      existing.items,
      [
        draft(base.sentence.toUpperCase(), 'turtle'),
        draft('They ran fast.', 'ran'),
        draft('they ran  fast.', 'ran'),
        { ...draft(base.sentence, 'went'), lessonId: 'l2' },
      ],
      opts(),
    )
    expect(added.map((item) => item.sentence)).toEqual(['They ran fast.', base.sentence])
    expect(items).toHaveLength(3)
    expect(items[0]).toEqual(existing.item)
  })

  it('clears the AI flag once the teacher edits the sentence', () => {
    const { items, added } = addNewLessonGrammarItems([], [draft('They went home.', 'went', ['go'])], opts())
    const edited = updateLessonGrammarItem(items, added[0]!.id, { distractors: ['go', 'goes'] }, 'now')!
    expect(edited.item.source).toBeUndefined()
  })
})
