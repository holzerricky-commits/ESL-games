/** Debounced checkpoint interval when not actively drawing (R5 idle). */
export const INK_SESSION_AUTOSAVE_MS = 3000

/** Longer debounce while pointer is hot / recent strokes (R5). */
export const INK_SESSION_AUTOSAVE_MS_DRAWING = 12_000

/** After each stroke, treat drawing as active for this long (R5 autosave pick). */
export const INK_SESSION_DRAWING_HOT_MS = 15_000

/** Max wait before idle checkpoint runs even if browser stays busy (R5). */
export const INK_SESSION_IDLE_CHECKPOINT_TIMEOUT_MS = 1500

/** Disk payload debounce when R5 persist v2 is on (batch after idle stringify). */
export const INK_SESSION_DISK_PERSIST_DEBOUNCE_MS = 2000

/** @deprecated Use INK_SESSION_AUTOSAVE_MS */
export const SPREAD_SESSION_AUTOSAVE_MS = INK_SESSION_AUTOSAVE_MS
