/**
 * Phase 3 — single “ready to show” contract for fullscreen book open.
 *
 * Layout must be measured, then either active spread slots reported drawable pixels
 * (cache bitmap painted or pdf composited) or — after present — both spread pages
 * are already in PageRenderCache at the layout width bucket.
 *
 * @see `docs/FULLSCREEN_BOOK_STABLE_PAGES_PLAN.md` — Phase 3
 */

export type SpreadDrawableReadyInput = {
  /** Page area measured and render width > 0. */
  spreadLayoutStable: boolean
  /** Controller received onSpreadSlotsPixelsReady for the current anchor. */
  spreadSlotsPixelsReady: boolean
  /** Map / overlay presented — cache fast-path allowed. */
  userPresented: boolean
  /** Prefetched bitmaps for left (+ right if two-up) at layout width. */
  spreadCachePrimed: boolean
  /** Terminal skip (closed overlay, missing unit, load error handled elsewhere). */
  bypassGate?: boolean
  /** Max-wait fallback so UI never blocks forever. */
  spreadDrawableTimedOut?: boolean
  /** Phase 5 — keep showing scaled pixels while the render bucket catches up. */
  spreadResizeScaleHold?: boolean
}

export function isSpreadDrawableReady(input: SpreadDrawableReadyInput): boolean {
  if (input.bypassGate || input.spreadDrawableTimedOut) return true
  if (!input.spreadLayoutStable) return false
  if (input.spreadResizeScaleHold && input.spreadSlotsPixelsReady) return true
  if (input.spreadSlotsPixelsReady) return true
  if (input.userPresented && input.spreadCachePrimed) return true
  return false
}

/** Viewport spinner while presented but spread is not yet drawable (includes library/PDF load). */
export function shouldShowSpreadLoadingHold(args: {
  userPresented: boolean
  open: boolean
  overlayVisible: boolean
  readerPresentationReady: boolean
  hasCurriculumOrHistory: boolean
  hasResolvedUnit: boolean
  error: string | null
  spreadDrawableReady: boolean
  /** R3.4 — after first drawable spread, routine turns must not show full-viewport hold. */
  spreadHasBeenDrawable?: boolean
}): boolean {
  if (args.spreadHasBeenDrawable) return false
  if (!args.userPresented || !args.open || !args.overlayVisible) return false
  if (args.error) return false
  if (args.spreadDrawableReady) return false
  return true
}
