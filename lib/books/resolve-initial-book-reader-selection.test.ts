import { describe, expect, it } from 'vitest'
import { shouldApplyInitialReaderSelection } from '@/lib/books/resolve-initial-book-reader-selection'

describe('shouldApplyInitialReaderSelection', () => {
  it('applies on first load', () => {
    expect(shouldApplyInitialReaderSelection(null, 'book-1', 'unit-1')).toBe(true)
  })

  it('applies when book or unit changes', () => {
    const prev = { bookId: 'book-1', unitId: 'unit-1' }
    expect(shouldApplyInitialReaderSelection(prev, 'book-2', 'unit-1')).toBe(true)
    expect(shouldApplyInitialReaderSelection(prev, 'book-1', 'unit-2')).toBe(true)
  })

  it('does not reseed the live page when book and unit are unchanged', () => {
    const prev = { bookId: 'book-1', unitId: 'unit-1' }
    expect(shouldApplyInitialReaderSelection(prev, 'book-1', 'unit-1')).toBe(false)
  })
})
