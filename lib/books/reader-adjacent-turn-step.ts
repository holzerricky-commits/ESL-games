/**
 * R1b — one visible spread step per adjacent turn (not teleport on burst taps).
 */

/** Minimum ms between displayed adjacent steps when the queue is draining. 0 = one step per animation frame only. */
export const READER_ADJACENT_TURN_MIN_STEP_MS = 48

export function resolveAdjacentAnchorPage(args: {
  anchorPage: number
  direction: -1 | 1
  visiblePages: number[]
  isSinglePageMode: boolean
}): number | null {
  const { anchorPage, direction, visiblePages, isSinglePageMode } = args
  if (!visiblePages.length) return null
  const step = isSinglePageMode ? 1 : 2
  const currentIndex = Math.max(0, visiblePages.indexOf(anchorPage))
  const nextIndex = Math.max(
    0,
    Math.min(currentIndex + direction * step, visiblePages.length - 1),
  )
  const nextPage = visiblePages[nextIndex] ?? anchorPage
  return nextPage === anchorPage ? null : nextPage
}
