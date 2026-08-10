import { spreadClusterWidthPx } from '@/lib/books/spread-canvas-coords'
import {
  BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_X_PX,
  BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_Y_PX,
} from '@/lib/books/book-spread-desk-shadow'
import {
  BOOK_SPREAD_FRAME_LAYOUT_SAFETY_PX,
  computeBookSpreadFrameLayoutFitBox,
  computeBookSpreadFrameOuterBox,
} from '@/lib/books/book-spread-frame-metrics'
import { DEFAULT_SPREAD_GUTTER_PULL_RATIO, effectiveSpreadGutterPullPx } from '@/lib/books/spread-gutter'

const VIEWPORT_HEIGHT_SAFE_RATIO = 1
const VIEWPORT_WIDTH_SAFE_RATIO = 1

export { BOOK_SPREAD_FRAME_LAYOUT_SAFETY_PX }

function viewportSafeBox(
  viewportW: number,
  viewportH: number,
  includeBookFrame: boolean,
): { safeW: number; safeH: number } {
  const layoutSafetyPx = includeBookFrame ? BOOK_SPREAD_FRAME_LAYOUT_SAFETY_PX : 0
  let safeW = viewportW * VIEWPORT_WIDTH_SAFE_RATIO - layoutSafetyPx
  let safeH = viewportH * VIEWPORT_HEIGHT_SAFE_RATIO - layoutSafetyPx
  if (includeBookFrame) {
    safeW -= BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_X_PX
    safeH -= BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_Y_PX
  }
  return {
    safeW: Math.max(1, safeW),
    safeH: Math.max(1, safeH),
  }
}

export interface SpreadClusterMetrics {
  spreadPageWidth: number
  pageCanvasHeightPx: number
  gutterPullPx: number
  spreadOverlayWidthPx: number
}

function spreadFrameLayoutFitBoxForPageWidth(
  spreadPageWidth: number,
  pageAspectRatio: number,
  pullRatio = DEFAULT_SPREAD_GUTTER_PULL_RATIO,
): { widthPx: number; heightPx: number } {
  const pageCanvasHeightPx = computePageCanvasHeightPx(spreadPageWidth, pageAspectRatio)
  const gutterPullPx = effectiveSpreadGutterPullPx(spreadPageWidth, pullRatio)
  const spreadOverlayWidthPx = Math.max(
    0,
    Math.round(spreadClusterWidthPx(spreadPageWidth, gutterPullPx)),
  )
  return computeBookSpreadFrameLayoutFitBox(spreadOverlayWidthPx, pageCanvasHeightPx)
}

function spreadFramePaintedOuterBoxForPageWidth(
  spreadPageWidth: number,
  pageAspectRatio: number,
  pullRatio = DEFAULT_SPREAD_GUTTER_PULL_RATIO,
): { widthPx: number; heightPx: number } {
  const pageCanvasHeightPx = computePageCanvasHeightPx(spreadPageWidth, pageAspectRatio)
  const gutterPullPx = effectiveSpreadGutterPullPx(spreadPageWidth, pullRatio)
  const spreadOverlayWidthPx = Math.max(
    0,
    Math.round(spreadClusterWidthPx(spreadPageWidth, gutterPullPx)),
  )
  return computeBookSpreadFrameOuterBox(spreadOverlayWidthPx, pageCanvasHeightPx)
}

function spreadPageWidthFitsViewport(
  spreadPageWidth: number,
  viewportW: number,
  viewportH: number,
  pageAspectRatio: number,
  includeBookFrame: boolean,
): boolean {
  const { safeW: safeWidth, safeH: safeHeight } = viewportSafeBox(
    viewportW,
    viewportH,
    includeBookFrame,
  )
  const aspect = Number.isFinite(pageAspectRatio) && pageAspectRatio > 0 ? pageAspectRatio : 1

  if (!includeBookFrame) {
    const pageH = computePageCanvasHeightPx(spreadPageWidth, aspect)
    const gutterPullPx = effectiveSpreadGutterPullPx(spreadPageWidth, DEFAULT_SPREAD_GUTTER_PULL_RATIO)
    const spreadOverlayWidthPx = Math.max(
      0,
      Math.round(spreadClusterWidthPx(spreadPageWidth, gutterPullPx)),
    )
    return spreadOverlayWidthPx <= safeWidth && pageH <= safeHeight
  }

  const layout = spreadFrameLayoutFitBoxForPageWidth(spreadPageWidth, aspect)
  const painted = spreadFramePaintedOuterBoxForPageWidth(spreadPageWidth, aspect)
  return (
    layout.widthPx <= safeWidth &&
    layout.heightPx <= safeHeight &&
    painted.widthPx <= safeWidth &&
    painted.heightPx <= safeHeight
  )
}

export function computeSpreadReaderPaintedOuterBox(
  spreadOverlayWidthPx: number,
  pageCanvasHeightPx: number,
  includeBookFrame: boolean,
): { widthPx: number; heightPx: number } {
  if (includeBookFrame) {
    return computeBookSpreadFrameOuterBox(spreadOverlayWidthPx, pageCanvasHeightPx)
  }
  return { widthPx: spreadOverlayWidthPx, heightPx: pageCanvasHeightPx }
}

/**
 * Uniform CSS scale from layout (bucket) width to target width.
 * Uses painted outer-box ratios so frame chrome stays in sync with resize-scale mode.
 */
