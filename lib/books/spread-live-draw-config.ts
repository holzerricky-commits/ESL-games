/**
 * Phase 4 spread live draft (`docs/SPREAD_INK_PHASED_PLAN.md`).
 * Incremental segment-append is cheaper but can look jagged; full redraw each move is smoother.
 */
export const spreadLiveStrokeIncrementalPaintEnabled = false

/**
 * Whiteboard live ink: full redraw each move (same as spread) for smooth quadratic joins.
 * rAF coalesce keeps quick letters responsive.
 */
export const whiteboardViewportLiveStrokeIncrementalPaintEnabled = false

/** Batch spread live repaints to one per animation frame while dragging. */
export const spreadLiveStrokeRafCoalesceEnabled = true
