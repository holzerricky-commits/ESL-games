/**
 * Overview (retell) page grid — fill the desk with ~4–5 readable columns.
 * Phase 1: auto-fit only (no teacher density control yet).
 */

export type ReaderLayoutMode = 'spread' | 'pageGrid'

export const PAGE_GRID_MIN_COLS = 3
export const PAGE_GRID_MAX_COLS = 6
/** Aim so a typical desk lands near 4–5 columns. */
export const PAGE_GRID_TARGET_PAGE_WIDTH_PX = 200
export const PAGE_GRID_GAP_PX = 12
export const PAGE_GRID_PAD_PX = 16
/**
 * Fixed PDF render width for Overview tiles. CSS scales the image to the cell;
 * resize must not change this or thumbs flash white on cache miss.
 */
export const PAGE_GRID_THUMB_RENDER_WIDTH = 240

export interface PageGridLayoutMetrics {
  cols: number
  pageWidthPx: number
  gapPx: number
  padPx: number
}

/**
 * Choose column count from available width, then stretch tile width to fill the row.
 */
export function computePageGridLayout(availableWidthPx: number): PageGridLayoutMetrics {
  const padPx = PAGE_GRID_PAD_PX
  const gapPx = PAGE_GRID_GAP_PX
  const inner = Math.max(1, availableWidthPx - padPx * 2)
  const roughCols = Math.floor((inner + gapPx) / (PAGE_GRID_TARGET_PAGE_WIDTH_PX + gapPx))
  const cols = Math.max(PAGE_GRID_MIN_COLS, Math.min(PAGE_GRID_MAX_COLS, roughCols || PAGE_GRID_MIN_COLS))
  const pageWidthPx = Math.max(1, Math.floor((inner - gapPx * (cols - 1)) / cols))
  return { cols, pageWidthPx, gapPx, padPx }
}
