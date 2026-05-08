import type { CSSProperties } from 'react'

export const ANNOTATION_TEXT_FONT_NORM_STEPS = [0.016, 0.02, 0.024, 0.028, 0.032, 0.038, 0.046] as const

export function makeUnitFileUrl(filePath: string): string {
  return `/api/book-file?path=${encodeURIComponent(filePath)}`
}

/** Dot-grid notebook paper (dots only, no lines or grid squares). */
export const WHITEBOARD_NOTEBOOK_SURFACE: Pick<CSSProperties, 'backgroundColor' | 'backgroundImage' | 'backgroundSize'> = {
  backgroundColor: '#f8f7f4',
  backgroundImage: 'radial-gradient(circle, rgba(72, 52, 38, 0.2) 0.65px, transparent 0.78px)',
  backgroundSize: '20px 20px',
}
