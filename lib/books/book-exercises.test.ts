import { describe, expect, it } from 'vitest'
import {
  bookExercisePinCenter,
  bookExerciseContentSummary,
  clampBookExercisePinCenter,
  clampPageNormRect,
  listBookExercisesForPdfPage,
  nextBookExerciseLabel,
  pageNormRectFromNormCorners,
  expandPageNormRect,
  parseBookExerciseGeminiDraft,
  parseBookExerciseMcqGeminiDraft,
  parseBookExerciseTask,
  resolveBookExercisePinCenter,
  parseWordBankText,
  sortBookExerciseTasks,
  approveBookExerciseTask,
  bookExercisePlacementsFilled,
  bookExerciseTaskCanApprove,
  bookExerciseMcqSelectionsFilled,
  countBookExerciseBlanks,
  emptyBookExerciseMcqSelections,
  emptyBookExercisePlacements,
  getLiveEligibleBookExerciseTasks,
  gradeBookExerciseMcqSelections,
  gradeBookExercisePlacements,
  isBookExerciseLiveEligible,
  remainingBookExerciseBank,
  revealedBookExerciseMcqSelections,
  revealedBookExercisePlacements,
  nearestBookExerciseGap,
  splitBookExerciseStem,
  type BookExerciseTask,
} from '@/lib/books/book-exercises'

function task(partial: Partial<BookExerciseTask> & Pick<BookExerciseTask, 'id' | 'pdfPage'>): BookExerciseTask {
  return {
    kind: 'word_bank',
    status: 'draft',
    unitId: 'unit-1',
    rect: { x: 0.1, y: 0.2, w: 0.4, h: 0.3 },
    label: 'Task 1',
    wordBank: [],
    items: [],
    questions: [],
    createdAt: '2026-08-17T00:00:00.000Z',
    updatedAt: '2026-08-17T00:00:00.000Z',
    approvedAt: null,
    ...partial,
  }
}

describe('clampPageNormRect', () => {
  it('rejects tiny boxes', () => {
    expect(clampPageNormRect({ x: 0.1, y: 0.1, w: 0.01, h: 0.4 })).toBeNull()
  })

  it('clamps to the page', () => {
    expect(clampPageNormRect({ x: -0.2, y: 0.5, w: 2, h: 0.6 })).toEqual({
      x: 0,
      y: 0.5,
      w: 1,
      h: 0.5,
    })
  })
})

describe('pageNormRectFromNormCorners', () => {
  it('normalizes drag direction', () => {
    const rect = pageNormRectFromNormCorners(0.6, 0.7, 0.2, 0.3)
    expect(rect).not.toBeNull()
    expect(rect!.x).toBeCloseTo(0.2)
    expect(rect!.y).toBeCloseTo(0.3)
    expect(rect!.w).toBeCloseTo(0.4)
    expect(rect!.h).toBeCloseTo(0.4)
  })
})

describe('bookExercisePinCenter', () => {
  it('sits on the top-left of the box', () => {
    const [x, y] = bookExercisePinCenter({ x: 0.2, y: 0.4, w: 0.4, h: 0.2 })
    expect(x).toBeCloseTo(0.2)
    expect(y).toBeCloseTo(0.4)
  })

  it('uses a saved pin when present', () => {
    const [x, y] = resolveBookExercisePinCenter(
      task({ id: 'a', pdfPage: 1, pin: [0.55, 0.61] }),
    )
    expect(x).toBeCloseTo(0.55)
    expect(y).toBeCloseTo(0.61)
  })

  it('clamps a pin to the page', () => {
    expect(clampBookExercisePinCenter([-0.2, 1.4])).toEqual([0, 1])
  })
})

describe('listBookExercisesForPdfPage', () => {
  it('keeps only that page', () => {
    const tasks = [task({ id: 'a', pdfPage: 3 }), task({ id: 'b', pdfPage: 4 })]
    expect(listBookExercisesForPdfPage(tasks, 3).map((item) => item.id)).toEqual(['a'])
  })
})

