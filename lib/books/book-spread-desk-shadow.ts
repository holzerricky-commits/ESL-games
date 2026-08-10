import type { CSSProperties } from 'react'
import { hardcoverBoardPanelCornerRadiusStyle } from '@/lib/books/book-cover-board-depth'
import { bookForeEdgeStackSideBleedPx } from '@/lib/books/book-page-stack-layer'

/** Hairline + tight band where the board meets the mat (right board — no fore-edge). */
export const BOOK_SPREAD_DESK_SHARP_BOTTOM_CONTACT_SHADOW = [
  '0px 1px 0px rgba(0, 0, 0, 0.82)',
  '0px 2px 4px -1px rgba(0, 0, 0, 0.74)',
  '0px 5px 9px -2px rgba(0, 0, 0, 0.58)',
].join(', ')

/** Left board bottom contact — tucked under the board foot. */
export const BOOK_SPREAD_DESK_LEFT_BOTTOM_CONTACT_SHADOW = [
  '-1px 1px 0px rgba(0, 0, 0, 0.84)',
  '-2px 3px 5px -1px rgba(0, 0, 0, 0.76)',
  '-2px 6px 10px -2px rgba(0, 0, 0, 0.60)',
].join(', ')

/** Multi-layer soft halo — sits close under the board without a wide wash. */
export const BOOK_SPREAD_DESK_BOARD_AMBIENT_SHADOW = [
  '0px 8px 14px rgba(0, 0, 0, 0.40)',
  '0px 18px 32px rgba(0, 0, 0, 0.28)',
  '0px 28px 48px rgba(0, 0, 0, 0.18)',
].join(', ')

/** Left board ambient — slight outward shift to match contact shadows. */
export const BOOK_SPREAD_DESK_LEFT_BOARD_AMBIENT_SHADOW = [
  '-2px 8px 14px rgba(0, 0, 0, 0.42)',
  '-3px 18px 32px rgba(0, 0, 0, 0.30)',
  '-4px 28px 48px rgba(0, 0, 0, 0.20)',
].join(', ')

/** @deprecated Right fore-edge shell contact removed from the spread frame. */
export const BOOK_SPREAD_DESK_SHELL_RIGHT_CONTACT_SHADOW = [
  '2px 0px 0px rgba(0, 0, 0, 0.65)',
  '4px 2px 8px -1px rgba(0, 0, 0, 0.48)',
  '8px 4px 16px -4px rgba(0, 0, 0, 0.28)',
].join(', ')

const BOOK_SPREAD_DESK_LEFT_BOARD_FORE_SHADOW = '-2px 2px 7px -2px rgba(0, 0, 0, 0.38)'

function bookCoverBoardContactBoxShadow(side: 'left' | 'right'): string {
  if (side === 'left') {
    return [BOOK_SPREAD_DESK_LEFT_BOTTOM_CONTACT_SHADOW, BOOK_SPREAD_DESK_LEFT_BOARD_FORE_SHADOW].join(
      ', ',
    )
  }

  return BOOK_SPREAD_DESK_SHARP_BOTTOM_CONTACT_SHADOW
}

/**
 * Max downward bleed from board + spine desk shadows (offset + blur).
 * Reader layout subtracts twice this from viewport height so a centered book keeps room below.
 */
export const BOOK_SPREAD_DESK_SHADOW_BOTTOM_BLEED_PX = 64

/** Horizontal bleed so fore-edge contact shadows and page stack fan are not clipped. */
export const BOOK_SPREAD_DESK_SHADOW_SIDE_BLEED_PX = Math.max(
  36,
  bookForeEdgeStackSideBleedPx() + 10,
)

/** Vertical viewport budget removed when sizing the open-book frame in the reader. */
export const BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_Y_PX =
  BOOK_SPREAD_DESK_SHADOW_BOTTOM_BLEED_PX * 2 + 8

/** Horizontal viewport budget removed when sizing the open-book frame in the reader. */
export const BOOK_SPREAD_DESK_SHADOW_VIEWPORT_RESERVE_X_PX =
  BOOK_SPREAD_DESK_SHADOW_SIDE_BLEED_PX * 2

