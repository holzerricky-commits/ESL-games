import { describe, expect, it } from 'vitest'
import {
  buildPresentationLevelBookShell,
  findPresentationLevelBook,
  normalizePresentationDifficultyLevel,
  presentationLevelBookId,
  titleFromPresentationDeckFileName,
} from '@/lib/books/presentation-levels'
import type { BookRecord } from '@/lib/books/types'

describe('presentation levels', () => {
  it('normalizes difficulty labels', () => {
    expect(normalizePresentationDifficultyLevel('starter')).toBe('Starter')
    expect(normalizePresentationDifficultyLevel('Hard')).toBe('Hard')
    expect(normalizePresentationDifficultyLevel('expert')).toBeNull()
  })

  it('builds stable book ids', () => {
    expect(presentationLevelBookId('Starter')).toBe('presentations-starter')
    expect(presentationLevelBookId('Intermediate')).toBe('presentations-intermediate')
  })

  it('cleans deck file titles', () => {
    expect(titleFromPresentationDeckFileName('01-Animals-slides.pdf')).toBe('01 Animals')
    expect(titleFromPresentationDeckFileName('Food.pptx.pdf')).toBe('Food')
  })

  it('finds level book by id or role', () => {
    const books: BookRecord[] = [
      {
        id: 'other',
        title: 'Other',
        contentFormat: 'presentation',
        role: 'Basic',
        series: 'Presentations',
        units: [],
      },
      buildPresentationLevelBookShell('Starter'),
    ]
    expect(findPresentationLevelBook(books, 'Starter')?.id).toBe('presentations-starter')
    expect(findPresentationLevelBook(books, 'Basic')?.id).toBe('other')
  })
})
