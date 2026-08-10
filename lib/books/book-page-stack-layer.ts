import {
  READER_PAGE_PAPER_COLOR,
  readerPageBulgeClipPath,
  readerPageBulgeClipPathWithForeEdgeBleed,
} from '@/lib/books/reader-page-bulge-clip'

/** Keep in sync with `BOOK_SPREAD_FRAME_SCALE` in `book-spread-frame-metrics.ts`. */
const BOOK_SPREAD_FRAME_SCALE = 1.2

function scaleFramePx(px: number): number {
  return Math.max(1, Math.round(px * BOOK_SPREAD_FRAME_SCALE))
}

/** Number of visible fore-edge page slivers (back → front). */
export const FORE_EDGE_STACK_SHEET_COUNT = 8

/** Width of each fore-edge strip. */
export const FORE_EDGE_STRIP_WIDTH_PX = scaleFramePx(5)

/** Outward step per deeper sheet toward the outer margin. */
export const FORE_EDGE_STEP_PX = scaleFramePx(4)

/** Head/tail strips span the outer fore-edge portion of each page (not across the gutter). */
export const FORE_EDGE_HEAD_TAIL_WIDTH_RATIO = 0.55

export type BookPageBulgeSide = 'left' | 'right'

export type BookForeEdgeStackEdge = 'top' | 'bottom'

/** Paper-tone ramp — darker sheets deeper in the stack. */
const FORE_EDGE_STACK_STRIP_COLORS = [
  '#a8a090',
  '#b0a898',
  '#b8b0a0',
  '#c4bcb0',
  '#cfc8bc',
  '#dad4c9',
  '#e8e2d8',
  '#f0ebe3',
] as const

export function bookForeEdgeStackStripColors(): readonly string[] {
  return FORE_EDGE_STACK_STRIP_COLORS
}

export function bookForeEdgeStackTotalFanDepthPx(): number {
  return (FORE_EDGE_STACK_SHEET_COUNT - 1) * FORE_EDGE_STEP_PX
}

/** Room beyond the page face for the fanned fore-edge stack (strip width included). */
export function bookForeEdgeStackSideBleedPx(): number {
  return bookForeEdgeStackTotalFanDepthPx() + FORE_EDGE_STRIP_WIDTH_PX
}

/**
 * How far a sheet sits outside the page face (px).
 * Index 0 = back of stack (furthest out); last index = flush with page edge.
 */
export function bookForeEdgeStackOutwardOffsetPx(sheetIndex: number): number {
  const stepsFromEdge = FORE_EDGE_STACK_SHEET_COUNT - 1 - sheetIndex
  return stepsFromEdge * FORE_EDGE_STEP_PX
}

/** CSS anchor for a fore-edge strip (`right` / `left` negative = outward). */
export function bookForeEdgeStackStripAnchorStyle(
  side: BookPageBulgeSide,
  sheetIndex: number,
): { right?: number; left?: number } {
  const outward = bookForeEdgeStackOutwardOffsetPx(sheetIndex)
  const anchored = outward === 0 ? 0 : -outward
  if (side === 'right') {
    return { right: anchored }
  }
  return { left: anchored }
}

/** Shadow on the strip edge facing the page interior. */
export function bookForeEdgeStackStripShadow(
  side: BookPageBulgeSide,
  sheetIndex: number,
): string {
  const depth = FORE_EDGE_STACK_SHEET_COUNT - 1 - sheetIndex
  const alpha = 0.08 + depth * 0.015
  if (side === 'right') {
    return [
      `-1px 0 1px rgba(35, 22, 12, ${alpha})`,
      'inset 1px 0 0 rgba(255, 255, 255, 0.15)',
    ].join(', ')
  }
  return [
    `1px 0 1px rgba(35, 22, 12, ${alpha})`,
    'inset -1px 0 0 rgba(255, 255, 255, 0.15)',
  ].join(', ')
}

export function bookForeEdgeStackHeadTailWidthPx(pageWidthPx: number): number {
  return Math.max(FORE_EDGE_STRIP_WIDTH_PX, Math.round(pageWidthPx * FORE_EDGE_HEAD_TAIL_WIDTH_RATIO))
}

/** Same outward ramp as vertical fore-edge strips. */
export function bookForeEdgeStackHeadTailOutwardOffsetPx(sheetIndex: number): number {
  return bookForeEdgeStackOutwardOffsetPx(sheetIndex)
}

/** CSS anchor for a head/tail strip stepped outward from the page face. */
export function bookForeEdgeStackHeadTailAnchorStyle(
  side: BookPageBulgeSide,
  edge: BookForeEdgeStackEdge,
  sheetIndex: number,
): { top?: number; bottom?: number; left?: number; right?: number } {
  const outward = bookForeEdgeStackHeadTailOutwardOffsetPx(sheetIndex)
  const anchored = outward === 0 ? 0 : -outward
  const edgeAnchor = edge === 'top' ? { top: anchored } : { bottom: anchored }

  if (side === 'right') {
    return { ...edgeAnchor, right: 0 }
  }

  return { ...edgeAnchor, left: 0 }
}

/** Shadow on the head/tail strip edge facing the page interior. */
export function bookForeEdgeStackHeadTailShadow(
  edge: BookForeEdgeStackEdge,
  sheetIndex: number,
): string {
  const depth = FORE_EDGE_STACK_SHEET_COUNT - 1 - sheetIndex
  const alpha = 0.08 + depth * 0.015
  if (edge === 'top') {
    return [
      `0 1px 1px rgba(35, 22, 12, ${alpha})`,
      'inset 0 -1px 0 rgba(255, 255, 255, 0.15)',
    ].join(', ')
  }
  return [
    `0 -1px 1px rgba(35, 22, 12, ${alpha})`,
    'inset 0 1px 0 rgba(255, 255, 255, 0.15)',
  ].join(', ')
}

/** Vertical strip anchor inside the expanded fore-edge wrapper. */
export function bookForeEdgeStackVerticalStripStyle(
  side: BookPageBulgeSide,
  sheetIndex: number,
  bleedPx: number,
  heightPx: number,
): { top: number; height: number; left?: number; right?: number } {
  const outward = bookForeEdgeStackOutwardOffsetPx(sheetIndex)
  const anchored = outward === 0 ? 0 : -outward

  if (side === 'right') {
    return {
      top: 0,
      height: heightPx,
      right: bleedPx + anchored,
    }
  }

  return {
    top: 0,
    height: heightPx,
    left: bleedPx + anchored,
  }
}

export { READER_PAGE_PAPER_COLOR, readerPageBulgeClipPath, readerPageBulgeClipPathWithForeEdgeBleed }
