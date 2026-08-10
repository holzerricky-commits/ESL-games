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
 * When the anchor sits this close to the top edge, place the bar below the selection instead.
 * Roughly one toolbar height on a typical board viewport.
 */
export const SELECTION_CONTEXT_BAR_FLIP_BELOW_TOP_NORM = 0.08

/**
 * When the anchor sits this close to the bottom edge, prefer placing the bar above
 * (same as default) — used to avoid a below placement that would clip off-screen.
 */
export const SELECTION_CONTEXT_BAR_FLIP_ABOVE_BOTTOM_NORM = 0.92

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

export function resolveSelectionBarPlacement(anchorRect: NormRect): SelectionBarPlacement {
  const bottom = anchorRect.y + anchorRect.h
  if (bottom > SELECTION_CONTEXT_BAR_FLIP_ABOVE_BOTTOM_NORM) return 'above'
  return 'below'
}
