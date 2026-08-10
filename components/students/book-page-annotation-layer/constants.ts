import type { CSSProperties } from 'react'

/** Above ReaderPageSlot pdf (`z-[1]`) so slices composite as siblings of the page bitmap. */
export const ANNOTATION_STACK_BASE_Z = 2

/** BookSpreadSessionLayer uses z-[24]; keep text/stickies above multiply highlighter. */
export const DOM_ABOVE_INK_SESSION_Z_BOOST = 28

/** Spread ink overlay in the book reader (below lesson board panel). */
export const BOOK_SPREAD_SESSION_LAYER_Z = 24
/** Lift spread ink + selection chrome above live-draw capture while selecting on the book. */
export const BOOK_SPREAD_SESSION_LAYER_ELEVATED_Z = 40
/** Lesson board / notebook panel in the spread overlay stack. */
export const LESSON_BOARD_PANEL_Z = 38

export function bookSpreadSessionLayerStackZ(options: {
  elevateForSelectionChrome: boolean
  lessonBoardObscures: boolean
}): number {
  if (options.lessonBoardObscures) return BOOK_SPREAD_SESSION_LAYER_Z
  return options.elevateForSelectionChrome
    ? BOOK_SPREAD_SESSION_LAYER_ELEVATED_Z
    : BOOK_SPREAD_SESSION_LAYER_Z
}

/** Only text/sticky DOM needs the session boost; images/flashcards follow ink paint order. */
export function domSliceZBoostForCommandKind(
  kind: string,
  sessionInkActive: boolean,
): number {
  if (!sessionInkActive) return 0
  return kind === 'text' || kind === 'sticky' ? DOM_ABOVE_INK_SESSION_Z_BOOST : 0
}

/** Must be on marker canvas elements (not a parent) so multiply reaches the PDF/image below. */
export const MARKER_CANVAS_BLEND: CSSProperties = { mixBlendMode: 'multiply' }

export const TWO_POINT_EPS = 0.004
export const TAP_MOVE_EPS = 0.006

/** Marquee smaller than this (normalized area) counts as a click on empty space. */
export const MARQUEE_MIN_AREA = 0.00004

export function sliceStackZ(commandIndex: number): number {
  return ANNOTATION_STACK_BASE_Z + commandIndex
}

export function pageLayerBox(widthPx: number, heightPx: number, zIndex: number): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    zIndex,
  }
}
