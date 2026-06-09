/**
 * Shared visuals for select-tool selection chrome.
 * Flat baby-blue box with solid corner squares (text-box style).
 */

/** Primary selection accent — bright baby blue. */
export const SELECTION_ACCENT = '#7FD9FF'

/** Marquee crossing-mode accent. */
export const SELECTION_CROSSING_ACCENT = '#10b981'

/** Selection outline stroke width (px). */
export const SELECTION_BOX_BORDER_WIDTH_PX = 2

/** Solid outline matching text-box selection mockup. */
export const SELECTION_BOX_BORDER = `${SELECTION_BOX_BORDER_WIDTH_PX}px solid ${SELECTION_ACCENT}`

/** @deprecated Use SELECTION_BOX_BORDER on outline rects. */
export const SELECTION_BOX_SHADOW = SELECTION_BOX_BORDER

export const SELECTION_MARQUEE_WINDOW_CLASS =
  'box-border border-2 border-[#7FD9FF]/85 bg-[#7FD9FF]/12'

export const SELECTION_MARQUEE_CROSSING_CLASS =
  'box-border border border-dashed border-emerald-500/60 bg-emerald-500/8'

/** Solid square corner handle size (px). */
export const SELECTION_HANDLE_SIZE_PX = 8

/** Pointer hit radius around handle center (px). */
export const SELECTION_HANDLE_HIT_RADIUS_PX = 10

/** Corner-only handles — solid fill, no white, no shadow. */
export const SELECTION_HANDLE_CLASS = 'absolute box-border pointer-events-none'

/** Rotation handle circle diameter (px). */
export const SELECTION_ROTATION_HANDLE_SIZE_PX = 8

const ROTATION_CURSOR_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18.5 8.5A7.5 7.5 0 1 0 20 12" stroke="#7FD9FF" stroke-width="2" stroke-linecap="round"/><path d="M20 6v6h-5" stroke="#7FD9FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)

/** Circular-arrow cursor for the rotation handle (falls back to grab). */
export const SELECTION_ROTATION_CURSOR = `url("data:image/svg+xml,${ROTATION_CURSOR_SVG}") 12 12, grab`

export const SELECTION_ROTATION_CURSOR_ACTIVE = `url("data:image/svg+xml,${ROTATION_CURSOR_SVG}") 12 12, grabbing`

export function cursorForRotationHandle(active = false): string {
  return active ? SELECTION_ROTATION_CURSOR_ACTIVE : SELECTION_ROTATION_CURSOR
}
