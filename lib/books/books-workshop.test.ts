import { describe, expect, it } from 'vitest'
import {
  formatWorkshopPlaceLine,
  workshopManualVocabPartId,
  workshopPlaceSegments,
  WORKSHOP_MANUAL_VOCAB_LESSON_ID,
} from '@/lib/books/books-workshop'

describe('workshopPlaceSegments', () => {
  it('splits ancestors, current part, and type chip', () => {
    expect(
      workshopPlaceSegments({
        bookTitle: 'Journeys',
        unitTitle: 'Unit 3',
        lessonTitle: 'Lesson 11',
        partTitle: 'Jump!',
        typeLabel: 'Main story',
        pageRangeLabel: 'p. 12–24',
      }),
    ).toEqual({
      ancestors: ['Journeys', 'Unit 3', 'Lesson 11'],
      current: 'Jump!',
      typeChip: 'Main story',
    })
  })

  it('skips unit when it matches the book title', () => {
    expect(
      workshopPlaceSegments({
        bookTitle: 'Workshop',
        unitTitle: 'Workshop',
        partTitle: 'Shared Read',
      }),
    ).toEqual({
      ancestors: ['Workshop'],
      current: 'Shared Read',
      typeChip: null,
    })
  })

  it('skips type chip when it matches the part title', () => {
    expect(
      workshopPlaceSegments({
        bookTitle: 'Journeys',
        partTitle: 'Main story',
        typeLabel: 'Main story',
      }),
    ).toEqual({
      ancestors: ['Journeys'],
      current: 'Main story',
      typeChip: null,
    })
  })

  it('uses book as current when there is no part', () => {
    expect(
      workshopPlaceSegments({
        bookTitle: 'Journeys',
        unitTitle: 'Unit 3',
      }),
    ).toEqual({
      ancestors: [],
      current: 'Journeys',
      typeChip: null,
    })
  })

  it('shows Unmarked chip when kind is unmarked and there is no type', () => {
    expect(
      workshopPlaceSegments(
        {
          bookTitle: 'Journeys',
        },
        'unmarked',
      ),
    ).toEqual({
      ancestors: [],
      current: 'Journeys',
      typeChip: 'Unmarked',
    })
  })

  it('shows Exercise and Vocab chips from kind', () => {
    expect(
      workshopPlaceSegments({ bookTitle: 'Journeys' }, 'exercise'),
    ).toEqual({
      ancestors: [],
      current: 'Journeys',
      typeChip: 'Exercise',
    })
    expect(workshopPlaceSegments({ bookTitle: 'Journeys' }, 'vocab')).toEqual({
      ancestors: [],
      current: 'Journeys',
      typeChip: 'Vocab',
    })
  })

  it('falls back to Book when empty', () => {
    expect(workshopPlaceSegments({})).toEqual({
      ancestors: [],
      current: 'Book',
      typeChip: null,
    })
  })
})

describe('formatWorkshopPlaceLine', () => {
  it('joins segments without pages', () => {
    expect(
      formatWorkshopPlaceLine({
        bookTitle: 'Journeys',
        unitTitle: 'Unit 3',
        lessonTitle: 'Lesson 11',
        partTitle: 'Jump!',
        typeLabel: 'Main story',
        pageRangeLabel: 'p. 12–24',
      }),
    ).toBe('Journeys · Unit 3 · Lesson 11 · Jump! · Main story')
  })

  it('skips unit when it matches the book title', () => {
    expect(
      formatWorkshopPlaceLine({
        bookTitle: 'Workshop',
        unitTitle: 'Workshop',
        partTitle: 'Shared Read',
      }),
    ).toBe('Workshop · Shared Read')
  })

  it('skips type when it matches the part title', () => {
    expect(
      formatWorkshopPlaceLine({
        bookTitle: 'Journeys',
        partTitle: 'Main story',
        typeLabel: 'Main story',
      }),
    ).toBe('Journeys · Main story')
  })

  it('falls back to Book when empty', () => {
    expect(formatWorkshopPlaceLine({})).toBe('Book')
  })
})

describe('workshop manual vocab ids', () => {
  it('uses a stable synthetic lesson bucket', () => {
    expect(WORKSHOP_MANUAL_VOCAB_LESSON_ID).toBe('__workshop_vocab__')
    expect(workshopManualVocabPartId('abc')).toBe('vocab-abc')
  })
})
