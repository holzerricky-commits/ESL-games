import type { NormRect } from '@/lib/books/annotation-select'

export type SelectionBarPlacement = 'above' | 'below'

/** Normalized gap between selection bounds and the context bar. */
export const SELECTION_CONTEXT_BAR_GAP_NORM = 0.012

/**
 * Keep the bar center inset from the left/right edges so wide floaters stay on-screen.
 * Roughly half a max-width bar on a typical viewport.
 */
export const SELECTION_CONTEXT_BAR_HORIZONTAL_INSET_NORM = 0.075

/**
 * Reserve space on the right for the annotation dock (toolbox + properties wing).
 * Roughly 14% of viewport width on typical layouts.
 */
export const SELECTION_CONTEXT_BAR_RIGHT_DOCK_INSET_NORM = 0.14

/** Default half-width estimate when the bar width is not yet measured. */
export const SELECTION_CONTEXT_BAR_DEFAULT_HALF_WIDTH_NORM = 0.12

/**
 * When the selection top sits this close to the top edge, place the bar below instead.
 * Roughly one toolbar height on a typical board viewport — keeps the floater clear of
 * top chrome and leaves the caret / text growth path unobstructed in the common case.
 */
export const SELECTION_CONTEXT_BAR_FLIP_BELOW_TOP_NORM = 0.08

export function clampSelectionBarCenterX(
  centerNorm: number,
  options?: {
    barHalfWidthNorm?: number
    rightDockInsetNorm?: number
  },
): number {
  const inset = SELECTION_CONTEXT_BAR_HORIZONTAL_INSET_NORM
  const barHalf = options?.barHalfWidthNorm ?? SELECTION_CONTEXT_BAR_DEFAULT_HALF_WIDTH_NORM
  const rightDock = options?.rightDockInsetNorm ?? SELECTION_CONTEXT_BAR_RIGHT_DOCK_INSET_NORM

  const minCenter = inset + barHalf
  const maxCenter = Math.min(1 - inset - barHalf, 1 - rightDock - barHalf)

  if (maxCenter < minCenter) {
    return (minCenter + maxCenter) / 2
  }

  return Math.max(minCenter, Math.min(maxCenter, centerNorm))
}

/** Prefer above the selection; flip below only when there is not enough room at the top. */
export function resolveSelectionBarPlacement(anchorRect: NormRect): SelectionBarPlacement {
  if (anchorRect.y < SELECTION_CONTEXT_BAR_FLIP_BELOW_TOP_NORM) return 'below'
  return 'above'
}
