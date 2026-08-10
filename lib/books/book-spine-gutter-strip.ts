import type { CSSProperties } from 'react'
import {
  BOOK_SPINE_GUTTER_CONCAVE_GRADIENT,
  bookSpineGutterSilhouetteClipPath,
} from '@/lib/books/book-spine-gutter-depth'

/** Board leather — open spread cover boards (muted orange-brown / leather). */
export const BOOK_COVER_BOARD_COLOR = '#8f5a35'

/** Inner edge of each cover board laps over the spine cloth to seal the joint. */
export const BOOK_COVER_BOARD_SPINE_OVERLAP_PX = 2

/** Darker book-cloth spine between the two rigid boards. */
export const BOOK_SPINE_GUTTER_COLOR = '#6e4225'

/** Full-height flexible spine trough — gradient + head/tail dip silhouette only. */
export function bookSpineGutterStripStyle(
  widthPx: number,
  heightPx: number,
): CSSProperties {
  return {
    backgroundColor: BOOK_SPINE_GUTTER_COLOR,
    backgroundImage: BOOK_SPINE_GUTTER_CONCAVE_GRADIENT,
    clipPath: bookSpineGutterSilhouetteClipPath(widthPx, heightPx),
  }
}
