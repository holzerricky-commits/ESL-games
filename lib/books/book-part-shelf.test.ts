import { describe, expect, it } from 'vitest'
import {
  buildBookPartShelfCards,
  findLessonInBook,
  formatPartListHeadline,
  formatPartPageRangeLabel,
  isStoryPartShelfTag,
  isVocabPartShelfTag,
} from '@/lib/books/book-part-shelf'
import type { BookRecord } from '@/lib/books/types'

describe('book-part-shelf', () => {
  const book: BookRecord = {
    id: 'b1',
    title: 'Book',
    units: [
      {
        id: 'u1',
        title: 'Unit 1',
        filePath: 'a.pdf',
        lessons: [
          {
            id: 'l1',
            title: 'Lesson 1',
            startPageHint: 10,
            parts: [
              {
                id: 'p1',
                title: 'Vocab',
                startPageHint: 10,
                structureTag: 'vocabulary_in_context',
              },
              {
                id: 'p2',
                title: 'Jump!',
                startPageHint: 18,
                structureTag: 'main_story',
              },
            ],
          },
        ],
      },
    ],
    pageAlignmentByFile: {
      'a.pdf': { notCountedPdfPages: [], hiddenPdfPages: [] },
    },
  }

  it('buildBookPartShelfCards lists parts in order with type labels', () => {
    const unit = book.units[0]!
    const lesson = unit.lessons![0]!
    const cards = buildBookPartShelfCards(unit, lesson, 0)
    expect(cards).toHaveLength(2)
    expect(cards[0]!.indexLabel).toBe('P1')
    expect(cards[0]!.typeLabel).toBe('Vocab · in context')
    expect(cards[0]!.structureTag).toBe('vocabulary_in_context')
    expect(cards[0]!.printedStart).toBe(10)
    expect(cards[1]!.printedStart).toBe(18)
    expect(cards[1]!.typeLabel).toBe('Main story')
    expect(cards[1]!.structureTag).toBe('main_story')
  })

  it('findLessonInBook resolves unit + lesson', () => {
    const found = findLessonInBook(book, 'u1', 'l1')
    expect(found?.lesson.title).toBe('Lesson 1')
    expect(found?.lessonIndex).toBe(0)
    expect(findLessonInBook(book, 'u1', 'missing')).toBeNull()
  })

  it('formatPartPageRangeLabel covers single, range, and missing', () => {
    expect(formatPartPageRangeLabel(10, 12)).toBe('pp. 10–12')
    expect(formatPartPageRangeLabel(18, 18)).toBe('p. 18')
    expect(formatPartPageRangeLabel(null, null)).toBe('Pages not set')
  })

  it('formatPartListHeadline drops repeated type text', () => {
    expect(formatPartListHeadline('Comprehension', 'Comprehension Strategy: Visualize')).toEqual({
      prefix: 'Comprehension',
      name: 'Strategy: Visualize',
    })
    expect(formatPartListHeadline('Main story', 'Shared Read Little Flap Learns to Fly')).toEqual({
      prefix: 'Main story',
      name: 'Shared Read Little Flap Learns to Fly',
    })
    expect(formatPartListHeadline('Vocab · in context', 'Vocabulary')).toEqual({
      prefix: null,
      name: 'Vocab · in context',
    })
    expect(formatPartListHeadline('Genre', 'Genre: Fantasy')).toEqual({
      prefix: 'Genre',
      name: 'Fantasy',
    })
    expect(formatPartListHeadline('Writing', 'Writing: Ideas')).toEqual({
      prefix: 'Writing',
      name: 'Ideas',
    })
  })

  it('isStoryPartShelfTag marks main and paired stories only', () => {
    expect(isStoryPartShelfTag('main_story')).toBe(true)
    expect(isStoryPartShelfTag('paired_story')).toBe(true)
    expect(isStoryPartShelfTag('comprehension')).toBe(false)
    expect(isStoryPartShelfTag('vocabulary_in_context')).toBe(false)
  })

  it('isVocabPartShelfTag marks in-context and background vocabulary only', () => {
    expect(isVocabPartShelfTag('vocabulary_in_context')).toBe(true)
    expect(isVocabPartShelfTag('vocabulary_background')).toBe(true)
    expect(isVocabPartShelfTag('vocabulary_strategy')).toBe(false)
    expect(isVocabPartShelfTag('main_story')).toBe(false)
    expect(isVocabPartShelfTag('comprehension')).toBe(false)
  })
})
