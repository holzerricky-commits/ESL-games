import { describe, expect, it } from 'vitest'
import {
  shouldResetSuppressNextPlacementOnDomToolEntry,
  suppressNextPlacementAfterCanvasClickAwayDismiss,
  suppressNextPlacementAfterOutsideDismiss,
} from './spread-dom-placement-suppress'

describe('suppressNextPlacementAfterOutsideDismiss', () => {
  it('does not suppress the next empty-spread tap after toolbar/outside dismiss', () => {
    expect(suppressNextPlacementAfterOutsideDismiss()).toBe(false)
  })
})

describe('suppressNextPlacementAfterCanvasClickAwayDismiss', () => {
  it('suppresses new label placement on the same tap that commits click-away', () => {
    expect(suppressNextPlacementAfterCanvasClickAwayDismiss()).toBe(true)
  })
})

describe('shouldResetSuppressNextPlacementOnDomToolEntry', () => {
  it('clears stale suppress when entering text or sticky tool', () => {
    expect(shouldResetSuppressNextPlacementOnDomToolEntry(true)).toBe(true)
  })

  it('does not reset while staying on the same dom tool', () => {
    expect(shouldResetSuppressNextPlacementOnDomToolEntry(false)).toBe(false)
  })
})
