import type { ImageNormBox } from '@/lib/books/clipboard-image'

export const FLASHCARD_PLACEHOLDER_ZH = '…'

const FLASHCARD_MAX_WIDTH_FRACTION = 0.34
const FLASHCARD_MAX_WIDTH_PX = 320
const FLASHCARD_MIN_WIDTH_PX = 120
const FLASHCARD_IMAGE_MAX_HEIGHT_VIEWPORT_FRACTION = 0.42
const FLASHCARD_FOOTER_MIN_PX = 52
const FLASHCARD_FOOTER_WIDTH_RATIO = 0.32
const FLASHCARD_PADDING_PX = 10

/** Fraction of card height used for the picture (rest is text footer). */
export const FLASHCARD_IMAGE_AREA_HEIGHT_RATIO = 0.58

/**
 * Positions a unified flashcard box (image + footer) in normalized board coords.
 */
export function fitFlashcardNormBox(
  naturalWidth: number,
  naturalHeight: number,
  boardWidthPx: number,
  boardContentHeightPx: number,
  viewportHeightPx: number,
  scrollTopPx: number,
  anchorNorm?: { x: number; y: number } | null,
): ImageNormBox {
  const boardW = Math.max(1, boardWidthPx)
  const boardH = Math.max(1, boardContentHeightPx)

  const cardWidthPx = Math.max(
    FLASHCARD_MIN_WIDTH_PX,
    Math.min(boardW * FLASHCARD_MAX_WIDTH_FRACTION, FLASHCARD_MAX_WIDTH_PX, naturalWidth),
  )
  const innerWidthPx = Math.max(1, cardWidthPx - FLASHCARD_PADDING_PX * 2)
  const aspect = naturalHeight / Math.max(1, naturalWidth)
  let imageAreaHeightPx = innerWidthPx * aspect
  const maxImageAreaPx = Math.max(
    48,
    viewportHeightPx * FLASHCARD_IMAGE_MAX_HEIGHT_VIEWPORT_FRACTION,
  )
  if (imageAreaHeightPx > maxImageAreaPx) {
    imageAreaHeightPx = maxImageAreaPx
  }

  const footerHeightPx = Math.max(
    FLASHCARD_FOOTER_MIN_PX,
    cardWidthPx * FLASHCARD_FOOTER_WIDTH_RATIO,
  )
  const cardHeightPx =
    FLASHCARD_PADDING_PX * 2 + imageAreaHeightPx + footerHeightPx

  const wNorm = Math.max(0.02, Math.min(1, cardWidthPx / boardW))
  const hNorm = Math.max(0.02, Math.min(1, cardHeightPx / boardH))

  if (anchorNorm) {
    const xNorm = anchorNorm.x - wNorm / 2
    const yNorm = anchorNorm.y - hNorm / 2
    return {
      x: Math.max(0, Math.min(1 - wNorm, xNorm)),
      y: Math.max(0, Math.min(1 - hNorm, yNorm)),
      w: wNorm,
      h: hNorm,
    }
  }

  const xPx = (boardW - cardWidthPx) / 2
  const yPx = scrollTopPx + Math.max(0, (viewportHeightPx - cardHeightPx) / 2)

  return {
    x: Math.max(0, Math.min(1, xPx / boardW)),
    y: Math.max(0, Math.min(1, yPx / boardH)),
    w: wNorm,
    h: hNorm,
  }
}

/** @deprecated Use fitFlashcardNormBox — kept for callers migrating off the 3-piece layout. */
export const fitFlashcardImageNormBox = fitFlashcardNormBox
