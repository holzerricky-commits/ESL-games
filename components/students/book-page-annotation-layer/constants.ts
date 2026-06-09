import type { CSSProperties } from 'react'

/** Above ReaderPageSlot pdf (`z-[1]`) so slices composite as siblings of the page bitmap. */
export const ANNOTATION_STACK_BASE_Z = 2

/** BookSpreadSessionLayer uses z-[24]; keep text/stickies above multiply highlighter. */
export const DOM_ABOVE_INK_SESSION_Z_BOOST = 28

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
