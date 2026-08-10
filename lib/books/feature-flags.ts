/**
 * Ink engine v2 rebuild (`docs/INK_ENGINE_V2.md`). Default **false** through R0–R7;
 * flip **true** only after phase gates pass (R8).
 */
export const inkEngineV2Enabled = false

/**
 * Live line-eraser preview while dragging (R2.5). **Off** — erase-on-lift (R2) only until R3 PaintEngine
 * can host a cheap mask overlay. Code remains; flip `true` to re-test punch-out / slice redraw paths.
 */
export const inkEraserLivePreviewEnabled = false

/**
 * R3 PaintEngine — incremental committed paint (append, punch-out erase, dirty-slice replay).
 * Default **on**; set `false` to restore legacy full-replay-on-non-append behavior.
 */
export const inkPaintEngineEnabled = true

/**
 * R4 React boundary — session ink pulls from store ref + revision; parent avoids full-doc `useState` on pen lift.
 * Default **on**; set `false` to restore `setSpreadSessionDoc(state.doc)` on every store emit.
 */
export const inkSessionReactBoundaryEnabled = true

/**
 * R5 Persist v2 — longer debounce while drawing, idle stringify for checkpoints, in-memory root cache.
 * Default **on**; set `false` to restore synchronous 3s autosave writes.
 */
export const inkSessionPersistV2Enabled = true

/**
 * R6 Page layer demotion — page storage holds DOM/non-session rows only while session ink is live.
 * Canvas ink commits on session store; per-page projection on flush/teardown only.
 * Default **on**; set `false` to restore page-layer merge-on-save (whiteboard) and full-row persist.
 */
export const inkSessionPageLayerDemotionEnabled = true

/**
 * R7 PDF memory budget — throttle idle neighbour prefetch while ink pointer is down or revision is hot.
 * Default **on**; set `false` to restore full prefetch concurrency during drawing.
 */
export const inkPdfMemoryBudgetEnabled = true

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
 * Phase 4b: directional spread slide — incoming pool + outgoing overlay slide on page turn.
 */
export const spreadSlideEnabled = false

/**
 * CSS scale on window resize without re-raster — off while open-book frame uses direct width sizing.
 * Re-enable only after a dedicated upscale-only path exists.
 */
export const spreadResizeScaleEnabled = false

/** Region focus zoom on book spread (`docs/BOOK_FOCUS_ZOOM_PHASED_PLAN.md`). */
export const bookFocusZoomEnabled = true

/**
 * Block trackpad pinch (`wheel` + ctrlKey) on the fullscreen book overlay so the browser
 * does not visual-viewport zoom layered PDF/ink. Set `false` to roll back step 1 only.
 */
export const bookBlockBrowserPinchZoomEnabled = true

/**
 * Live app-owned pinch zoom on the book spread (step 2). Implies browser pinch block.
 * Set `false` to keep step-1 block-only behavior.
 */
export const bookPinchZoomEnabled = true

/** Bottom chrome (undo/redo + spread nav) and thin left workspace bar. */
export const bookPageNavigationChromeEnabled = true

/** Linen weave + grain on the book mats (`book-overlay-material-bg--textured` / `book-overlay-reading-bg--textured` in app/globals.css). */
export const bookOverlayMaterialBgTextureEnabled = true

/** Fullscreen challenge map (tropical forest). Off = simple yellow mat + book launcher. */
export const challengeMapLayerEnabled = false

/**
 * Spread seam overlap (right page pulled left). Off for a clean side-by-side layout while tuning.
 * Re-enable when per-book gutter pull is ready again.
 */
export const spreadGutterOverlapEnabled = false

/**
 * Frame tuning: only hardcover boards + spine gutter strips stay visible.
 * Hides PDF, fore-edge page stack, crease lighting, ink, and whiteboard overlays.
 * Set to `false` before teaching or demos.
 */
export const bookSpreadHardcoverGutterOnlyForFrameTuning = false

/**
 * Hide PDF/page art inside the spread (implied when hardcover+gutter-only tuning is on).
 */
export const bookSpreadPageArtHiddenForFrameTuning =
  bookSpreadHardcoverGutterOnlyForFrameTuning

/**
 * Native PDF text selection in fullscreen reader (move / V tool).
 * Set `false` to roll back to flat-page-only behavior.
 */
export const bookPdfTextSelectionEnabled = true

/**
 * Live react-pdf as the primary page display once composited; prefetch cache only while loading.
 * Set `false` to restore cache-first display (Phase 1–2 behavior).
 */
export const bookReaderLivePdfPrimaryEnabled = true
