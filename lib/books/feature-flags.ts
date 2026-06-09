/** Phase 1 spread ink: one annotation layer per two-page spread (`docs/SPREAD_INK_PHASED_PLAN.md`). */
export const spreadSessionEditingEnabled = true

/**
 * Book highlighter on spread-level multiply band (z-[25]) instead of per-page slots.
 * Off by default — can cover in-page text; enable only if per-page paint stays invisible.
 */
export const spreadMarkerSpreadOverlayFallbackEnabled = false

/**
 * Whiteboard fast session ink (shipped Phase 5). Set `false` to restore legacy board canvas path.
 */
export const whiteboardInkSessionEnabled = true

/** Phase 2 stable pages: mount a sliding window of page views instead of remounting slots on turn. */
export const pageViewPoolEnabled = true

/**
 * Phase 4: opacity crossfade — **off** per `docs/READER_INSTANT_TURN_PLAN.md` (instant cut).
 * Re-enable only with safe cleanup (incoming layer must not stay at opacity 0).
 */
export const spreadCrossfadeEnabled = false

/**
 * Phase 4b: directional spread slide — **off** (same instant-turn plan; no slide/crossfade default).
 */
export const spreadSlideEnabled = false

/** Phase 5: CSS scale on window resize; native browser zoom on Ctrl +/- (no re-raster). */
export const spreadResizeScaleEnabled = true