/** Tier 0 — wide soft ambient under a cover board. */
export function bookCoverBoardAmbientDeskShadowStyle(
  side: 'left' | 'right',
  shellRadiusPx: number,
): Pick<CSSProperties, 'boxShadow'> &
  ReturnType<typeof hardcoverBoardPanelCornerRadiusStyle> {
  return {
    boxShadow:
      side === 'left' ? BOOK_SPREAD_DESK_LEFT_BOARD_AMBIENT_SHADOW : BOOK_SPREAD_DESK_BOARD_AMBIENT_SHADOW,
    ...hardcoverBoardPanelCornerRadiusStyle(side, shellRadiusPx),
  }
}

/** Tier 1 — sharp contact under a cover board (bottom + fore-edge). */
export function bookCoverBoardContactDeskShadowStyle(
  side: 'left' | 'right',
  shellRadiusPx: number,
): Pick<CSSProperties, 'boxShadow'> &
  ReturnType<typeof hardcoverBoardPanelCornerRadiusStyle> {
  return {
    boxShadow: bookCoverBoardContactBoxShadow(side),
    ...hardcoverBoardPanelCornerRadiusStyle(side, shellRadiusPx),
  }
}

/** @deprecated Use `bookCoverBoardAmbientDeskShadowStyle` + `bookCoverBoardContactDeskShadowStyle`. */
export function bookCoverBoardDeskShadowStyle(
  side: 'left' | 'right',
  shellRadiusPx: number,
): Pick<CSSProperties, 'boxShadow'> &
  ReturnType<typeof hardcoverBoardPanelCornerRadiusStyle> {
  const ambient =
    side === 'left' ? BOOK_SPREAD_DESK_LEFT_BOARD_AMBIENT_SHADOW : BOOK_SPREAD_DESK_BOARD_AMBIENT_SHADOW
  return {
    boxShadow: [bookCoverBoardContactBoxShadow(side), ambient].join(', '),
    ...hardcoverBoardPanelCornerRadiusStyle(side, shellRadiusPx),
  }
}

/** Sharp contact on the right fore-edge of the open book. */
export function bookSpreadShellRightContactShadowStyle(): Pick<CSSProperties, 'boxShadow'> {
  return {
    boxShadow: BOOK_SPREAD_DESK_SHELL_RIGHT_CONTACT_SHADOW,
  }
}

/** Bent spine halo — tighter falloff, still soft at the edge. */
export const BOOK_SPREAD_DESK_SPINE_BENT_DROP_SHADOW = [
  'drop-shadow(0px 5px 9px rgba(0, 0, 0, 0.34))',
  'drop-shadow(0px 11px 22px rgba(0, 0, 0, 0.24))',
  'drop-shadow(0px 20px 36px rgba(0, 0, 0, 0.16))',
].join(' ')

/** Hairline stroke along the concave edge — invisible except as shadow source. */
export function bookSpineGutterBentDeskShadowStrokeWidthPx(widthPx: number): number {
  return Math.min(4, Math.max(2, Math.round(widthPx * 0.06)))
}

/** Tier 0 — bent soft shadow under the recessed spine (no contact — gutter sits above the mat). */
export function bookSpineGutterAmbientDeskShadowStyle(
  _widthPx: number,
  _heightPx: number,
): Pick<CSSProperties, 'filter'> {
  void _widthPx
  void _heightPx
  return {
    filter: BOOK_SPREAD_DESK_SPINE_BENT_DROP_SHADOW,
  }
}

/**
 * @deprecated Gutter is recessed above the desk — no contact shadow. Use ambient only.
 */
export function bookSpineGutterContactDeskShadowStyle(
  widthPx: number,
  heightPx: number,
): Pick<CSSProperties, 'display'> {
  void widthPx
  void heightPx
  return { display: 'none' }
}

/** @deprecated Use `bookSpineGutterAmbientDeskShadowStyle`. */
export function bookSpineGutterDeskShadowStyle(
  widthPx: number,
  heightPx: number,
): ReturnType<typeof bookSpineGutterAmbientDeskShadowStyle> {
  return bookSpineGutterAmbientDeskShadowStyle(widthPx, heightPx)
}