describe('nextBookExerciseLabel', () => {
  it('counts existing Task N labels', () => {
    expect(nextBookExerciseLabel([])).toBe('Task 1')
    expect(nextBookExerciseLabel([{ label: 'Task 2' }, { label: 'Task 1' }])).toBe('Task 3')
  })
})

describe('sortBookExerciseTasks', () => {
  it('orders by page then position', () => {
    const sorted = sortBookExerciseTasks([
      task({ id: 'b', pdfPage: 2, rect: { x: 0.1, y: 0.6, w: 0.3, h: 0.2 } }),
      task({ id: 'a', pdfPage: 2, rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.2 } }),
      task({ id: 'c', pdfPage: 1 }),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('parseBookExerciseTask', () => {
  it('reads a saved task and defaults kind to word_bank', () => {
    const parsed = parseBookExerciseTask({
      id: 'ex-1',
      unitId: 'u1',
      pdfPage: 12,
      rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
      label: 'Task 1',
      createdAt: '2026-08-17T00:00:00.000Z',
    })
    expect(parsed?.kind).toBe('word_bank')
    expect(parsed?.status).toBe('draft')
    expect(parsed?.pdfPage).toBe(12)
    expect(parsed?.questions).toEqual([])
  })

  it('reads a saved pin', () => {
    const parsed = parseBookExerciseTask({
      id: 'ex-1',
      unitId: 'u1',
      pdfPage: 12,
      rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
      pin: [0.12, 0.18],
      label: 'Task 1',
      createdAt: '2026-08-17T00:00:00.000Z',
    })
    expect(parsed?.pin).toEqual([0.12, 0.18])
  })

  it('drops broken records', () => {
    expect(parseBookExerciseTask({ id: 'x' })).toBeNull()
  })

  it('keeps word bank and items from a saved task', () => {
    const parsed = parseBookExerciseTask({
      id: 'ex-2',
      unitId: 'u1',
      pdfPage: 4,
      rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
      label: 'Task 1',
      wordBank: ['because', 'although', 'because'],
      items: [{ id: 'i1', stem: 'I stayed home ___ it rained.', answers: ['Because'] }],
      createdAt: '2026-08-17T00:00:00.000Z',
    })
    expect(parsed?.wordBank).toEqual(['because', 'although'])
    expect(parsed?.items[0]?.answers).toEqual(['because'])
    expect(parsed?.questions).toEqual([])
  })

  it('treats unknown kinds as word_bank', () => {
    const parsed = parseBookExerciseTask({
      id: 'ex-1',
      kind: 'true_false',
      unitId: 'u1',
      pdfPage: 12,
      rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
      label: 'Task 1',
    })
    expect(parsed?.kind).toBe('word_bank')
  })

  it('keeps multiple_choice boxes empty and not Check-ready', () => {
    const parsed = parseBookExerciseTask({
      id: 'ex-mcq',
      kind: 'multiple_choice',
      unitId: 'u1',
      pdfPage: 8,
      rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
      label: 'Task 2',
      status: 'approved',
      createdAt: '2026-08-17T00:00:00.000Z',
    })
    expect(parsed?.kind).toBe('multiple_choice')
    expect(parsed?.questions).toEqual([])
    expect(parsed?.wordBank).toEqual([])
    expect(parsed?.items).toEqual([])
    expect(parsed?.status).toBe('draft')
    expect(bookExerciseTaskCanApprove(parsed)).toBe(false)
    expect(isBookExerciseLiveEligible(parsed)).toBe(false)
    expect(bookExerciseContentSummary(parsed!)).toBe('empty')
  })

  it('round-trips a choose-answer question and becomes live when approved', () => {
    const parsed = parseBookExerciseTask({
      id: 'ex-mcq-2',
      kind: 'multiple_choice',
      unitId: 'u1',
      pdfPage: 8,
      rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
      label: 'Task 3',
      questions: [{ id: 'q1', prompt: 'What is it?', choices: ['cat', 'dog'], correctIndex: 0 }],
    })
    expect(parsed?.questions).toEqual([
      { id: 'q1', prompt: 'What is it?', choices: ['cat', 'dog'], correctIndex: 0 },
    ])
    expect(bookExerciseTaskCanApprove(parsed)).toBe(true)
    const approved = approveBookExerciseTask(parsed!)
    expect(approved?.status).toBe('approved')
    expect(isBookExerciseLiveEligible(approved)).toBe(true)
  })
})

describe('choose-answer quiz helpers', () => {
  it('will not approve an empty choose-answer box', () => {
    const empty = task({ id: 'mcq-empty', pdfPage: 1, kind: 'multiple_choice' })
    expect(bookExerciseTaskCanApprove(empty)).toBe(false)
    expect(approveBookExerciseTask(empty)).toBeNull()
  })

  it('approves a complete choose-answer task', () => {
    const ready = task({
      id: 'mcq-ready',
      pdfPage: 1,
      kind: 'multiple_choice',
      questions: [
        { id: 'q1', prompt: 'Pick one.', choices: ['A', 'B', 'C'], correctIndex: 1 },
        { id: 'q2', prompt: 'Pick again.', choices: ['Yes', 'No'], correctIndex: 0 },
      ],
    })
    expect(bookExerciseTaskCanApprove(ready)).toBe(true)
    const approved = approveBookExerciseTask(ready)
    expect(approved?.status).toBe('approved')
    expect(bookExerciseContentSummary(approved!)).toBe('approved')
    expect(isBookExerciseLiveEligible(approved)).toBe(true)
  })

  it('treats missing prompt or correct choice as incomplete', () => {
    const missingPrompt = task({
      id: 'mcq-bad',
      pdfPage: 1,
      kind: 'multiple_choice',
      questions: [{ id: 'q1', prompt: '  ', choices: ['A', 'B'], correctIndex: 0 }],
    })
    expect(bookExerciseTaskCanApprove(missingPrompt)).toBe(false)

    const missingCorrect = task({
      id: 'mcq-bad-2',
      pdfPage: 1,
      kind: 'multiple_choice',
      questions: [{ id: 'q1', prompt: 'Pick one.', choices: ['A', 'B'], correctIndex: null }],
    })
    expect(bookExerciseTaskCanApprove(missingCorrect)).toBe(false)
  })

  it('grades choose-answer selections after Check', () => {
    const ready = task({
      id: 'mcq-play',
      pdfPage: 1,
      kind: 'multiple_choice',
      questions: [
        { id: 'q1', prompt: 'Pick one.', choices: ['A', 'B'], correctIndex: 0 },
        { id: 'q2', prompt: 'Pick again.', choices: ['Yes', 'No'], correctIndex: 1 },
      ],
    })
    const selections = emptyBookExerciseMcqSelections(ready)
    expect(bookExerciseMcqSelectionsFilled(ready, selections)).toBe(false)
    selections.q1 = 0
    selections.q2 = 0
    expect(bookExerciseMcqSelectionsFilled(ready, selections)).toBe(true)
    const graded = gradeBookExerciseMcqSelections(ready, selections)
    expect(graded.byQuestion.q1).toBe(true)
    expect(graded.byQuestion.q2).toBe(false)
    expect(graded.allCorrect).toBe(false)
  })

  it('reveals keyed correct choices after Show answers', () => {
    const ready = task({
      id: 'mcq-reveal',
      pdfPage: 1,
      kind: 'multiple_choice',
      questions: [
        { id: 'q1', prompt: 'Pick one.', choices: ['A', 'B'], correctIndex: 0 },
        { id: 'q2', prompt: 'Pick again.', choices: ['Yes', 'No'], correctIndex: 1 },
      ],
    })
    const revealed = revealedBookExerciseMcqSelections(ready)
    expect(revealed).toEqual({ q1: 0, q2: 1 })
    expect(gradeBookExerciseMcqSelections(ready, revealed).allCorrect).toBe(true)
  })
})

describe('word-bank quiz helpers', () => {
  it('counts three-or-more underscores as blanks', () => {
    expect(countBookExerciseBlanks('A ___ B ______ C')).toBe(2)
  })

  it('parses a word bank from lines and skips duplicates', () => {
    expect(parseWordBankText('because\nalthough\nBecause\n')).toEqual(['because', 'although'])
  })

  it('will not approve an empty box', () => {
    expect(bookExerciseTaskCanApprove(task({ id: 'a', pdfPage: 1 }))).toBe(false)
    expect(getLiveEligibleBookExerciseTasks([task({ id: 'a', pdfPage: 1, status: 'approved' })])).toEqual(
      [],
    )
  })

  it('approves a complete word-bank task', () => {
    const ready = task({
      id: 'a',
      pdfPage: 1,
      wordBank: ['because', 'although'],
      items: [{ id: 'i1', stem: 'I stayed ___ it rained.', answers: ['because'] }],
    })
    expect(bookExerciseTaskCanApprove(ready)).toBe(true)
    const approved = approveBookExerciseTask(ready)
    expect(approved?.status).toBe('approved')
    expect(getLiveEligibleBookExerciseTasks([approved!])).toHaveLength(1)
  })

  it('treats a missing bank word as incomplete', () => {
    const ready = task({
      id: 'a',
      pdfPage: 1,
      wordBank: ['because'],
      items: [{ id: 'i1', stem: 'I stayed ___ it rained.', answers: ['although'] }],
    })
    expect(bookExerciseTaskCanApprove(ready)).toBe(false)
    expect(approveBookExerciseTask(ready)).toBeNull()
  })

  it('demotes approved packs that lost their answers on parse', () => {
    const parsed = parseBookExerciseTask({
      id: 'ex-3',
      unitId: 'u1',
      pdfPage: 4,
      rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
      status: 'approved',
      wordBank: [],
      items: [],
    })
    expect(parsed?.status).toBe('draft')
  })
})

describe('word-bank play helpers', () => {
  const ready = task({
    id: 'a',
    pdfPage: 1,
    status: 'approved',
    wordBank: ['because', 'although', 'unless'],
    items: [
      { id: 'i1', stem: 'I stayed ___ it rained.', answers: ['because'] },
      { id: 'i2', stem: '___ I was tired, I went.', answers: ['although'] },
    ],
  })

  it('splits stems into text and blanks', () => {
    expect(splitBookExerciseStem('I stayed ___ it rained.')).toEqual([
      { type: 'text', value: 'I stayed ' },
      { type: 'blank' },
      { type: 'text', value: ' it rained.' },
    ])
    expect(splitBookExerciseStem('A ______ B')).toEqual([
      { type: 'text', value: 'A ' },
      { type: 'blank' },
      { type: 'text', value: ' B' },
    ])
  })

  it('treats extra bank words as unused leftovers', () => {
    const placements = emptyBookExercisePlacements(ready)
    placements.i1 = ['because']
    expect(remainingBookExerciseBank(ready.wordBank, placements)).toEqual(['although', 'unless'])
    expect(bookExercisePlacementsFilled(ready, placements)).toBe(false)
  })

  it('grades filled blanks case-insensitively', () => {
    const placements = {
      i1: ['Because'],
      i2: ['unless'],
    }
    expect(bookExercisePlacementsFilled(ready, placements)).toBe(true)
    const graded = gradeBookExercisePlacements(ready, placements)
    expect(graded.byItem.i1).toEqual([true])
    expect(graded.byItem.i2).toEqual([false])
    expect(graded.allCorrect).toBe(false)
  })

  it('marks live only when approved and complete', () => {
    expect(isBookExerciseLiveEligible(ready)).toBe(true)
    expect(isBookExerciseLiveEligible({ ...ready, status: 'draft' })).toBe(false)
  })

  it('grades two gaps in one sentence and leaves extra bank words unused', () => {
    const twoGaps = task({
      id: 'b',
      pdfPage: 1,
      wordBank: ['tea', 'coffee', 'milk'],
      items: [{ id: 'i1', stem: 'I drink ___ and ___.', answers: ['tea', 'coffee'] }],
    })
    expect(splitBookExerciseStem(twoGaps.items[0]!.stem).filter((part) => part.type === 'blank')).toHaveLength(2)
    const revealed = revealedBookExercisePlacements(twoGaps)
    expect(revealed.i1).toEqual(['tea', 'coffee'])
    expect(gradeBookExercisePlacements(twoGaps, revealed).allCorrect).toBe(true)
    expect(remainingBookExerciseBank(twoGaps.wordBank, revealed)).toEqual(['milk'])
  })
})

describe('nearestBookExerciseGap', () => {
  const gaps = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 100, y: 0 },
  ]

  it('picks the closest gap within range', () => {
    expect(nearestBookExerciseGap({ x: 10, y: 0 }, gaps, 56)).toBe('a')
    expect(nearestBookExerciseGap({ x: 80, y: 0 }, gaps, 56)).toBe('b')
  })

  it('returns null when nothing is close enough', () => {
    expect(nearestBookExerciseGap({ x: 50, y: 80 }, gaps, 56)).toBeNull()
  })
})

describe('Gemini word-bank draft parse', () => {
  it('keeps bank, gaps, and extra unused words', () => {
    const parsed = parseBookExerciseGeminiDraft({
      wordBank: ['because', 'although', 'unless'],
      items: [{ stem: 'I stayed ___ it rained.', answers: ['Because'] }],
    })
    expect(parsed?.unusable).toBe(false)
    expect(parsed?.wordBank).toEqual(['because', 'although', 'unless'])
    expect(parsed?.items[0]?.answers).toEqual(['because'])
  })

  it('drops instruction-only rows with no gaps', () => {
    const parsed = parseBookExerciseGeminiDraft({
      wordBank: ['because'],
      items: [
        { stem: 'Complete the sentences.', answers: [] },
        { stem: 'I stayed ___ it rained.', answers: ['because'] },
      ],
    })
    expect(parsed?.unusable).toBe(false)
    expect(parsed?.items).toHaveLength(1)
  })

  it('flags a crop that is not a word-bank task', () => {
    expect(parseBookExerciseGeminiDraft({ wordBank: [], items: [], unusable: true })?.unusable).toBe(true)
    expect(parseBookExerciseGeminiDraft({ wordBank: ['because'], items: [] })?.unusable).toBe(true)
  })
})

describe('Gemini choose-answer draft parse', () => {
  it('keeps questions, choices, and correct index', () => {
    const parsed = parseBookExerciseMcqGeminiDraft({
      questions: [
        {
          prompt: 'Where do they live?',
          choices: ['In a city', 'On a farm', 'At school'],
          correctIndex: 1,
        },
      ],
    })
    expect(parsed?.unusable).toBe(false)
    expect(parsed?.questions).toHaveLength(1)
    expect(parsed?.questions[0]?.prompt).toBe('Where do they live?')
    expect(parsed?.questions[0]?.choices).toEqual(['In a city', 'On a farm', 'At school'])
    expect(parsed?.questions[0]?.correctIndex).toBe(1)
  })

  it('drops blank prompts', () => {
    const parsed = parseBookExerciseMcqGeminiDraft({
      questions: [
        { prompt: '  ', choices: ['A', 'B'], correctIndex: 0 },
        { prompt: 'Real question?', choices: ['Yes', 'No'], correctIndex: 0 },
      ],
    })
    expect(parsed?.unusable).toBe(false)
    expect(parsed?.questions).toHaveLength(1)
    expect(parsed?.questions[0]?.prompt).toBe('Real question?')
  })

  it('flags a crop that is not a choose-answer task', () => {
    expect(parseBookExerciseMcqGeminiDraft({ questions: [], unusable: true })?.unusable).toBe(true)
    expect(parseBookExerciseMcqGeminiDraft({ questions: [] })?.unusable).toBe(true)
  })
})

describe('expandPageNormRect', () => {
  it('pads a box without leaving the page', () => {
    const expanded = expandPageNormRect({ x: 0.1, y: 0.2, w: 0.4, h: 0.3 }, 0.05)
    expect(expanded.x).toBeCloseTo(0.05)
    expect(expanded.y).toBeCloseTo(0.15)
    expect(expanded.w).toBeCloseTo(0.5)
    expect(expanded.h).toBeCloseTo(0.4)
  })
})
