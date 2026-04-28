import { describe, expect, it } from 'vitest'
import { formatLessonTitleWithNumber } from '@/lib/books/lesson-title'

describe('formatLessonTitleWithNumber', () => {
  it('prefixes a bare TOC title with Lesson N:', () => {
    expect(formatLessonTitleWithNumber(1, 'Greetings')).toBe('Lesson 1: Greetings')
    expect(formatLessonTitleWithNumber(2, 'Grammar focus')).toBe('Lesson 2: Grammar focus')
  })

  it('leaves titles that already start with Lesson + number unchanged', () => {
    expect(formatLessonTitleWithNumber(3, 'Lesson 3: Review')).toBe('Lesson 3: Review')
    expect(formatLessonTitleWithNumber(1, 'lesson 1 intro')).toBe('lesson 1 intro')
  })

  it('uses Lesson n when the source title is empty', () => {
    expect(formatLessonTitleWithNumber(4, '')).toBe('Lesson 4')
    expect(formatLessonTitleWithNumber(4, '   ')).toBe('Lesson 4')
  })
})
