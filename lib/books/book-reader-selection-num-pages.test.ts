import { describe, expect, it } from 'vitest'
import { nextNumPagesAfterSelectionChange } from './book-reader-selection-num-pages'
import { shouldApplyInitialReaderSelection } from './resolve-initial-book-reader-selection'

describe('nextNumPagesAfterSelectionChange', () => {
  it('keeps current numPages when no cache helper is provided', () => {
    expect(nextNumPagesAfterSelectionChange('unit-a')).toBe('keep')
  })

  it('keeps current numPages when the unit has no cached count', () => {
    expect(nextNumPagesAfterSelectionChange('unit-a', () => null)).toBe('keep')
    expect(nextNumPagesAfterSelectionChange('unit-a', () => undefined)).toBe('keep')
    expect(nextNumPagesAfterSelectionChange('unit-a', () => 0)).toBe('keep')
  })

  it('restores a positive cached page count for the next unit', () => {
    expect(nextNumPagesAfterSelectionChange('unit-b', (id) => (id === 'unit-b' ? 42 : null))).toBe(42)
  })

  it('treats blank unit ids as keep', () => {
    expect(nextNumPagesAfterSelectionChange(null, () => 12)).toBe('keep')
    expect(nextNumPagesAfterSelectionChange('  ', () => 12)).toBe('keep')
  })
})

describe('markSelectionApplied early-return contract', () => {
  it('skips reseed when lastApplied already matches the prefer selection', () => {
    const lastApplied = { bookId: 'book-a', unitId: 'unit-a' }
    expect(shouldApplyInitialReaderSelection(lastApplied, 'book-a', 'unit-a')).toBe(false)
    expect(shouldApplyInitialReaderSelection(lastApplied, 'book-b', 'unit-a')).toBe(true)
  })
})
