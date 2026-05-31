/** Pointer mapping and spread cluster width helpers for two-page spread ink. */

/**
 * Map pointer position to normalized [0,1]² on the spread overlay canvas.
 * Uses the canvas viewport rect (post-transform) — same as `BookPageAnnotationLayer.clientToNorm`.
 * Paint with layout `spreadOverlayWidthPx` / `spreadOverlayHeightPx` (not rect ÷ scale).
 */
export function clientToSpreadNorm(
  canvasRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  clientX: number,
  clientY: number,
): [number, number] {
  const w = canvasRect.width
  const h = canvasRect.height
  if (!(w > 0) || !(h > 0)) return [0, 0]
  const nx = (clientX - canvasRect.left) / w
  const ny = (clientY - canvasRect.top) / h
  return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))]
}

/**
 * Spread cluster width: two pages minus one gutter overlap (not two overlaps).
 * Keep in sync with `BookCanvasStage` spread cluster overlap (`spreadSidePullPx`).
 */
export function spreadClusterWidthPx(spreadPageWidthPx: number, spreadSidePullPx: number): number {
  return Math.max(0, Math.round(spreadPageWidthPx * 2 - spreadSidePullPx))
}
