import type { CSSProperties } from 'react'

export const ANNOTATION_TEXT_FONT_NORM_STEPS = [0.016, 0.02, 0.024, 0.028, 0.032, 0.038, 0.046] as const

/** Book spread uses the full viewport height; flex centering handles vertical placement. */
export const BOOK_OVERLAY_VIEWPORT_MARGIN_Y = '0px'
export const BOOK_OVERLAY_VIEWPORT_CONTENT_HEIGHT = '100vh'

/** Shared glass chrome for toolbox, page nav, and class timer on the book overlay. */
export const BOOK_OVERLAY_GLASS_CHROME =
  'border border-white/10 bg-black/24 text-white/65 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px]'

/**
 * Warm gold pill on the book-launch mat — same language as Exit
 * (`simple-book-launch-shell`).
 */
export const CLASS_LAUNCH_CHROME =
  'border border-[#b48218]/40 bg-[#eab333]/80 text-[#5c3d0a] shadow-sm backdrop-blur-sm'

export function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

/** Dot-grid canvas — near-white with a faint warm tint; neutral gray dots. */
export const LESSON_BOARD_SURFACE: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'> = {
  backgroundColor: '#FDFCFB',
  backgroundImage: 'radial-gradient(circle, rgba(75, 85, 99, 0.22) 0.7px, transparent 0.82px)',
  backgroundSize: '20px 20px',
}

export const WHITEBOARD_HEADER_HEIGHT_PX = 36
/** Page nav strip under the canvas (matches `h-9` footer). */
export const WHITEBOARD_FOOTER_HEIGHT_PX = 36
/** Header + footer chrome reserved inside the board panel. */
export const WHITEBOARD_CHROME_HEIGHT_PX = WHITEBOARD_HEADER_HEIGHT_PX + WHITEBOARD_FOOTER_HEIGHT_PX

/** Neutral toolbar/card tokens (gray header, soft borders, elevation-2 shadow). */
export const WHITEBOARD_HEADER_BG = '#F3F4F6'
export const WHITEBOARD_BORDER_COLOR = '#EBEEF2'

export const WHITEBOARD_PANEL_CHROME =
  'overflow-hidden rounded-xl border-[3px] border-[#EBEEF2] shadow-[0_1px_2px_rgba(0,0,0,0.05),0_6px_16px_rgba(0,0,0,0.08)]'

export const WHITEBOARD_HEADER_CHROME =
  'border-b border-[#E5E7EB] bg-[#F3F4F6]'

export const WHITEBOARD_FOOTER_CHROME =
  'border-t border-[#E5E7EB] bg-[#F3F4F6]'

/** Slot-mode inset so the book page peeks around the board card. */
export const WHITEBOARD_SLOT_INSET_PX = 12

/** Root scope for live class fullscreen UI (map + book overlay). Mint text selection is scoped here. */
export const FULLSCREEN_CLASS_SCOPE = 'fullscreen-class'

/** Full-height workspace strip on the left (matches `--fst-width` in globals.css). */
export const BOOK_WORKSPACE_LEFT_BAR_WIDTH = '2.75rem'
export const BOOK_WORKSPACE_LEFT_BAR_WIDTH_PX = 44
/** Docked solid bottom chrome height (keeps book clear of the bar). */
export const BOOK_BOTTOM_CHROME_HEIGHT = '2.5rem'
export const BOOK_BOTTOM_CHROME_HEIGHT_PX = 40
/** Page list panel width when open beside the left strip. */
export const BOOK_PAGE_LIST_RAIL_WIDTH_PX = 168

/** localStorage: teacher preference for hardcover book frame around the PDF spread (`1` / `0`). */
export const BOOK_FRAME_VISIBLE_STORAGE_KEY = 'esl-book-frame-visible'
