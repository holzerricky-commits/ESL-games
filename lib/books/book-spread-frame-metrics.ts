import { BINDING_SEAM_SHADOW_WIDTH_PX } from '@/lib/books/book-binding-seam-shadow'
import { bookForeEdgeStackSideBleedPx } from '@/lib/books/book-page-stack-layer'
/**
 * INVARIANT — keep reader layout and `<BookSpreadFrame>` in sync:
 * `computeBookSpreadFrameOuterBox()` must equal the painted size of the frame component.
 * Reader sizing uses `computeBookSpreadFrameLayoutFitBox` for viewport fit and
 * `bookSpreadFrameBookBodyCenterInOuterPx` for centering in pageArea.
 * When changing cover chrome or page-stack offsets, update outer box + tests.
 * Desk-shadow viewport margin lives in `book-spread-desk-shadow.ts` and is applied in
 * `spread-viewport-layout.ts` when sizing the reader frame.
 */
export const BOOK_SPREAD_FRAME_LAYOUT_SAFETY_PX = 0

/** Uniform corner radius for the hardcover shell (all four corners). */
export const BOOK_SPREAD_HARDCOVER_SHELL_RADIUS_PX = 6

export function bookSpreadHardcoverShellRadiusPx(): number {
  return BOOK_SPREAD_HARDCOVER_SHELL_RADIUS_PX
}

/** @deprecated Use `bookSpreadHardcoverShellRadiusPx` — bottom-only radius removed. */
export function hardcoverBottomCornerRadiusPx(_coverInsetPx: number): number {
  return bookSpreadHardcoverShellRadiusPx()
}

/** Global multiplier for cover rim, page stack, gutter, and viewport reserve. */
export const BOOK_SPREAD_FRAME_SCALE = 1.2

/** Vertical cover lip is shorter than horizontal so tucked pages meet the gutter naturally. */
export const BOOK_SPREAD_COVER_VERTICAL_INSET_RATIO = 0.45

/** Phase 1 — spine cloth strip is 12% narrower than the legacy band formula. */
export const BOOK_SPREAD_SPINE_STRIP_WIDTH_RATIO = 0.88

function scaleFramePx(px: number): number {
  return Math.max(1, Math.round(px * BOOK_SPREAD_FRAME_SCALE))
}

export type BookSpreadFrameMetrics = {
  /** Hardcover lip thickness — uniform tray inset on all four shell edges. */
  coverInsetPx: number
  /** @deprecated Alias of `coverInsetPx`. */
  coverInsetTopPx: number
  /** @deprecated Alias of `coverInsetPx`. */
  coverInsetBottomPx: number
  /** Off-white page-edge strip inside the page window (not part of the outer lip). */
  pageStackInsetPx: number
  /** Bottom fore-edge strip only (corners); omitted from the binding gutter column. */
  pageStackBottomInsetPx: number
  /** Width of the center gutter shadow band. */
  gutterShadowWidthPx: number
}

/**
 * Frame thickness scales with spread size so borders stay proportional
 * across portrait, landscape, and small preview layouts.
 */
export function computeBookSpreadFrameMetrics(
  contentWidthPx: number,
  contentHeightPx: number,
): BookSpreadFrameMetrics {
  const minDim = Math.max(1, Math.min(contentWidthPx, contentHeightPx))
  const coverInsetPx = Math.round(Math.max(4, Math.min(12, minDim * 0.009)))
  const scaledCoverInsetPx = scaleFramePx(coverInsetPx)
  const scaledCoverVerticalInsetPx = Math.max(
    2,
    Math.round(scaledCoverInsetPx * BOOK_SPREAD_COVER_VERTICAL_INSET_RATIO),
  )
  const pageStackInsetPx = Math.max(2, Math.round(coverInsetPx * 0.62))
  const pageStackBottomInsetPx = Math.max(2, Math.round(pageStackInsetPx * 0.55))
  const gutterShadowWidthPx = Math.round(Math.max(18, Math.min(80, minDim * 0.038)))
  return {
    coverInsetPx: scaledCoverInsetPx,
    coverInsetTopPx: scaledCoverVerticalInsetPx,
    coverInsetBottomPx: scaledCoverVerticalInsetPx,
    pageStackInsetPx: scaleFramePx(pageStackInsetPx),
    pageStackBottomInsetPx: scaleFramePx(pageStackBottomInsetPx),
    gutterShadowWidthPx: scaleFramePx(gutterShadowWidthPx),
  }
}

/** Painted hardcover shell height — decorative chrome only; page art keeps `contentHeightPx`. */
export function bookSpreadFrameBookBodyHeightPx(
  contentHeightPx: number,
  metrics: Pick<
    BookSpreadFrameMetrics,
    'coverInsetTopPx' | 'coverInsetBottomPx' | 'pageStackBottomInsetPx'
  >,
): number {
  return contentHeightPx + metrics.coverInsetTopPx + metrics.coverInsetBottomPx
}

