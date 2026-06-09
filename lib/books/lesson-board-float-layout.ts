/** Float window position + uniform scale relative to the docked slot size. */
export type LessonBoardFloatRect = {
  leftPx: number
  topPx: number
  scale: number
}

export const LESSON_BOARD_FLOAT_MIN_SCALE = 0.55
export const LESSON_BOARD_FLOAT_MAX_SCALE = 1.15

export function lessonBoardFloatPanelSizePx(
  naturalWidthPx: number,
  naturalHeightPx: number,
  scale: number,
): { widthPx: number; heightPx: number } {
  const s = clampLessonBoardFloatScale(scale)
  return {
    widthPx: Math.max(1, Math.round(naturalWidthPx * s)),
    heightPx: Math.max(1, Math.round(naturalHeightPx * s)),
  }
}

export function clampLessonBoardFloatScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.max(LESSON_BOARD_FLOAT_MIN_SCALE, Math.min(LESSON_BOARD_FLOAT_MAX_SCALE, scale))
}

export function clampLessonBoardFloatRect(
  rect: LessonBoardFloatRect,
  naturalWidthPx: number,
  naturalHeightPx: number,
  boundsWidthPx: number,
  boundsHeightPx: number,
): LessonBoardFloatRect {
  const scale = clampLessonBoardFloatScale(rect.scale)
  const { widthPx, heightPx } = lessonBoardFloatPanelSizePx(
    naturalWidthPx,
    naturalHeightPx,
    scale,
  )
  const maxLeft = Math.max(0, boundsWidthPx - widthPx)
  const maxTop = Math.max(0, boundsHeightPx - heightPx)
  return {
    scale,
    leftPx: Math.max(0, Math.min(maxLeft, Math.round(rect.leftPx))),
    topPx: Math.max(0, Math.min(maxTop, Math.round(rect.topPx))),
  }
}

/** Default float origin: same top-left as the docked slot. */
export function defaultLessonBoardFloatRect(
  slotLeftPx: number,
  slotTopPx: number,
): LessonBoardFloatRect {
  return {
    leftPx: Math.max(0, Math.round(slotLeftPx)),
    topPx: Math.max(0, Math.round(slotTopPx)),
    scale: 1,
  }
}

/** Native pixel sizes for a floating board (header stays 36px; canvas area scales). */
export function lessonBoardFloatDisplayMetrics(
  naturalPanelWidthPx: number,
  naturalPanelHeightPx: number,
  naturalContentHeightPx: number,
  scale: number,
  headerHeightPx: number,
): {
  panelWidthPx: number
  panelHeightPx: number
  canvasViewportHeightPx: number
  displayContentHeightPx: number
  displayScale: number
} {
  const s = clampLessonBoardFloatScale(scale)
  const panelWidthPx = Math.max(1, Math.round(naturalPanelWidthPx * s))
  const naturalCanvasViewportPx = Math.max(1, naturalPanelHeightPx - headerHeightPx)
  const canvasViewportHeightPx = Math.max(1, Math.round(naturalCanvasViewportPx * s))
  const panelHeightPx = canvasViewportHeightPx + headerHeightPx
  const displayContentHeightPx = Math.max(1, Math.round(naturalContentHeightPx * s))
  const displayScale = panelWidthPx / Math.max(1, naturalPanelWidthPx)
  return {
    panelWidthPx,
    panelHeightPx,
    canvasViewportHeightPx,
    displayContentHeightPx,
    displayScale,
  }
}

export function lessonBoardFloatScaleFromResizeDelta(
  startScale: number,
  naturalWidthPx: number,
  naturalHeightPx: number,
  deltaXPx: number,
  deltaYPx: number,
): number {
  const aspect = naturalWidthPx / Math.max(1, naturalHeightPx)
  const dominantDelta = Math.abs(deltaXPx) >= Math.abs(deltaYPx) * aspect ? deltaXPx : deltaYPx * aspect
  const next = startScale + dominantDelta / Math.max(1, naturalWidthPx)
  return clampLessonBoardFloatScale(next)
}
