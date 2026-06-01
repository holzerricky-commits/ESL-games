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
