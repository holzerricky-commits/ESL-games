import { describe, expect, it } from 'vitest'
import { shouldSkipSpreadTargetWidthSync } from '@/lib/books/spread-viewport-zoom'

describe('shouldSkipSpreadTargetWidthSync', () => {
  it('skips target width sync when DPR changes and resize scale mode is on', () => {
    expect(shouldSkipSpreadTargetWidthSync(1, 1.25, true)).toBe(true)
    expect(shouldSkipSpreadTargetWidthSync(2, 1.5, true)).toBe(true)
  })

  it('does not skip when DPR is stable (window drag resize)', () => {
    expect(shouldSkipSpreadTargetWidthSync(1, 1, true)).toBe(false)
    expect(shouldSkipSpreadTargetWidthSync(1.5, 1.5, true)).toBe(false)
  })

  it('does not skip when resize scale mode is off', () => {
    expect(shouldSkipSpreadTargetWidthSync(1, 1.25, false)).toBe(false)
  })

  it('does not skip on non-finite DPR', () => {
    expect(shouldSkipSpreadTargetWidthSync(Number.NaN, 1.25, true)).toBe(false)
    expect(shouldSkipSpreadTargetWidthSync(1, Number.NaN, true)).toBe(false)
  })
})