export function computeSpreadReaderResizeScale(
  layoutSpreadPageWidth: number,
  targetSpreadPageWidth: number,
  pageAspectRatio: number,
  pullRatio = DEFAULT_SPREAD_GUTTER_PULL_RATIO,
  includeBookFrame = true,
): number {
  if (!(layoutSpreadPageWidth > 0) || !(targetSpreadPageWidth > 0)) return 1
  if (layoutSpreadPageWidth === targetSpreadPageWidth) return 1

  const layoutCluster = computeSpreadClusterMetrics(
    layoutSpreadPageWidth,
    pageAspectRatio,
    pullRatio,
  )
  const targetCluster = computeSpreadClusterMetrics(
    targetSpreadPageWidth,
    pageAspectRatio,
    pullRatio,
  )

  if (!includeBookFrame) {
    const scaleW = targetCluster.spreadOverlayWidthPx / layoutCluster.spreadOverlayWidthPx
    const scaleH = targetCluster.pageCanvasHeightPx / layoutCluster.pageCanvasHeightPx
    return Math.min(scaleW, scaleH)
  }

  const layoutOuter = computeSpreadReaderPaintedOuterBox(
    layoutCluster.spreadOverlayWidthPx,
    layoutCluster.pageCanvasHeightPx,
    true,
  )
  const targetOuter = computeSpreadReaderPaintedOuterBox(
    targetCluster.spreadOverlayWidthPx,
    targetCluster.pageCanvasHeightPx,
    true,
  )
  const scaleW = targetOuter.widthPx / layoutOuter.widthPx
  const scaleH = targetOuter.heightPx / layoutOuter.heightPx
  return Math.min(scaleW, scaleH)
}

/**
 * Layout slot for a CSS-scaled spread cluster.
 * Transform does not change layout size — when scale < 1 the slot must stay at the
 * pre-transform outer box or the frame gets clipped by overflow-hidden parents.
 */
export function computeSpreadClusterLayoutSlot(
  outerWidthPx: number,
  outerHeightPx: number,
  displayScale: number,
): { widthPx: number; heightPx: number } {
  if (!(outerWidthPx > 0) || !(outerHeightPx > 0)) {
    return { widthPx: Math.max(1, outerWidthPx), heightPx: Math.max(1, outerHeightPx) }
  }
  const scale = displayScale > 0 ? displayScale : 1
  const widthSlot = scale > 1 ? outerWidthPx * scale : outerWidthPx
  const heightSlot = scale > 1 ? outerHeightPx * scale : outerHeightPx
  return {
    widthPx: Math.ceil(widthSlot),
    heightPx: Math.ceil(heightSlot),
  }
}

/**
 * Per-page width for a two-up spread inside a viewport (matches `useBookViewportLayout`).
 * Sizes page art so the full open-book frame fits at display scale 1.
 */
export function computeSpreadPageWidth(
  viewportW: number,
  viewportH: number,
  pageAspectRatio: number,
  minWidth = 1,
  includeBookFrame = true,
): number {
  if (!(viewportW > 0) || !(viewportH > 0)) return Math.max(minWidth, 1)

  const safeWidth = viewportW * VIEWPORT_WIDTH_SAFE_RATIO
  const maxCandidate = Math.max(minWidth, Math.floor(safeWidth / 2))

  if (
    spreadPageWidthFitsViewport(maxCandidate, viewportW, viewportH, pageAspectRatio, includeBookFrame)
  ) {
    return maxCandidate
  }

  let lo = minWidth
  let hi = maxCandidate
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (spreadPageWidthFitsViewport(mid, viewportW, viewportH, pageAspectRatio, includeBookFrame)) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }

  return Math.max(minWidth, lo)
}

/**
 * Scale applied to the spread cluster in the reader.
 * Safety net only — shrinks when painted frame * scale would overflow the page area.
 */
export function computeSpreadReaderDisplayScale(
  spreadDisplayScale: number,
  pageAreaW: number,
  pageAreaH: number,
  spreadOverlayWidthPx: number,
  pageCanvasHeightPx: number,
  includeBookFrame = true,
): number {
  const scale = spreadDisplayScale > 0 ? spreadDisplayScale : 1
  if (!(pageAreaW > 0) || !(pageAreaH > 0)) return scale
  if (!(spreadOverlayWidthPx > 0) || !(pageCanvasHeightPx > 0)) return scale

  const { safeW, safeH } = viewportSafeBox(pageAreaW, pageAreaH, includeBookFrame)
  const painted = computeSpreadReaderPaintedOuterBox(
    spreadOverlayWidthPx,
    pageCanvasHeightPx,
    includeBookFrame,
  )
  const maxScaleW = safeW / painted.widthPx
  const maxScaleH = safeH / painted.heightPx
  const fitCap = Math.min(maxScaleW, maxScaleH)
  return Math.min(scale, fitCap)
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
  const gutterPullPx = effectiveSpreadGutterPullPx(spreadPageWidth, pullRatio)
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
  includeBookFrame = false,
): number {
  if (!(containerW > 0) || !(containerH > 0)) return 1
  if (!(spreadOverlayWidthPx > 0) || !(pageCanvasHeightPx > 0)) return 1
  const { safeW, safeH } = viewportSafeBox(containerW, containerH, includeBookFrame)
  const cluster = computeSpreadReaderPaintedOuterBox(
    spreadOverlayWidthPx,
    pageCanvasHeightPx,
    includeBookFrame,
  )
  const scaleW = safeW / cluster.widthPx
  const scaleH = safeH / cluster.heightPx
  return Math.min(1, scaleW, scaleH)
}

/** Matches `BOOK_OVERLAY_VIEWPORT_MARGIN_Y` on the fullscreen book overlay. */
const BOOK_OVERLAY_VIEWPORT_MARGIN_REM = 0
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
