import { describe, expect, it } from 'vitest'
import {
  bookUnitTurnToken,
  shouldDiscardAdjacentTurnQueue,
  shouldSkipAdjacentStepEnqueue,
} from '@/lib/books/reader-adjacent-step-queue'

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

describe('shouldDiscardAdjacentTurnQueue', () => {
  it('keeps steps while the same book and unit are on screen', () => {
    const token = bookUnitTurnToken('anthology', 'unit-2')
    expect(shouldDiscardAdjacentTurnQueue(token, token)).toBe(false)
  })

  it('drops steps when the class switches to another book', () => {
    expect(
      shouldDiscardAdjacentTurnQueue(
        bookUnitTurnToken('anthology', 'unit-2'),
        bookUnitTurnToken('workshop', 'unit-1'),
      ),
    ).toBe(true)
  })

  it('drops steps when the class switches to another unit of the same book', () => {
    expect(
      shouldDiscardAdjacentTurnQueue(
        bookUnitTurnToken('anthology', 'unit-2'),
        bookUnitTurnToken('anthology', 'unit-3'),
      ),
    ).toBe(true)
  })
})
