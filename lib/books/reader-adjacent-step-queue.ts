/**
 * R1b / R4 — pure helpers for adjacent turn step queue (testable without React).
 */

/** Skip enqueue when already on target or duplicate tail (burst taps on same computed step). */
export function shouldSkipAdjacentStepEnqueue(args: {
  anchorPage: number
  queuedSteps: readonly number[]
  nextPage: number
}): boolean {
  const { anchorPage, queuedSteps, nextPage } = args
  if (nextPage === anchorPage) return true
  if (queuedSteps.length === 0) return false
  return queuedSteps[queuedSteps.length - 1] === nextPage
}

/** Identifies the book+unit a queued adjacent step was computed for. */
export function bookUnitTurnToken(
  bookId: string | null | undefined,
  unitId: string | null | undefined,
): string {
  return `${bookId?.trim() ?? ''}\u001f${unitId?.trim() ?? ''}`
}

/**
 * Adjacent steps are page indexes for one PDF. After a book or unit switch they must
 * not be applied: the drain would call setPageNumber on the book now on screen and
 * the next turn would store that page as its place.
 */
export function shouldDiscardAdjacentTurnQueue(scheduledToken: string, currentToken: string): boolean {
  return scheduledToken !== currentToken
}
