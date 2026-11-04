/**
 * Overview (retell) page grid — fill the desk with ~4–5 readable columns.
 * Phase 1: auto-fit only (no teacher density control yet).
 *
 * Cut-into-volumes uses denser presets so more pages fit on screen while
 * scanning for volume starts.
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

/** Cut-into-volumes: denser grid so volume starts are easier to scan/scroll. */
export const CUT_PAGE_GRID_MIN_COLS = 6
export const CUT_PAGE_GRID_MAX_COLS = 12
export const CUT_PAGE_GRID_TARGET_PAGE_WIDTH_PX = 110
export const CUT_PAGE_GRID_GAP_PX = 8
export const CUT_PAGE_GRID_PAD_PX = 12
/** Render width matched to dense cut tiles (CSS still scales to the cell). */
export const CUT_PAGE_GRID_THUMB_RENDER_WIDTH = 140

export interface PageGridLayoutOptions {
  minCols?: number
  maxCols?: number
  targetPageWidthPx?: number
  gapPx?: number
  padPx?: number
}

export interface PageGridLayoutMetrics {
  cols: number
  pageWidthPx: number
  gapPx: number
  padPx: number
}

/**
 * Choose column count from available width, then stretch tile width to fill the row.
 */
export function computePageGridLayout(
  availableWidthPx: number,
  options?: PageGridLayoutOptions,
): PageGridLayoutMetrics {
  const padPx = options?.padPx ?? PAGE_GRID_PAD_PX
  const gapPx = options?.gapPx ?? PAGE_GRID_GAP_PX
  const minCols = options?.minCols ?? PAGE_GRID_MIN_COLS
  const maxCols = options?.maxCols ?? PAGE_GRID_MAX_COLS
  const targetPageWidthPx = options?.targetPageWidthPx ?? PAGE_GRID_TARGET_PAGE_WIDTH_PX
  const inner = Math.max(1, availableWidthPx - padPx * 2)
  const roughCols = Math.floor((inner + gapPx) / (targetPageWidthPx + gapPx))
  const cols = Math.max(minCols, Math.min(maxCols, roughCols || minCols))
  const pageWidthPx = Math.max(1, Math.floor((inner - gapPx * (cols - 1)) / cols))
  return { cols, pageWidthPx, gapPx, padPx }
}

/** Dense layout for the Cut into volumes page canvas. */
export function computeCutPageGridLayout(availableWidthPx: number): PageGridLayoutMetrics {
  return computePageGridLayout(availableWidthPx, {
    minCols: CUT_PAGE_GRID_MIN_COLS,
    maxCols: CUT_PAGE_GRID_MAX_COLS,
    targetPageWidthPx: CUT_PAGE_GRID_TARGET_PAGE_WIDTH_PX,
    gapPx: CUT_PAGE_GRID_GAP_PX,
    padPx: CUT_PAGE_GRID_PAD_PX,
  })
}
