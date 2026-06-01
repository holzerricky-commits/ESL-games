import { spreadClusterWidthPx } from '@/lib/books/spread-canvas-coords'
import { spreadSidePullPx } from '@/lib/books/spread-gutter'

const VIEWPORT_HEIGHT_SAFE_RATIO = 0.996
const VIEWPORT_WIDTH_SAFE_RATIO = 0.996

export interface SpreadClusterMetrics {
  spreadPageWidth: number
  pageCanvasHeightPx: number
  gutterPullPx: number
  spreadOverlayWidthPx: number
}

/**
 * Per-page width for a two-up spread inside a viewport (matches `useBookViewportLayout`).
 */
export function computeSpreadPageWidth(
  viewportW: number,
  viewportH: number,
  pageAspectRatio: number,
  minWidth = 1,
): number {
  if (!(viewportW > 0) || !(viewportH > 0)) return Math.max(minWidth, 1)
  const safeHeight = viewportH * VIEWPORT_HEIGHT_SAFE_RATIO
  const aspect = Number.isFinite(pageAspectRatio) && pageAspectRatio > 0 ? pageAspectRatio : 1
  const widthFitSpread = (viewportW * VIEWPORT_WIDTH_SAFE_RATIO) / 2
  const heightFitSpread = safeHeight * aspect
  const finalSpreadWidth = Math.min(widthFitSpread, heightFitSpread)
  return Math.floor(Math.max(minWidth, finalSpreadWidth))
}

export function computeSinglePageWidth(
  viewportW: number,
  viewportH: number,
  pageAspectRatio: number,
  minWidth = 420,
): number {
  if (!(viewportW > 0) || !(viewportH > 0)) return Math.max(minWidth, 1)
  const safeHeight = viewportH * VIEWPORT_HEIGHT_SAFE_RATIO
  const aspect = Number.isFinite(pageAspectRatio) && pageAspectRatio > 0 ? pageAspectRatio : 1
  const widthFitSingle = viewportW * VIEWPORT_WIDTH_SAFE_RATIO
  const heightFitSingle = safeHeight * aspect
  const finalSingleWidth = Math.min(widthFitSingle, heightFitSingle)
  return Math.floor(Math.max(minWidth, finalSingleWidth))
}

export function computePageCanvasHeightPx(spreadPageWidth: number, pageAspectRatio: number): number {
  if (!(spreadPageWidth > 0)) return 1
  const aspect = Number.isFinite(pageAspectRatio) && pageAspectRatio > 0 ? pageAspectRatio : 1
  return Math.max(1, Math.round(spreadPageWidth / aspect))
}

export function computeSpreadClusterMetrics(
  spreadPageWidth: number,
  pageAspectRatio: number,
  pullRatio: number,
): SpreadClusterMetrics {
  const pageCanvasHeightPx = computePageCanvasHeightPx(spreadPageWidth, pageAspectRatio)
  const gutterPullPx = spreadSidePullPx(spreadPageWidth, pullRatio)
  const spreadOverlayWidthPx = Math.max(0, Math.round(spreadClusterWidthPx(spreadPageWidth, gutterPullPx)))
  return {
    spreadPageWidth,
    pageCanvasHeightPx,
    gutterPullPx,
    spreadOverlayWidthPx,
  }
}

/**
 * Scale factor to fit spread cluster inside a container (uniform, never upscale above 1).
 */
export function computeSpreadFitScale(
  containerW: number,
  containerH: number,
  spreadOverlayWidthPx: number,
  pageCanvasHeightPx: number,
): number {
  if (!(containerW > 0) || !(containerH > 0)) return 1
  if (!(spreadOverlayWidthPx > 0) || !(pageCanvasHeightPx > 0)) return 1
  const scaleW = containerW / spreadOverlayWidthPx
  const scaleH = containerH / pageCanvasHeightPx
  return Math.min(1, scaleW, scaleH)
}

/** Matches `BOOK_OVERLAY_VIEWPORT_MARGIN_Y` (3.5rem) on the fullscreen book overlay. */
const BOOK_OVERLAY_VIEWPORT_MARGIN_REM = 3.5
const DEFAULT_HEURISTIC_PAGE_ASPECT = 1 / 1.414

/**
 * Estimate per-page spread width before `pageAreaRef` measures (map prefetch + overlay cold start).
 * Uses the same formula as `computeSpreadPageWidth` / `useBookViewportLayout`.
 */
export function heuristicBookOverlaySpreadPageWidthPx(
  pageAspectRatio = DEFAULT_HEURISTIC_PAGE_ASPECT,
): number {
  if (typeof window === 'undefined' || !Number.isFinite(window.innerWidth)) return 360
  const rem =
    typeof document !== 'undefined'
      ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      : 16
  const marginY = BOOK_OVERLAY_VIEWPORT_MARGIN_REM * rem
  const contentH = Math.max(1, window.innerHeight - 2 * marginY)
  return computeSpreadPageWidth(window.innerWidth, contentH, pageAspectRatio)
}
