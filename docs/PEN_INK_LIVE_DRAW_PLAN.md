# Pen ink — live draw & tap plan

**Milestone tie-in:** Phase 1 lesson ritual — annotate the book without lag or “lost” taps.

**How we ship:** One task at a time → you test → keep or revert → then the next.

---

## Tasks

| # | Task | Status | Test focus |
|---|------|--------|------------|
| **1** | **Pen tap dot** — visible while touching; **saves** on click/tap without drag. Marker **cursor** unchanged. | **Done** | Tap with pen: dot appears on down, stays after release. Drag still works. |
| **2** | **No jump on release** — live preview and saved ink use the same coordinates (spread scale / commit path). | **Done** | Draw short stroke; ink should not shift down/up when you lift. |
| **3** | **Faster solid pen while dragging** — one paint pass live; full quality on release. Soft/transparent profiles stay rich live. | **Done** | Solid pen feels tighter to the finger; brush/pencil still look soft while drawing. |
| **4** | **Spread incremental paint** — append new segment instead of full canvas clear each move. | **Done** | Two-page spread: smooth drag, less lag. |
| **5** | **Defer page-target update** — only when left/right page actually changes. | **Done** | No regression; optional perf win on touch down. |
| **6** | **Preload effect pen tiles** — rainbow/galaxy ready before first stroke. | **Ready to test** | First effect stroke not plain-then-pop. |

**Later / optional**

- Highlighter tap dot (no cursor change).
- Native capture-phase pointer on draft canvas (only if still laggy after 1–4).

---

## Task 1 — implementation notes

- Shared helper: `lib/books/stroke-tap-dot.ts` — `ensureStrokeCommitPoints` so taps are not dropped when down/up are the same pixel.
- Wire into spread commit (`BookSpreadStrokeOverlay`) and single-page commit (`BookPageAnnotationLayer`).
- Pen live preview already draws a cap dot for one point; task 1 is mainly **commit**, not marker cursor.

## Task 2 — implementation notes

- Spread pen/marker commit uses `splitSpreadNormPolylineToPageNormalizedChains` (same normalized space as live preview), not `splitSpreadNormPolylineViaClientRects` (page PDF boxes can sit lower → ink jumped down on release).
- `finalizeStrokeDraftEndPoint` ignores tiny release jitter so lift position does not nudge the stroke.

## Task 3 — implementation notes

- `lib/books/annotation-live-pen-paint.ts` — `penStrokeUsesRichLivePaint` (brush/pencil/effect = rich live; solid pen + fine-liner = fast live).
- `drawStrokePath` option `livePaintFast`: one pen pass while dragging; committed replay omits it (full profile on page).

## Task 4 — implementation notes

- `lib/books/incremental-stroke-draft-paint.ts` — append-only segment when point count grows (spread overlay draft canvases).
- Full redraw on pointer down, resize, straight-line snap, or tool change.

## Task 5 — implementation notes

- `lib/books/annotation-target-page.ts` — `annotationTargetPageIfChanged` used by `setAnnotationTargetPage` in `useAnnotationController`.
- Spread overlay compares `targetPage !== annotationTargetPage` before calling setter on pointer down.

## Task 6 — implementation notes

- `lib/books/effect-pen-preload.ts` — `preloadAllEffectPenResources` on book open; preload active effect when swatch/profile changes.
- `warmProceduralPenInkTiles` in `pen-ink.ts` for non-PNG effect ids.
- Spread overlay repaints live draft when a PNG tile finishes loading (`subscribeBrushPatternTileLoads`).

---

## Changelog

| Date | Task | Note |
|------|------|------|
| 2026-06-01 | 1 | Plan created; `ensureStrokeCommitPoints` wired in spread + page commit paths. |
| 2026-06-01 | 2 | Spread commit aligned to live preview coords; release jitter guard on finalize. |
| 2026-06-01 | 3 | `livePaintFast` for solid pen live draft on spread + page layers. |
| 2026-06-01 | 4 | Spread live stroke incremental append (no full canvas clear each move). |
| 2026-06-01 | 5 | Guarded `setAnnotationTargetPage`; spread overlay skips redundant updates. |
| 2026-06-01 | 6 | Effect pen preload on open + profile/swatch; spread live repaint on tile load. |
