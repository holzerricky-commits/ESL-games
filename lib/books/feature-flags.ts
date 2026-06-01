/** Phase 2: render read-only spread session overlay for parity checks. */
export const spreadSessionEditingEnabled = false

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
