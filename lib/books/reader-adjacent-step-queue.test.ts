import { describe, expect, it } from 'vitest'
import { shouldSkipAdjacentStepEnqueue } from '@/lib/books/reader-adjacent-step-queue'

describe('shouldSkipAdjacentStepEnqueue', () => {
  it('skips when next equals anchor', () => {
    expect(
      shouldSkipAdjacentStepEnqueue({ anchorPage: 4, queuedSteps: [], nextPage: 4 }),
    ).toBe(true)
  })

  it('allows enqueue when queue empty and next differs', () => {
    expect(
      shouldSkipAdjacentStepEnqueue({ anchorPage: 4, queuedSteps: [], nextPage: 6 }),
    ).toBe(false)
  })

  it('skips duplicate tail target', () => {
    expect(
      shouldSkipAdjacentStepEnqueue({
        anchorPage: 8,
        queuedSteps: [6],
        nextPage: 6,
      }),
    ).toBe(true)
  })

  it('allows new tail when target differs from last queued', () => {
    expect(
      shouldSkipAdjacentStepEnqueue({
        anchorPage: 4,
        queuedSteps: [6],
        nextPage: 8,
      }),
    ).toBe(false)
  })
})
