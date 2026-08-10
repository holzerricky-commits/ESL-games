import { describe, expect, it } from 'vitest'
import {
  readingStoryTextStatus,
  sanitizeReadingStoryTextRecord,
} from '@/lib/books/reading-story-text'

describe('reading-story-text', () => {
  it('sanitizes a pdf-sourced text record', () => {
    const record = sanitizeReadingStoryTextRecord({
      storyId: 'book::unit::lesson::part',
      bookId: 'book',
      unitId: 'unit',
      text: 'Once upon a time',
      source: 'pdf',
      startPdfPage: 18,
      endPdfPage: 32,
      startDisplayPage: 14,
      endDisplayPage: 28,
    })
    expect(record?.text).toBe('Once upon a time')
    expect(record?.source).toBe('pdf')
    expect(record?.startPdfPage).toBe(18)
  })

  it('keeps gemini as source', () => {
    const record = sanitizeReadingStoryTextRecord({
      storyId: 'book::unit::lesson::part',
      bookId: 'book',
      unitId: 'unit',
      text: 'Once upon a time',
      source: 'gemini',
      startPdfPage: 18,
      endPdfPage: 20,
      startDisplayPage: 14,
      endDisplayPage: 16,
    })
    expect(record?.source).toBe('gemini')
  })

  it('marks empty text as none and trimmed text as ready', () => {
    expect(readingStoryTextStatus('')).toBe('none')
    expect(readingStoryTextStatus('   ')).toBe('none')
    expect(readingStoryTextStatus('Hello')).toBe('ready')
  })
})
