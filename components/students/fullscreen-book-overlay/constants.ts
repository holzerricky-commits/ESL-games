import type { CSSProperties } from 'react'

export const ANNOTATION_TEXT_FONT_NORM_STEPS = [0.016, 0.02, 0.024, 0.028, 0.032, 0.038, 0.046] as const

/** `public/Full Screen Book Overlay/Book Opened.png` — preload from fullscreen map (task B4). */
export const BOOK_OPENED_FRAME_IMAGE_SRC = '/Full%20Screen%20Book%20Overlay/Book%20Opened.png'

const PRELOAD_BOOK_FRAME_LINK_ID = 'preload-fs-book-opened-frame'

/** Idempotent `<link rel="preload" as="image">` so the frame is warming while the map is idle. */
export function preloadBookOpenedFrameImage(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(`link#${PRELOAD_BOOK_FRAME_LINK_ID}`)) return
  const link = document.createElement('link')
  link.id = PRELOAD_BOOK_FRAME_LINK_ID
  link.rel = 'preload'
  link.as = 'image'
  link.href = BOOK_OPENED_FRAME_IMAGE_SRC
  document.head.appendChild(link)
}

export function removeBookOpenedFramePreload(): void {
  if (typeof document === 'undefined') return
  document.getElementById(PRELOAD_BOOK_FRAME_LINK_ID)?.remove()
}

export function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

/** Dot-grid notebook paper (dots only, no lines or grid squares). */
export const WHITEBOARD_NOTEBOOK_SURFACE: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'> = {
  backgroundColor: '#f8f7f4',
  backgroundImage: 'radial-gradient(circle, rgba(72, 52, 38, 0.2) 0.65px, transparent 0.78px)',
  backgroundSize: '20px 20px',
}
