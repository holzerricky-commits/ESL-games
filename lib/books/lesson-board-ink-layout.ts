import { lessonBoardAspectHeightPx } from '@/lib/books/lesson-board-types'
import type { WhiteboardViewportInkConfig } from '@/lib/books/whiteboard-viewport-ink'

/** Visible ink area below the board header. */
export function lessonBoardCanvasViewportHeightPx(
  panelHeightPx: number,
  headerHeightPx: number,
): number {
  return Math.max(1, panelHeightPx - headerHeightPx)
}

/** @deprecated Wide pages removed — kept for call-site cleanup. Prefer slot width. */
export function lessonBoardWideSpreadWidthPx(
  spreadOverlayWidthPx: number,
  slotInsetPx: number,
): number {
  return Math.max(1, spreadOverlayWidthPx - slotInsetPx * 2)
}

/** @deprecated Wide pages removed. */
export function lessonBoardWidePanelHeightPx(
  contentHeightPx: number,
  headerHeightPx: number,
): number {
  return Math.max(1, headerHeightPx + contentHeightPx)
}

/** Center a panel on the spread while keeping at least slotInset margin on each side. */
export function lessonBoardCenteredPanelAnchorPx(
  spreadOverlayWidthPx: number,
  pageCanvasHeightPx: number,
  panelWidthPx: number,
  panelHeightPx: number,
  slotInsetPx: number,
): { leftPx: number; topPx: number } {
  return {
    leftPx: Math.max(slotInsetPx, Math.round((spreadOverlayWidthPx - panelWidthPx) / 2)),
    topPx: Math.max(slotInsetPx, Math.round((pageCanvasHeightPx - panelHeightPx) / 2)),
  }
}

/** @deprecated Wide pages removed — alias of centered panel anchor. */
export function lessonBoardWidePanelAnchorPx(
  spreadOverlayWidthPx: number,
  pageCanvasHeightPx: number,
  panelWidthPx: number,
  panelHeightPx: number,
  slotInsetPx: number,
): { leftPx: number; topPx: number } {
  return lessonBoardCenteredPanelAnchorPx(
    spreadOverlayWidthPx,
    pageCanvasHeightPx,
    panelWidthPx,
    panelHeightPx,
    slotInsetPx,
  )
}

/**
 * Center a notebook board on the desk during notebook Focus.
 * Panel size stays the native slot (do not stretch to spread width).
 */
export function lessonBoardFocusStandardAnchorPx(
  spreadOverlayWidthPx: number,
  pageCanvasHeightPx: number,
  panelWidthPx: number,
  panelHeightPx: number,
  slotInsetPx: number,
): { leftPx: number; topPx: number } {
  return lessonBoardCenteredPanelAnchorPx(
    spreadOverlayWidthPx,
    pageCanvasHeightPx,
    panelWidthPx,
    panelHeightPx,
    slotInsetPx,
  )
}

/** @deprecated Wide pages removed. */
export function lessonBoardWideDefaultContentHeightPx(
  spreadOverlayWidthPx: number,
  slotInsetPx: number,
): number {
  const widthPx = lessonBoardWideSpreadWidthPx(spreadOverlayWidthPx, slotInsetPx)
  return lessonBoardAspectHeightPx(widthPx)
}

/** Runway growth + min height should match the panel the teacher actually scrolls. */
export function lessonBoardRunwayViewportHeightPx(
  slotPanelHeightPx: number,
  headerHeightPx: number,
): number {
  return lessonBoardCanvasViewportHeightPx(slotPanelHeightPx, headerHeightPx)
}

/** Prefer a live DOM measurement when it is available. */
export function resolveLessonBoardPaintHeightPx(
  configuredHeightPx: number,
  measuredContentHeightPx?: number | null,
): number {
  if (measuredContentHeightPx != null && measuredContentHeightPx > 0) {
    return measuredContentHeightPx
  }
  return Math.max(1, configuredHeightPx)
}

export function buildWhiteboardViewportInkConfig(
  paintContentHeightPx: number,
  canvasViewportHeightPx: number,
  scrollTopPx: number,
): WhiteboardViewportInkConfig {
  return {
    contentHeightPx: Math.max(1, paintContentHeightPx),
    viewportHeightPx: Math.max(1, canvasViewportHeightPx),
    scrollTopPx,
  }
}
