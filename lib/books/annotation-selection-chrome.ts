/**
 * Shared visuals for select-tool selection chrome.
 * Flat blue box with solid handles centered on edges.
 */

/** Primary selection accent — saturated flat UI blue. */
export const SELECTION_ACCENT = '#3b82f6'

/** Selection outline stroke width (px). */
export const SELECTION_BOX_BORDER_WIDTH_PX = 1.5

/** Solid outline matching text-box selection mockup. */
export const SELECTION_BOX_BORDER = `${SELECTION_BOX_BORDER_WIDTH_PX}px solid ${SELECTION_ACCENT}`

/** Dashed outline for select-tool hover preview (click target before selection). */
export const SELECTION_HOVER_BOX_BORDER = `${SELECTION_BOX_BORDER_WIDTH_PX}px dashed ${SELECTION_ACCENT}`

/** Neutral accent for multi-selection union outline. */
export const SELECTION_MULTI_UNION_ACCENT = '#94a3b8'

/** Dotted outline around the combined multi-selection bounds. */
export const SELECTION_MULTI_UNION_BORDER = `${SELECTION_BOX_BORDER_WIDTH_PX}px dotted ${SELECTION_MULTI_UNION_ACCENT}`

/** @deprecated Use SELECTION_BOX_BORDER on outline rects. */
export const SELECTION_BOX_SHADOW = SELECTION_BOX_BORDER

/** Marquee crossing-mode accent — same weight as window, slightly greener. */
export const SELECTION_CROSSING_ACCENT = '#10b981'

export const SELECTION_MARQUEE_WINDOW_CLASS =
  'box-border border-2 border-[#3b82f6]/85 bg-[#3b82f6]/12'

export const SELECTION_MARQUEE_CROSSING_CLASS =
  'box-border border-2 border-[#10b981]/85 bg-[#10b981]/12'

/** Solid square handle size (px). */
export const SELECTION_HANDLE_SIZE_PX = 9

/** Pointer hit radius around handle center (px). */
export const SELECTION_HANDLE_HIT_RADIUS_PX = 13

/** Corner / edge handles — solid fill, no shadow. */
export const SELECTION_HANDLE_CLASS = 'absolute box-border pointer-events-none'

/** Rotation handle circle diameter (px). */
export const SELECTION_ROTATION_HANDLE_SIZE_PX = 9

const ROTATION_CURSOR_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18.5 8.5A7.5 7.5 0 1 0 20 12" stroke="#374151" stroke-width="2" stroke-linecap="round"/><path d="M20 6v6h-5" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)

/** Neutral curved-arrow cursor for the rotation handle. */
export const SELECTION_ROTATION_CURSOR = `url("data:image/svg+xml,${ROTATION_CURSOR_SVG}") 12 12, alias`

export const SELECTION_ROTATION_CURSOR_ACTIVE = `url("data:image/svg+xml,${ROTATION_CURSOR_SVG}") 12 12, grabbing`

export function cursorForRotationHandle(active = false): string {
  return active ? SELECTION_ROTATION_CURSOR_ACTIVE : SELECTION_ROTATION_CURSOR
}
