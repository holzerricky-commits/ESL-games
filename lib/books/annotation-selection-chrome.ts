/**
 * Shared visuals for select-tool selection chrome.
 * Each outline is a selection bounding box drawn with `SELECTION_BOX_SHADOW`.
 */

/** Primary selection ring (vibrant blue). */
export const SELECTION_ACCENT = '#3b82f6'

/** Marquee crossing-mode accent. */
export const SELECTION_CROSSING_ACCENT = '#10b981'

/** Single vibrant ring — no white underlay halo. */
export const SELECTION_BOX_SHADOW = '0 0 0 2px rgba(59, 130, 246, 0.92)'

export const SELECTION_MARQUEE_WINDOW_CLASS =
  'box-border border border-blue-500/80 bg-blue-500/12'

export const SELECTION_MARQUEE_CROSSING_CLASS =
  'box-border border border-dashed border-emerald-500/60 bg-emerald-500/8'

/** Square handle size on screen (px). */
export const SELECTION_HANDLE_SIZE_PX = 8

/** Pointer hit radius around handle center (px). */
export const SELECTION_HANDLE_HIT_RADIUS_PX = 10

export const SELECTION_HANDLE_CLASS =
  'absolute box-border rounded-[1px] border-2 border-[#3b82f6] bg-white shadow-sm pointer-events-none'
