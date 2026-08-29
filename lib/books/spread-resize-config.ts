import { readerPrefetchWidthBucket } from '@/lib/books/reader-page-prefetch-queue'

/** Treat scale as 1 when the difference is this small (avoids jitter). */
export const SPREAD_RESIZE_SCALE_EPSILON = 0.015

/** Side list slide and book scale share this one move. */
export const SPREAD_WORKSPACE_FIT_MOTION_MS = 240
export const SPREAD_WORKSPACE_FIT_MOTION_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Wait after the last size change before rebuilding a sharper PDF.
 * Must finish after the workspace fit move so we never rebuild mid-animation.
 */
export const SPREAD_RESIZE_COMMIT_IDLE_MS = SPREAD_WORKSPACE_FIT_MOTION_MS + 40

/** Reading-area size after the desk’s left edge jumps by a known panel width. */
export function pageAreaSizeAfterDeskLeftShift(
  current: { w: number; h: number },
  prevDeskLeftPx: number,
  nextDeskLeftPx: number,
): { w: number; h: number } {
  const delta = nextDeskLeftPx - prevDeskLeftPx
  return {
    w: Math.max(1, Math.round(current.w - delta)),
    h: Math.max(1, current.h),
  }
}

export function spreadResizeScaleIsActive(scale: number): boolean {
  if (!Number.isFinite(scale) || scale <= 0) return false
  return Math.abs(scale - 1) > SPREAD_RESIZE_SCALE_EPSILON
}

/** Ignore leftover 1–2% size ticks after a list move; still apply a real window resize. */
export const SPREAD_TARGET_WIDTH_CORRECTION_RATIO = 0.02
const SPREAD_TARGET_WIDTH_CORRECTION_PX = 8

export function shouldIgnoreSpreadTargetWidthCorrection(
  currentPx: number,
  nextPx: number,
): boolean {
  if (!(currentPx > 0) || !(nextPx > 0)) return false
  const delta = Math.abs(nextPx - currentPx)
  if (delta < SPREAD_TARGET_WIDTH_CORRECTION_PX) return true
  return delta / currentPx <= SPREAD_TARGET_WIDTH_CORRECTION_RATIO
}

/**
 * Rebuild PDF pixels only when the book needs to get sharper (grew).
 * Shrinking keeps the current picture and CSS-scales it down.
 */
export function shouldCommitSpreadRenderWidth(committedPx: number, targetPx: number): boolean {
  if (!(targetPx > 0)) return false
  if (!(committedPx > 0)) return true
  if (targetPx <= committedPx * (1 + SPREAD_RESIZE_SCALE_EPSILON)) return false
  return readerPrefetchWidthBucket(targetPx) > readerPrefetchWidthBucket(committedPx)
}

/** Layout key that should rebuild PDF size immediately (not a live shrink). */
export function spreadRenderLayoutBaseKey(
  bookId: string | null,
  unitId: string | null,
  includeBookFrame: boolean,
  pageAspectRatio: number,
): string {
  const aspect =
    Number.isFinite(pageAspectRatio) && pageAspectRatio > 0 ? pageAspectRatio.toFixed(4) : '0'
  return `${bookId ?? ''}|${unitId ?? ''}|${includeBookFrame ? 'frame' : 'bare'}|${aspect}`
}
