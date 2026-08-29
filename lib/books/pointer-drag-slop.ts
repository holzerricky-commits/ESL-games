/** Pixel slop: click vs a real drag of an existing label. */
export const LABEL_DRAG_COMMIT_PX = 2

/** True when a normalized delta is at least `minPx` on the page (not per-event). */
export function normDeltaMeetsDragCommit(
  dx: number,
  dy: number,
  widthPx: number,
  heightPx: number,
  minPx: number = LABEL_DRAG_COMMIT_PX,
): boolean {
  if (!(widthPx > 0) || !(heightPx > 0)) return dx !== 0 || dy !== 0
  return Math.hypot(dx * widthPx, dy * heightPx) >= minPx
}