/** Horizontal bleed reserved on each side for the fore-edge page fan under the cover boards. */
export function bookSpreadForeEdgeStackBleedPx(): number {
  return bookForeEdgeStackSideBleedPx()
}

/** Left/right inset from shell outer edge to the flat page window (lip + stack bleed). */
export function bookSpreadHorizontalPageWindowInsetPx(
  metrics: Pick<BookSpreadFrameMetrics, 'coverInsetPx'>,
): number {
  return bookSpreadHardcoverLipInsetPx(metrics) + bookSpreadForeEdgeStackBleedPx()
}

/** Painted hardcover shell width — cover lip + fore-edge stack bleed on left and right. */
export function bookSpreadFrameBookBodyWidthPx(
  contentWidthPx: number,
  metrics: Pick<BookSpreadFrameMetrics, 'coverInsetPx'>,
): number {
  return contentWidthPx + 2 * bookSpreadHorizontalPageWindowInsetPx(metrics)
}

/** Uniform hardcover lip inset from shell outer edge to the page window. */
export function bookSpreadHardcoverLipInsetPx(
  metrics: Pick<BookSpreadFrameMetrics, 'coverInsetPx'>,
): number {
  return metrics.coverInsetPx
}

/** @deprecated Use `bookSpreadHardcoverLipInsetPx` — horizontal lip matches vertical lip. */
export function bookSpreadFrameShellHorizontalPaddingPx(
  metrics: Pick<BookSpreadFrameMetrics, 'coverInsetPx'>,
): number {
  return bookSpreadHardcoverLipInsetPx(metrics)
}

/** Hardcover inner padding — tray lip; extra horizontal room for fore-edge page fan. */
export function bookSpreadFrameShellPaddingStyle(
  metrics: Pick<
    BookSpreadFrameMetrics,
    'coverInsetPx' | 'coverInsetTopPx' | 'coverInsetBottomPx'
  >,
): { boxSizing: 'border-box'; paddingTop: number; paddingBottom: number; paddingLeft: number; paddingRight: number } {
  const lipPx = bookSpreadHardcoverLipInsetPx(metrics)
  const stackBleedPx = bookSpreadForeEdgeStackBleedPx()
  return {
    boxSizing: 'border-box',
    paddingTop: metrics.coverInsetTopPx,
    paddingBottom: metrics.coverInsetBottomPx,
    paddingLeft: lipPx + stackBleedPx,
    paddingRight: lipPx + stackBleedPx,
  }
}

/**
 * Binding gutter column inside the page-stack layer — only curves, spine cloth, and seam shadow belong here.
 */
export function bookSpreadBindingGutterColumnInPageStackPx(
  contentWidthPx: number,
  pageStackInsetPx: number,
): { leftPx: number; widthPx: number; centerPx: number } {
  const centerPx = bookSpreadSpineCenterInPageStackPx(contentWidthPx, pageStackInsetPx)
  return {
    centerPx,
    leftPx: centerPx - BINDING_SEAM_SHADOW_WIDTH_PX / 2,
    widthPx: BINDING_SEAM_SHADOW_WIDTH_PX,
  }
}

/** Full painted box for the open-book frame (content + cover and stack chrome). */
export function computeBookSpreadFrameOuterBox(
  contentWidthPx: number,
  contentHeightPx: number,
): { widthPx: number; heightPx: number; metrics: BookSpreadFrameMetrics } {
  const metrics = computeBookSpreadFrameMetrics(contentWidthPx, contentHeightPx)
  const bookBodyWidthPx = bookSpreadFrameBookBodyWidthPx(contentWidthPx, metrics)
  const bookBodyHeightPx = bookSpreadFrameBookBodyHeightPx(contentHeightPx, metrics)
  return {
    widthPx: bookBodyWidthPx,
    heightPx: bookBodyHeightPx,
    metrics,
  }
}

/** Viewport height budget for sizing — matches the painted outer box. */
export function computeBookSpreadFrameLayoutFitBox(
  contentWidthPx: number,
  contentHeightPx: number,
): { widthPx: number; heightPx: number } {
  const painted = computeBookSpreadFrameOuterBox(contentWidthPx, contentHeightPx)
  return {
    widthPx: painted.widthPx,
    heightPx: painted.heightPx,
  }
}

/**
 * Hardcover body center from the painted outer top-left.
 * Use with `left: calc(50% - xPx); top: calc(50% - yPx)` to center the visible book in pageArea.
 */
