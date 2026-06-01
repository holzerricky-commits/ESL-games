# Fullscreen book — stable pages architecture

Phased refactor from **prefetch bridge + react-pdf + opacity gates** to **PageRenderCache + PageViewPool + SpreadStage + FlipLayer**.

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Cache as display | Done |
| 2 | Page view pool (stable DOM) | Done |
| 3 | Open polish | Done |
| 4 | Page flip animation | Done (crossfade v1 fallback) |
| 4b | Directional spread slide | Done |
| 5 | Resize / zoom polish | Done |
| 4c | Page flip curl (3D) | Deferred |

## Decision log

- **Prefetch window:** ±10 visible-list slots (~5 two-page spreads each way).
- **LRU cap:** 48 entries at 32px width buckets.
- **Flip v1:** crossfade (legacy fallback when slide off).
- **Flip v2:** directional spread slide — incoming pool + annotations slide together; outgoing captured with ink before turn.
- **Pool size (Phase 2):** default ±8 PDF indices in DOM.

---

## Phase 1 — Cache as display

**Goal:** Users see cached bitmaps immediately; react-pdf loads off-screen for handoff and annotations. Fewer opacity / present-reset loops. Page turns keep the current spread visible until the target spread is cache-ready.

### Tasks

- [x] Expand prefetch window to ±10 slots; raise LRU cap to 48 (`reader-prefetch-window.ts`).
- [x] Add `page-render-cache.ts` aliases over bitmap LRU (`reader-page-prefetch-queue.ts`).
- [x] Add `CachedPageCanvas` — draw `ImageBitmap` on first layout frame.
- [x] `ReaderPageSlot`: cache-first visibility; defer parent ready callbacks when `confirmSlotPixelsReady` is false; remove present-flip reset.
- [x] `useGatedBookNavigation`: hold turn until target spread cache-hit; subscribe cache.
- [x] Controller: drop `firstSpreadPaintSession` bump on map present; prefer cache-aware reveal.
- [x] Map warm-up: same width heuristic as overlay (`heuristicBookOverlaySpreadPageWidthPx`).
- [x] Tests: `reader-prefetch-window.test.ts` updated for ±10.

### Files

| Action | Path |
|--------|------|
| Modify | `lib/books/reader-prefetch-window.ts` |
| Add | `lib/books/page-render-cache.ts` |
| Modify | `lib/books/reader-page-prefetch-queue.ts` (comments / exports) |
| Add | `components/students/fullscreen-book-overlay/sections/CachedPageCanvas.tsx` |
| Modify | `components/students/fullscreen-book-overlay/sections/ReaderPageSlot.tsx` |
| Modify | `components/students/fullscreen-book-overlay/hooks/useGatedBookNavigation.ts` |
| Modify | `components/students/fullscreen-book-overlay/hooks/useFullscreenBookOverlayController.ts` |
| Modify | `lib/books/map-initial-book-spread-warmup.ts` |

### Acceptance

1. Hard refresh → map → open book: no white block if warm hit; no full remount on present.
2. Turn forward/back on prefetched pages: instant bitmap; old spread stays until target cached.
3. Annotations still draw on spread.
4. `npm test -- reader-prefetch-window` passes.

### Removed / simplified (Phase 1)

- Present-time `firstSpreadPaintSession` bump that discarded warm slots.
- Slot `confirm` transition that forced `opacity-0` + pdf reset on present.
- Immediate page commit before cache (restored turn gating).

### Deferred to Phase 2+

- Page view pool (no remount on turn).
- Flip layer.
- Resize without paint invalidation beyond width-bucket rules.

---

## Phase 2 — Page view pool

**Goal:** Stable DOM for ±N pages; change visibility instead of remounting `ReaderPageSlot` keys.

