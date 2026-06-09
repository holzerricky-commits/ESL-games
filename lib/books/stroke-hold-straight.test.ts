import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STROKE_HOLD_STRAIGHT_MS,
  createStrokeHoldStraightTracker,
  feedStrokeHoldStraightMove,
  resetStrokeHoldStraightTracker,
} from '@/lib/books/stroke-hold-straight'

describe('stroke-hold-straight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not activate before moving away from the anchor', () => {
    const tracker = createStrokeHoldStraightTracker()
    const onActivated = vi.fn()
    const anchor: [number, number] = [0.1, 0.2]

    expect(
      feedStrokeHoldStraightMove(tracker, [[0.100001, 0.200001]], anchor, onActivated),
    ).toBe(false)

    vi.advanceTimersByTime(STROKE_HOLD_STRAIGHT_MS)
    expect(onActivated).not.toHaveBeenCalled()
    expect(tracker.holdStraightActive).toBe(false)
  })

  it('activates after a pause once the stroke has moved', () => {
    const tracker = createStrokeHoldStraightTracker()
    const onActivated = vi.fn()
    const anchor: [number, number] = [0.1, 0.2]

    feedStrokeHoldStraightMove(tracker, [[0.5, 0.25]], anchor, onActivated)
    vi.advanceTimersByTime(STROKE_HOLD_STRAIGHT_MS)

    expect(onActivated).toHaveBeenCalledTimes(1)
    expect(tracker.holdStraightActive).toBe(true)
    expect(
      feedStrokeHoldStraightMove(tracker, [[0.55, 0.3]], anchor, onActivated),
    ).toBe(true)
  })

  it('resets on pointer down', () => {
    const tracker = createStrokeHoldStraightTracker()
    const onActivated = vi.fn()
    const anchor: [number, number] = [0.1, 0.2]

    feedStrokeHoldStraightMove(tracker, [[0.5, 0.25]], anchor, onActivated)
    vi.advanceTimersByTime(STROKE_HOLD_STRAIGHT_MS)
    expect(tracker.holdStraightActive).toBe(true)

    resetStrokeHoldStraightTracker(tracker)
    expect(tracker.holdStraightActive).toBe(false)
    expect(tracker.lastSample).toBeNull()
  })
})