export function bookSpreadFrameBookBodyCenterInOuterPx(
  contentWidthPx: number,
  contentHeightPx: number,
): { xPx: number; yPx: number } {
  const painted = computeBookSpreadFrameOuterBox(contentWidthPx, contentHeightPx)
  return {
    xPx: painted.widthPx / 2,
    yPx: painted.heightPx / 2,
  }
}

/** Y offset from the frame outer top to the vertical center of flat page art. */
export function bookSpreadFramePageContentCenterYPx(
  contentWidthPx: number,
  contentHeightPx: number,
): number {
  const { metrics } = computeBookSpreadFrameOuterBox(contentWidthPx, contentHeightPx)
  return metrics.coverInsetTopPx + contentHeightPx / 2
}

/**
 * Viewport vertical anchor for reader layout (`top: calc(50% - anchorPx)`).
 * Centers page art in the visible frame.
 */
export function bookSpreadFrameReaderVerticalAnchorYPx(
  contentWidthPx: number,
  contentHeightPx: number,
): number {
  return bookSpreadFramePageContentCenterYPx(contentWidthPx, contentHeightPx)
}

/** @deprecated Prefer `bookSpreadFramePageContentCenterYPx` with absolute `top: calc(50% - Y)`. */
export function bookSpreadFrameOpticalCenterOffsetYPx(
  contentWidthPx: number,
  contentHeightPx: number,
): number {
  const outer = computeBookSpreadFrameOuterBox(contentWidthPx, contentHeightPx)
  const pageCenterY = bookSpreadFramePageContentCenterYPx(contentWidthPx, contentHeightPx)
  return Math.round(outer.heightPx / 2 - pageCenterY)
}

/** Vertical chrome beyond flat page art — cover lip above and below page art. */
export function bookSpreadFrameVerticalChromePx(
  contentWidthPx: number,
  contentHeightPx: number,
): { topPx: number; bottomPx: number; totalPx: number } {
  const { metrics } = computeBookSpreadFrameOuterBox(contentWidthPx, contentHeightPx)
  const topPx = metrics.coverInsetTopPx
  const bottomPx = metrics.coverInsetBottomPx
  return { topPx, bottomPx, totalPx: topPx + bottomPx }
}

/** Horizontal chrome beyond flat page art (cover lip on left and right). */
export function bookSpreadFrameHorizontalChromePx(
  contentWidthPx: number,
  contentHeightPx: number,
): number {
  const { widthPx } = computeBookSpreadFrameOuterBox(contentWidthPx, contentHeightPx)
  return widthPx - contentWidthPx
}

/** Legacy heuristic reserve — prefer dynamic chrome helpers for layout. */
export const BOOK_SPREAD_CHROME_VIEWPORT_RESERVE_Y_PX = scaleFramePx(88)
export const BOOK_SPREAD_CHROME_VIEWPORT_RESERVE_X_PX = scaleFramePx(32)

/** Spine X from the hardcover outer left — center of the page window. */
export function bookSpreadSpineCenterInCoverPx(
  contentWidthPx: number,
  coverInsetPx: number,
  foreEdgeStackBleedPx: number = bookSpreadForeEdgeStackBleedPx(),
): number {
  return coverInsetPx + foreEdgeStackBleedPx + contentWidthPx / 2
}

/** Spine X from the page-stack layer outer left (padding edge). */
export function bookSpreadSpineCenterInPageStackPx(
  contentWidthPx: number,
  pageStackInsetPx: number,
): number {
  return pageStackInsetPx + contentWidthPx / 2
}

/** Width of the center spine cloth strip on the hardcover shell. */
export function bookSpreadCoverSpineBandPx(
  gutterShadowWidthPx: number,
  hardcoverWidthPx: number,
): number {
  const wideBandPx = Math.round(
    Math.max(gutterShadowWidthPx * 2.25, hardcoverWidthPx * 0.12, gutterShadowWidthPx + 16),
  )
  const legacyBandPx = Math.max(4, Math.round((wideBandPx / 3) * 1.75 * 0.8))
  return Math.max(4, Math.round(legacyBandPx * BOOK_SPREAD_SPINE_STRIP_WIDTH_RATIO))
}

export type BookSpreadSpineStripLayout = {
  spineLeftPx: number
  spineTopPx: number
  spineWidthPx: number
  spineHeightPx: number
}

/** Center spine cloth strip — always full shell height (no vertical inset). */
export function bookSpreadSpineStripLayout(
  bookBodyHeightPx: number,
  spineCenterPx: number,
  spineStripWidthPx: number,
): BookSpreadSpineStripLayout {
  const half = spineStripWidthPx / 2
  return {
    spineLeftPx: Math.round(spineCenterPx - half),
    spineTopPx: 0,
    spineWidthPx: spineStripWidthPx,
    spineHeightPx: bookBodyHeightPx,
  }
}
