import type { AnnotationCommand } from '@/lib/books/annotation-command-types'
import { getAnnotationBounds, unionNormRects } from '@/lib/books/annotation-select'

export type BoardPasteAnchorNorm = { readonly x: number; readonly y: number }

export type BoardPastePlacement = {
  scrollTopPx: number
  viewportHeightPx: number
  anchorNorm: BoardPasteAnchorNorm | null
}

let boardPasteAnchorNorm: BoardPasteAnchorNorm | null = null

export function setBoardPasteAnchorNorm(anchor: BoardPasteAnchorNorm | null): void {
  boardPasteAnchorNorm = anchor
}

export function getBoardPasteAnchorNorm(): BoardPasteAnchorNorm | null {
  return boardPasteAnchorNorm
}

export function clampBoardNorm(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Center of the visible board band when no click anchor is set. */
export function viewportCenterPasteAnchor(
  boardContentHeightPx: number,
  viewportHeightPx: number,
  scrollTopPx: number,
): BoardPasteAnchorNorm {
  const boardH = Math.max(1, boardContentHeightPx)
  const yPx = scrollTopPx + viewportHeightPx / 2
  return {
    x: 0.5,
    y: clampBoardNorm(yPx / boardH),
  }
}

export function resolveBoardPasteAnchor(
  placement: Pick<BoardPastePlacement, 'scrollTopPx' | 'viewportHeightPx' | 'anchorNorm'>,
  boardContentHeightPx: number,
): BoardPasteAnchorNorm {
  if (placement.anchorNorm) return placement.anchorNorm
  return viewportCenterPasteAnchor(
    boardContentHeightPx,
    placement.viewportHeightPx,
    placement.scrollTopPx,
  )
}

/** Move a selection so its union center lands on the paste anchor. */
export function pasteOffsetForAnchor(
  commands: readonly AnnotationCommand[],
  anchorNorm: BoardPasteAnchorNorm,
  widthPx: number,
  heightPx: number,
): [number, number] {
  const rects = commands
    .map((cmd) => getAnnotationBounds(cmd, widthPx, heightPx))
    .filter((rect): rect is NonNullable<typeof rect> => rect != null && rect.w > 0 && rect.h > 0)
  const union = unionNormRects(rects)
  if (!union) return [0.02, 0.02]
  const centerX = union.x + union.w / 2
  const centerY = union.y + union.h / 2
  return [anchorNorm.x - centerX, anchorNorm.y - centerY]
}

export function shouldSkipBoardPasteAnchorPointerEvent(event: PointerEvent): boolean {
  if (event.button !== 0) return true
  const target = event.target
  if (!(target instanceof Element)) return false
  if (target.closest('textarea, input, select, [contenteditable="true"]')) return true
  if (target.closest('[data-board-paste-anchor-ignore="true"]')) return true
  return false
}

export function boardPasteAnchorFromElementRect(
  clientX: number,
  clientY: number,
  rect: DOMRectReadOnly,
): BoardPasteAnchorNorm | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    x: clampBoardNorm((clientX - rect.left) / rect.width),
    y: clampBoardNorm((clientY - rect.top) / rect.height),
  }
}
