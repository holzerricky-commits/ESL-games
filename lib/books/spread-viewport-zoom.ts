/**
 * When CSS-scale resize mode is on, browser zoom (Ctrl +/-) changes devicePixelRatio.
 * Skip recomputing target spread width so native browser zoom magnifies the fixed render size.
 */
export function shouldSkipSpreadTargetWidthSync(
  prevDpr: number,
  nextDpr: number,
  resizeScaleEnabled: boolean,
): boolean {
  if (!resizeScaleEnabled) return false
  if (!Number.isFinite(prevDpr) || !Number.isFinite(nextDpr)) return false
  return prevDpr !== nextDpr
}