- [x] `page-view-pool-model.ts` — ±8 window, slot roles, pool diff.
- [x] `PageView` — CachedPageCanvas + ReaderPageSlot + annotations; stable key by PDF index.
- [x] `PageViewPool` — sliding window keyed by PDF page index.
- [x] `SpreadStage` — spread layout delegates to pool; gutter + overlays unchanged.
- [x] `BookCanvasStage` — pool path behind `pageViewPoolEnabled`; legacy slot path retained.
- [x] Navigation updates active index without unmounting neighbours in window.
- [x] Remove per-turn `key={slot-l-${pageNumber}}` remount pattern (pool path).
- [x] Tests: `page-view-pool-model.test.ts`.

### Files

| Action | Path |
|--------|------|
| Add | `lib/books/page-view-pool-model.ts` |
| Add | `lib/books/page-view-pool-model.test.ts` |
| Modify | `lib/books/feature-flags.ts` (`pageViewPoolEnabled`) |
| Add | `components/students/fullscreen-book-overlay/sections/PageView.tsx` |
| Add | `components/students/fullscreen-book-overlay/sections/PageViewPool.tsx` |
| Add | `components/students/fullscreen-book-overlay/sections/SpreadStage.tsx` |
| Modify | `components/students/fullscreen-book-overlay/sections/BookCanvasStage.tsx` |
| Modify | `components/students/fullscreen-book-overlay/sections/ReaderPageSlot.tsx` |
| Modify | `components/students/fullscreen-book-overlay/fullscreen-book-overlay-view.tsx` |

### Acceptance

1. Turn forward/back within ±8: no remount of pooled page views (same DOM nodes).
2. Annotations, whiteboard slot, spread gutter layout unchanged.
3. Turn gating + cache-first display from Phase 1 still apply.
4. `npm test -- reader-prefetch-window page-view-pool-model` passes.

---

## Phase 3 — Open polish

**Goal:** Single drawable contract; shrink `spreadContentRevealed` / `viewportPaintHold` stack.

### Tasks

- [x] Add `spread-drawable-ready.ts` — `isSpreadDrawableReady`, `shouldShowSpreadLoadingHold` (layout + slot pixels or present + cache).
- [x] Controller: replace `spreadContentRevealed`, `spreadFirstPaintReady` with `spreadDrawableReady` + timeout fallback.
- [x] Rename `firstSpreadPaintSession` → `spreadReportEpoch`; no present-time bump.
- [x] View: `showSpreadLoadingHold` + `bookStageEnterVisible` driven by `spreadDrawableReady`.
- [x] `BookCanvasStage`: drop parallel `onFirstSpreadPaintReady` / pdf-only paint path; slot pixels only.
- [x] `PageView` / `PageViewPool`: remove `onActiveSpreadPaintReady`.
- [x] Tests: `spread-drawable-ready.test.ts`.

### Files

| Action | Path |
|--------|------|
| Add | `lib/books/spread-drawable-ready.ts` |
| Add | `lib/books/spread-drawable-ready.test.ts` |
| Modify | `lib/books/first-spread-paint-ready-contract.ts` (re-export) |
| Modify | `hooks/useFullscreenBookOverlayController.ts` |
| Modify | `fullscreen-book-overlay-view.tsx` |
| Modify | `sections/BookCanvasStage.tsx` |
| Modify | `sections/PageView.tsx`, `PageViewPool.tsx` |

### Acceptance

1. Map click → chrome fades in; spread already painted under hold when cache hit (no extra present bump).
2. Cold open without cache: paper-tone spinner until slots or timeout; no white flash.
3. `onBookReadyToPresent` fires when `spreadDrawableReady` (map HUD).
4. Phase 2 pool + turn gating unchanged.
5. `npm test -- reader-prefetch-window page-view-pool-model spread-drawable-ready` passes.

### Removed / simplified (Phase 3)

- `spreadContentRevealed` state (derived `spreadDrawableReady`).
- `spreadFirstPaintReady` + `onFirstSpreadPaintReady` parallel gate.
- `onActiveSpreadPaintReady` on pool path (pdf-only, duplicated slot contract).
- Present effect that manually set `spreadSlotsPixelsReady` on cache hit.

---

## Phase 4 — Page flip animation

**Goal:** Crossfade v1 between spreads using pre-cached next spread; curl v2 optional.

