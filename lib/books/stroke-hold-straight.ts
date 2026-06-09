import { STROKE_POINT_MIN_DIST_SQ } from '@/lib/books/stroke-pointer-samples'

/** Pause duration (ms) with pointer down before stroke snaps to straight H/V. */
export const STROKE_HOLD_STRAIGHT_MS = 350

export type StrokeHoldStraightTracker = {
  holdStraightActive: boolean
  lastSample: [number, number] | null
  timerId: ReturnType<typeof setTimeout> | null
}

export function createStrokeHoldStraightTracker(): StrokeHoldStraightTracker {
  return { holdStraightActive: false, lastSample: null, timerId: null }
}

export function disposeStrokeHoldStraightTracker(tracker: StrokeHoldStraightTracker): void {
  if (tracker.timerId != null) {
    clearTimeout(tracker.timerId)
    tracker.timerId = null
  }
}

export function resetStrokeHoldStraightTracker(tracker: StrokeHoldStraightTracker): void {
  disposeStrokeHoldStraightTracker(tracker)
  tracker.holdStraightActive = false
  tracker.lastSample = null
}

function scheduleHoldStraightTimer(
  tracker: StrokeHoldStraightTracker,
  onActivated: () => void,
): void {
  disposeStrokeHoldStraightTracker(tracker)
  tracker.timerId = setTimeout(() => {
    tracker.timerId = null
    if (!tracker.lastSample) return
    tracker.holdStraightActive = true
    onActivated()
  }, STROKE_HOLD_STRAIGHT_MS)
}

function sampleMovedFrom(
  sample: [number, number],
  from: [number, number] | null,
  minDistSq = STROKE_POINT_MIN_DIST_SQ,
): boolean {
  if (!from) return true
  const dx = sample[0] - from[0]
  const dy = sample[1] - from[1]
  return dx * dx + dy * dy >= minDistSq
}

/**
 * Feed pointer-move samples during an active stroke.
 * After a pause with the pointer still down, returns true (like holding Shift).
 */
export function feedStrokeHoldStraightMove(
  tracker: StrokeHoldStraightTracker,
  samples: readonly [number, number][],
  anchor: [number, number] | undefined,
  onActivated: () => void,
): boolean {
  if (samples.length === 0) return tracker.holdStraightActive
  if (!anchor) return false

  const last = samples[samples.length - 1]!
  let movedFromLast = false
  for (const sample of samples) {
    if (sampleMovedFrom(sample, tracker.lastSample)) {
      movedFromLast = true
      break
    }
  }

  tracker.lastSample = last

  if (tracker.holdStraightActive) {
    return true
  }

  if (!movedFromLast) {
    return false
  }

  if (!sampleMovedFrom(last, anchor)) {
    disposeStrokeHoldStraightTracker(tracker)
    return false
  }

  scheduleHoldStraightTimer(tracker, onActivated)
  return false
}
