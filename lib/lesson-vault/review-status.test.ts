import { describe, expect, it } from 'vitest'
import {
  cycleReviewStatus,
  nextReviewStatus,
  proposeReviewStatuses,
  recommendedReviewRound,
  REVIEW_ROUND_CAP,
} from './review-status'
import { applyLessonVaultReviewStatuses, normalizeLessonVaultDiskPayload, upsertLessonVaultCard, type LessonVaultCard, type LessonVaultSaveInput } from './types'

const base: LessonVaultSaveInput = {
  bookId: 'b1',
  unitId: 'u1',
  lessonId: 'l1',
  lessonTitle: 'Turtles',
  partId: 'p2',
  partTitle: 'Main story',
  word: 'seastar',
  sentence: 'The seastar lives in the tide pool.',
  pdfPage: 12,
}

function card(id: string, word: string, extra: Partial<LessonVaultCard> = {}): LessonVaultCard {
  return {
    id,
    bookId: 'b',
    unitId: 'u',
    lessonId: 'l',
    lessonTitle: 'L',
    partId: '',
    partTitle: '',
    word,
    sentence: `The ${word} is here.`,
    meaning: '',
    chinese: '',
    imageUrl: '/p.png',
    pictureSource: 'auto',
    pictureChoices: [],
    pictureChoiceIndex: 0,
    autoPicture: 'found',
    reviewStatus: 'unchecked',
    pdfPage: 1,
    createdAt: '',
    updatedAt: '',
    ...extra,
  }
}

describe('review status', () => {
  it('treats a saved card with no label as not checked', () => {
    const payload = normalizeLessonVaultDiskPayload({
      byStudent: { s1: [{ id: 'a', word: 'shell', bookId: 'b', unitId: 'u', lessonId: 'l' }] },
    })
    expect(payload.byStudent.s1![0]!.reviewStatus).toBe('unchecked')
  })

  it('keeps a mastered label when the same word is saved again', () => {
    const first = upsertLessonVaultCard([], base, { now: 't0', createId: () => 'id-1' })
    const marked = applyLessonVaultReviewStatuses(first.cards, [{ cardId: 'id-1', status: 'mastered' }], 't1')
    const again = upsertLessonVaultCard(marked.cards, base, { now: 't2', createId: () => 'id-2' })
    expect(again.cards[0]!.reviewStatus).toBe('mastered')
  })

  it('moves a first-try hit up one step and sends a miss to practising', () => {
    expect(nextReviewStatus('unchecked', 'hit')).toBe('practising')
    expect(nextReviewStatus('practising', 'hit')).toBe('learned')
    expect(nextReviewStatus('learned', 'hit')).toBe('learned')
    expect(nextReviewStatus('mastered', 'hit')).toBe('mastered')
    expect(nextReviewStatus('mastered', 'miss')).toBe('practising')
    expect(nextReviewStatus('learned', 'miss')).toBe('practising')
    expect(nextReviewStatus('unchecked', 'miss')).toBe('practising')
  })

  it('proposes labels only for words that were in the round', () => {
    const cards = [card('a', 'apple'), card('b', 'boat', { reviewStatus: 'practising' })]
    const proposed = proposeReviewStatuses(cards, [
      { cardId: 'a', result: 'hit' },
      { cardId: 'b', result: 'hit' },
      { cardId: 'missing', result: 'miss' },
    ])
    expect(proposed).toEqual([
      { cardId: 'a', result: 'hit', status: 'practising' },
      { cardId: 'b', result: 'hit', status: 'learned' },
    ])
  })

  it('writes the labels the teacher kept and leaves the other words alone', () => {
    const cards = [card('a', 'apple'), card('b', 'boat', { reviewStatus: 'practising' })]
    const saved = applyLessonVaultReviewStatuses(cards, [{ cardId: 'a', status: 'mastered' }], 'now')
    expect(saved.updated).toBe(1)
    expect(saved.cards[0]!.reviewStatus).toBe('mastered')
    expect(saved.cards[1]!.reviewStatus).toBe('practising')
    expect(applyLessonVaultReviewStatuses(cards, [], 'now').updated).toBe(0)
  })

  it('checks unchecked words with pictures first, eight at a time', () => {
    const cards = Array.from({ length: 10 }, (_, i) => card(`c${i}`, `word${i}`))
    const round = recommendedReviewRound(cards)
    expect(round.mode).toBe('check')
    if (round.mode !== 'check') return
    expect(round.kind).toBe('picture-word')
    expect(round.cardIds).toHaveLength(REVIEW_ROUND_CAP)
    expect(round.title).toBe('Check 8 words')
  })

  it('uses fill the gap when the new words have sentences and no pictures', () => {
    const cards = ['shell', 'tide', 'pool'].map((word, i) =>
      card(`c${i}`, word, { imageUrl: '', pictureSource: '', autoPicture: '' }),
    )
    const round = recommendedReviewRound(cards)
    expect(round).toMatchObject({ mode: 'check', kind: 'fill-gap', title: 'Check 3 words' })
  })

  it('practises the shaky words once every new word has been checked', () => {
    const cards = ['shell', 'tide', 'pool'].map((word, i) =>
      card(`c${i}`, word, { imageUrl: '', pictureSource: '', autoPicture: '', reviewStatus: 'practising' }),
    )
    const round = recommendedReviewRound(cards)
    expect(round).toMatchObject({ mode: 'practice', kind: 'fill-gap', title: 'Practice 3 words' })
  })

  it('cycles practising → learned → mastered on the save list', () => {
    expect(cycleReviewStatus('practising')).toBe('learned')
    expect(cycleReviewStatus('learned')).toBe('mastered')
    expect(cycleReviewStatus('mastered')).toBe('practising')
    expect(cycleReviewStatus('unchecked')).toBe('practising')
  })

  it('stops offering a round when every word is learned or mastered', () => {
    const cards = [
      card('a', 'shell', { reviewStatus: 'mastered' }),
      card('b', 'tide', { reviewStatus: 'learned' }),
      card('c', 'pool', { reviewStatus: 'mastered' }),
    ]
    expect(recommendedReviewRound(cards)).toEqual({ mode: 'done', mastered: 3 })
  })

  it('stops offering a round when every word is mastered', () => {
    const cards = ['shell', 'tide', 'pool'].map((word, i) => card(`c${i}`, word, { reviewStatus: 'mastered' }))
    expect(recommendedReviewRound(cards)).toEqual({ mode: 'done', mastered: 3 })
  })

  it('explains when the lesson cannot run a check yet', () => {
    const cards = [card('a', 'apple'), card('b', 'boat')]
    expect(recommendedReviewRound(cards)).toEqual({ mode: 'blocked', reason: 'Save 1 more word to play' })
  })
})
