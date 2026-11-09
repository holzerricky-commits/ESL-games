import { describe, expect, it } from 'vitest'
import { seedVaultCardsFromInteractiveVocab } from '@/lib/lesson-vault/seed-from-interactive-vocab'
import { upsertLessonVaultCard } from '@/lib/lesson-vault/types'

const ref = {
  bookId: 'b1',
  unitId: 'u1',
  lessonId: 'l1',
  lessonTitle: 'Lesson 1',
}

function opts(id = 'id-1') {
  return { now: 't0', createId: () => id }
}

describe('seedVaultCardsFromInteractiveVocab', () => {
  it('adds missing vocab words with meaning and first example as sentence', () => {
    const result = seedVaultCardsFromInteractiveVocab(
      [],
      {
        ...ref,
        parts: [
          {
            partId: 'vocab',
            partTitle: 'Vocabulary',
            pdfPage: 10,
            words: [
              {
                id: 'w1',
                word: 'soar',
                definition: 'to fly high',
                examples: ['Eagles soar above the valley.'],
              },
            ],
          },
        ],
      },
      opts(),
    )
    expect(result.added).toHaveLength(1)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]!.word).toBe('soar')
    expect(result.cards[0]!.meaning).toBe('to fly high')
    expect(result.cards[0]!.sentence).toBe('Eagles soar above the valley.')
    expect(result.cards[0]!.partId).toBe('vocab')
    expect(result.cards[0]!.pdfPage).toBe(10)
  })

  it('does not overwrite an existing card meaning or sentence', () => {
    const existing = upsertLessonVaultCard(
      [],
      { ...ref, partId: 'vocab', partTitle: 'Vocabulary', word: 'soar', sentence: 'We soar.', pdfPage: 3 },
      opts('keep'),
    )
    const withMeaning = {
      ...existing.cards[0]!,
      meaning: 'teacher meaning',
    }
    const result = seedVaultCardsFromInteractiveVocab(
      [withMeaning],
      {
        ...ref,
        parts: [
          {
            partId: 'vocab',
            partTitle: 'Vocabulary',
            pdfPage: 10,
            words: [
              {
                id: 'w1',
                word: 'soar',
                definition: 'book definition',
                examples: ['Eagles soar above the valley.'],
              },
            ],
          },
        ],
      },
      opts('new'),
    )
    expect(result.added).toHaveLength(0)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]!.id).toBe('keep')
    expect(result.cards[0]!.meaning).toBe('teacher meaning')
    expect(result.cards[0]!.sentence).toBe('We soar.')
  })

  it('fills empty meaning on an existing card without adding a duplicate', () => {
    const existing = upsertLessonVaultCard(
      [],
      { ...ref, partId: 'story', partTitle: 'Story', word: 'ambition', sentence: '', pdfPage: 2 },
      opts('amb'),
    )
    const result = seedVaultCardsFromInteractiveVocab(
      existing.cards,
      {
        ...ref,
        parts: [
          {
            partId: 'vocab',
            partTitle: 'Vocabulary',
            pdfPage: 10,
            words: [{ id: 'w2', word: 'ambition', definition: 'a strong wish to succeed', examples: [] }],
          },
        ],
      },
      opts('dup'),
    )
    expect(result.added).toHaveLength(0)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]!.meaning).toBe('a strong wish to succeed')
    expect(result.cards[0]!.partId).toBe('vocab')
  })

  it('fills an empty meaning without replacing the saved sentence or moving the card', () => {
    const existing = upsertLessonVaultCard(
      [],
      {
        ...ref,
        partId: 'story',
        partTitle: 'Story',
        word: 'feather',
        sentence: 'The feather floated down.',
        pdfPage: 8,
      },
      opts('feather'),
    )
    const result = seedVaultCardsFromInteractiveVocab(
      existing.cards,
      {
        ...ref,
        parts: [
          {
            partId: 'vocab',
            partTitle: 'Vocabulary',
            pdfPage: 10,
            words: [
              {
                id: 'w3',
                word: 'feather',
                definition: 'a light growth that covers a bird',
                examples: ['Birds have feathers.'],
              },
            ],
          },
        ],
      },
      opts('dup'),
    )
    expect(result.added).toHaveLength(0)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]!.id).toBe('feather')
    expect(result.cards[0]!.sentence).toBe('The feather floated down.')
    expect(result.cards[0]!.meaning).toBe('a light growth that covers a bird')
    expect(result.cards[0]!.partId).toBe('story')
    expect(result.cards[0]!.pdfPage).toBe(8)
  })

  it('prefers tapSpot pdf page when present', () => {
    const result = seedVaultCardsFromInteractiveVocab(
      [],
      {
        ...ref,
        parts: [
          {
            partId: 'vocab',
            partTitle: 'Vocabulary',
            pdfPage: 10,
            words: [
              {
                id: 'w1',
                word: 'peer',
                definition: 'to look closely',
                examples: [],
                tapSpot: { pdfPage: 12, x: 0.1, y: 0.2, w: 0.1, h: 0.05 },
              },
            ],
          },
        ],
      },
      opts(),
    )
    expect(result.cards[0]!.pdfPage).toBe(12)
  })
})
