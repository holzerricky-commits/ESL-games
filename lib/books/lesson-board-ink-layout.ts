import {
  lessonBoardAspectHeightPx,
  type LessonBoardPageOrientation,
} from '@/lib/books/lesson-board-types'
import type { WhiteboardViewportInkConfig } from '@/lib/books/whiteboard-viewport-ink'

/** Visible ink area below the board header. */
export function lessonBoardCanvasViewportHeightPx(
  panelHeightPx: number,
  headerHeightPx: number,
): number {
  return Math.max(1, panelHeightPx - headerHeightPx)
}

/** Spread-wide board width with the same outer margin as the docked slot. */
export function lessonBoardWideSpreadWidthPx(
  spreadOverlayWidthPx: number,
  slotInsetPx: number,
): number {
  return Math.max(1, spreadOverlayWidthPx - slotInsetPx * 2)
}

/** Wide panel chrome height = header + 16∶9 content. */
export function lessonBoardWidePanelHeightPx(
  contentHeightPx: number,
  headerHeightPx: number,
): number {
  return Math.max(1, headerHeightPx + contentHeightPx)
}

/** Center the wide card on the spread while keeping at least slotInset margin on each side. */
export function lessonBoardWidePanelAnchorPx(
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

/** Default wide content height from inset spread width (16∶9). */
export function lessonBoardWideDefaultContentHeightPx(
  spreadOverlayWidthPx: number,
  slotInsetPx: number,
): number {
  const widthPx = lessonBoardWideSpreadWidthPx(spreadOverlayWidthPx, slotInsetPx)
  return lessonBoardAspectHeightPx(widthPx, 'wide')
}

/** Runway growth + min height should match the panel the teacher actually scrolls. */
export function lessonBoardRunwayViewportHeightPx(
  orientation: LessonBoardPageOrientation,
  slotPanelHeightPx: number,
  headerHeightPx: number,
  widePanelHeightPx?: number,
): number {
  if (orientation === 'wide' && widePanelHeightPx != null && widePanelHeightPx > 0) {
    return lessonBoardCanvasViewportHeightPx(widePanelHeightPx, headerHeightPx)
  }
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
