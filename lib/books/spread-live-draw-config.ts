/**
 * Phase 4 spread live draft (`docs/SPREAD_INK_PHASED_PLAN.md`).
 * Incremental segment-append is cheaper but can look jagged; full redraw each move is smoother.
 */
export const spreadLiveStrokeIncrementalPaintEnabled = false

/**
 * Whiteboard viewport ink: incremental live segments (short letters) over full redraw each move.
 */
export const whiteboardViewportLiveStrokeIncrementalPaintEnabled = true

/** Batch spread live repaints to one per animation frame while dragging. */
export const spreadLiveStrokeRafCoalesceEnabled = true
