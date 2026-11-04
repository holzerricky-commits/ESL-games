import { describe, expect, it } from 'vitest'
import {
  cardsForStory,
  defaultStoryPartId,
  showStoryScopeChips,
  storyScopes,
} from '@/lib/lesson-vault/story-scope'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'

function card(partial: Partial<LessonVaultCard> & Pick<LessonVaultCard, 'id' | 'partId' | 'partTitle'>): LessonVaultCard {
  return {
    bookId: 'b1',
    unitId: 'u1',
    lessonId: 'l1',
    lessonTitle: 'Lesson 1',
    word: partial.id,
    sentence: '',
    meaning: '',
    chinese: '',
    imageUrl: '',
    pictureSource: '',
    pictureChoices: [],
    pictureChoiceIndex: 0,
    autoPicture: '',
    reviewStatus: 'unchecked',
    pdfPage: 1,
    createdAt: '2026-10-31T00:00:00.000Z',
    updatedAt: '2026-10-31T00:00:00.000Z',
    ...partial,
  }
}

describe('storyScopes', () => {
  it('orders parts like the lesson, then extras', () => {
    const cards = [
      card({ id: 'a', partId: 'extra', partTitle: 'Workshop story' }),
      card({ id: 'b', partId: 'main', partTitle: 'Main story' }),
      card({ id: 'c', partId: 'paired', partTitle: 'Paired story' }),
      card({ id: 'd', partId: 'main', partTitle: 'Main story' }),
    ]
    expect(
      storyScopes(cards, [
        { id: 'vocab', title: 'Vocabulary' },
        { id: 'main', title: 'Main story' },
        { id: 'paired', title: 'Paired story' },
      ]),
    ).toEqual([
      { partId: 'main', label: 'Main story', count: 2 },
      { partId: 'paired', label: 'Paired story', count: 1 },
      { partId: 'extra', label: 'Workshop story', count: 1 },
    ])
  })

  it('skips cards with no part (All only)', () => {
    const cards = [
      card({ id: 'a', partId: '', partTitle: '' }),
      card({ id: 'b', partId: 'main', partTitle: 'Main story' }),
    ]
    expect(storyScopes(cards)).toEqual([{ partId: 'main', label: 'Main story', count: 1 }])
  })

  it('uses the card title when the lesson order has no title', () => {
    const cards = [card({ id: 'a', partId: 'main', partTitle: 'From the tide pool' })]
    expect(storyScopes(cards, [{ id: 'main', title: '' }])).toEqual([
      { partId: 'main', label: 'From the tide pool', count: 1 },
    ])
  })
})

describe('cardsForStory', () => {
  const cards = [
    card({ id: 'a', partId: 'main', partTitle: 'Main story' }),
    card({ id: 'b', partId: 'paired', partTitle: 'Paired story' }),
    card({ id: 'c', partId: '', partTitle: '' }),
  ]

  it('returns every card when partId is null', () => {
    expect(cardsForStory(cards, null)).toEqual(cards)
  })

  it('keeps only the matching part', () => {
    expect(cardsForStory(cards, 'paired').map((c) => c.id)).toEqual(['b'])
  })
})

describe('showStoryScopeChips', () => {
  it('hides when there is only one story with words', () => {
    expect(showStoryScopeChips([{ partId: 'main', label: 'Main', count: 3 }])).toBe(false)
    expect(
      showStoryScopeChips([
        { partId: 'main', label: 'Main', count: 1 },
        { partId: 'paired', label: 'Paired', count: 1 },
      ]),
    ).toBe(true)
  })
})

describe('defaultStoryPartId', () => {
  const scopes = [
    { partId: 'main', label: 'Main', count: 2 },
    { partId: 'paired', label: 'Paired', count: 1 },
  ]

  it('picks the page part when it has words', () => {
    expect(defaultStoryPartId(scopes, 'paired')).toBe('paired')
  })

  it('falls back to All when the page part has no words', () => {
    expect(defaultStoryPartId(scopes, 'vocab')).toBe(null)
    expect(defaultStoryPartId(scopes, null)).toBe(null)
  })
})