**Superseded for teacher reader (2026-06):** `docs/READER_INSTANT_TURN_PLAN.md` — both `spreadCrossfadeEnabled` and `spreadSlideEnabled` stay **off** (instant cut; soft placeholder only when sharp not ready).

### Tasks

- [x] `spreadCrossfadeEnabled` feature flag (fallback when slide off) — **default off** per instant-turn plan.
- [x] `spreadSlideEnabled` feature flag — **default off** per instant-turn plan (was built default-on; product chose instant cut).
- [x] `SPREAD_TURN_SLIDE_MS` + `useSpreadTurnSlide` hook.
- [x] Pre-turn spread capture (`captureSpreadForTurn`) preserves outgoing annotations in slide-out layer.
- [x] `SpreadTurnSlideOutgoing` + incoming `PageViewPool` translate together.
- [ ] Curl / 3D flip (deferred v3).

### Files

| Action | Path |
|--------|------|
| Add | `lib/books/spread-crossfade-config.ts` |
| Add | `lib/books/spread-crossfade-config.test.ts` |
| Modify | `lib/books/feature-flags.ts` |
| Add | `hooks/useSpreadCrossfade.ts` |
| Add | `sections/SpreadTurnCrossfade.tsx` |
| Modify | `sections/SpreadStage.tsx` |

### Acceptance

1. Turn forward/back on prefetched spread: ~160ms crossfade, no blank frame.
2. `prefers-reduced-motion: reduce`: instant turn (no crossfade).
3. Turn gating + pool from Phases 1–2 unchanged.
4. Set `spreadCrossfadeEnabled = false` to disable.

---

## Phase 5 — Resize / zoom polish

**Goal:** Pure CSS scale on window resize; native browser zoom on Ctrl +/-; no re-raster or white flash.

### Tasks

- [x] `spreadResizeScaleEnabled` feature flag (default on).
- [x] Render width stable during drag; `spreadDisplayScale` = target / render (CSS scale on spread cluster).
- [x] No debounced bucket commit on resize — render width only changes on book/unit/layout mode.
- [x] Browser zoom: skip `targetSpreadPageWidth` sync when DPR changes (`spread-viewport-zoom.ts`).
- [x] `useBrowserZoomRepaintRevision` — repaint cached page canvases after zoom wipe.
- [x] `ReaderPageSlot` — prefer cache again after zoom when pdf had taken over.
- [x] Annotation / spread session / stroke overlay canvases repaint on DPR change.

### Files

| Action | Path |
|--------|------|
| Add | `lib/books/spread-resize-config.ts` |
| Add | `lib/books/spread-resize-config.test.ts` |
| Add | `lib/books/spread-viewport-zoom.ts` |
| Add | `lib/books/spread-viewport-zoom.test.ts` |
| Add | `hooks/useBrowserZoomRepaintRevision.ts` |
| Modify | `lib/books/spread-drawable-ready.ts` |
| Modify | `lib/books/feature-flags.ts` |
| Modify | `hooks/useBookViewportLayout.ts` |
| Modify | `hooks/useFullscreenBookOverlayController.ts` |
| Modify | `sections/CachedPageCanvas.tsx`, `ReaderPageSlot.tsx` |
| Modify | `book-page-annotation-layer.tsx`, `book-spread-session-layer.tsx`, `book-spread-stroke-overlay.tsx` |

### Acceptance

1. Resize browser window while reading: spread scales smoothly via CSS, no white flash, no re-raster.
2. Ctrl+ / Ctrl- zoom: pages stay visible (native zoom + cache repaint); annotations/strokes repaint.
3. Book/unit/lesson-paper layout change still commits new render width when needed.
4. Set `spreadResizeScaleEnabled = false` to restore legacy min-width render path.

---

## Migration

Ship phase-by-phase. Annotations remain z-index siblings above `CachedPageCanvas`. Whiteboard and spread session unchanged in Phase 1.

## Rollback

Phase 1: revert `ReaderPageSlot`, `useGatedBookNavigation`, and controller present effect; keep ±10 prefetch if harmless.
