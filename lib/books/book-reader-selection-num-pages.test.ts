import { describe, expect, it } from 'vitest'
import { nextNumPagesAfterSelectionChange } from './book-reader-selection-num-pages'
import {
  preferResumePageForResolvedUnit,
  shouldApplyInitialReaderSelection,
} from './resolve-initial-book-reader-selection'

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

describe('preferResumePageForResolvedUnit', () => {
  it('keeps an explicit page when the requested unit is the one that opens', () => {
    expect(
      preferResumePageForResolvedUnit({
        requestedUnitId: 'vol-2',
        resolvedUnitId: 'vol-2',
        preferResumePage: 12,
      }),
    ).toBe(12)
  })

  it('drops a resume page that belongs to a different unit than the saved place', () => {
    expect(
      preferResumePageForResolvedUnit({
        requestedUnitId: 'vol-1',
        resolvedUnitId: 'vol-2',
        preferResumePage: 40,
      }),
    ).toBeNull()
  })

  it('keeps the resume page when no unit was requested', () => {
    expect(
      preferResumePageForResolvedUnit({
        requestedUnitId: null,
        resolvedUnitId: 'vol-2',
        preferResumePage: 8.8,
      }),
    ).toBe(8)
  })
})

describe('markSelectionApplied early-return contract', () => {
  it('skips reseed when lastApplied already matches the prefer selection', () => {
    const lastApplied = { bookId: 'book-a', unitId: 'unit-a' }
    expect(shouldApplyInitialReaderSelection(lastApplied, 'book-a', 'unit-a')).toBe(false)
    expect(shouldApplyInitialReaderSelection(lastApplied, 'book-b', 'unit-a')).toBe(true)
  })
})
