import type { CSSProperties } from 'react'

export const ANNOTATION_TEXT_FONT_NORM_STEPS = [0.016, 0.02, 0.024, 0.028, 0.032, 0.038, 0.046] as const

/** Equal vertical margin above and below the book spread (centered in the overlay). */
export const BOOK_OVERLAY_VIEWPORT_MARGIN_Y = '3.5rem'
export const BOOK_OVERLAY_VIEWPORT_CONTENT_HEIGHT = `calc(100vh - 2 * ${BOOK_OVERLAY_VIEWPORT_MARGIN_Y})`

/** Shared glass chrome for toolbox, page nav, and class timer on the book overlay. */
export const BOOK_OVERLAY_GLASS_CHROME =
  'border border-white/10 bg-black/24 text-white/65 shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[1.5px]'

/**
 * Lesson paper + vocab notebook panels in the fullscreen book overlay.
 * Off for now; notebook code stays for a future behind-the-book experience.
 */
export const BOOK_OVERLAY_NOTEBOOK_UI_ENABLED = false

export function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

/** Dot-grid canvas — near-white with a faint warm tint; neutral gray dots. */
export const WHITEBOARD_NOTEBOOK_SURFACE: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'> = {
  backgroundColor: '#FDFCFB',
  backgroundImage: 'radial-gradient(circle, rgba(75, 85, 99, 0.22) 0.7px, transparent 0.82px)',
  backgroundSize: '20px 20px',
}

export const WHITEBOARD_HEADER_HEIGHT_PX = 36

/** Neutral toolbar/card tokens (gray header, soft borders, elevation-2 shadow). */
export const WHITEBOARD_HEADER_BG = '#F3F4F6'
export const WHITEBOARD_BORDER_COLOR = '#EBEEF2'

export const WHITEBOARD_PANEL_CHROME =
  'overflow-hidden rounded-xl border-[3px] border-[#EBEEF2] shadow-[0_1px_2px_rgba(0,0,0,0.05),0_6px_16px_rgba(0,0,0,0.08)]'

export const WHITEBOARD_HEADER_CHROME =
  'border-b border-[#E5E7EB] bg-[#F3F4F6]'

/** Slot-mode inset so the book page peeks around the board card. */
export const WHITEBOARD_SLOT_INSET_PX = 12
