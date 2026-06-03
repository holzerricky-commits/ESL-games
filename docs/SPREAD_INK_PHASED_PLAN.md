# Spread ink — phased plan

**Milestone tie-in:** Phase 1 lesson ritual — annotate the two-page book view without lag, seam splits, or lost work.

**Model:** One ink surface per **spread** (left page + right page pair). Coordinates are **spread-normalized** (0…1 across the full two-page width). Each spread has its own saved document; turning the page loads another spread’s ink.

**How we ship:** One phase at a time → test with the script below → keep or revert → next phase.

---

## Test script (repeat after every phase)

1. Pen **tap** — dot appears and stays after lift.
2. One **letter** — no jump on release.
3. **20 letters** quickly — no growing pause after each lift.
4. **Long curve** across the **seam** — one continuous line.
5. **Turn page** — previous spread ink saved; new spread empty or loads its own ink.
6. **Reload** book on same spread — ink returns.

---

## Phases

| Phase | Name | Status | Outcome |
|-------|------|--------|---------|
| **0** | Baseline | Done (informal) | Pen live-draw plan tasks 1–6; spread session code exists behind flag. |
| **1** | **Spread owns ink** | **Done** | Two-page view: one spread command list + `BookSpreadSessionLayer`; no per-lift split to left/right page layers; hydrate from pages only when spread save is empty. |
| **2** | Cheap commit on lift | **Done** | `appendCommand` on spread store; incremental **committed** paint (draw only new stroke, not full replay); undo/redo via store; no mirror full-array sync. |
| **3** | Save per spread | **Done** | Debounced spread checkpoint (3s, resets on edit); flush on spread teardown / close / unload; tab hide checkpoints spread only. |
| **4** | Live draw quality | **Done** | Full-stroke live redraw on spread (incremental off); coalesced pointer samples; rAF-batched repaint while dragging. |
| **5** | Tools parity on spread | **Done** | Eraser, shapes, select, undo one stack; marker multiply layers. |
| **6** | Polish | **Done (code)** | Dev UI removed; flag-only session; docs/rules; manual perf budget (no runtime cap). **You:** run test gate below. |

---

## Phase 1 — implementation notes

- `spreadSessionEditingEnabled = true` in `lib/books/feature-flags.ts`.
- `BookSpreadStrokeOverlay`: in `spreadSessionMode`, commit **one** spread-normalized stroke (no `splitSpreadNormPolylineToPageNormalizedChains` on lift).
- `BookCanvasStage`: prefer spread session storage; hydrate from per-page files only when spread doc is empty.
- `spreadSessionStore.syncCommands` — mirror overlay ↔ store without polluting undo stack.
- `BookPageAnnotationLayer` + `pageLayerCanvasCommandsWhenSpreadInkDelegated` — hide pen/marker/shape canvas ink on pages while spread layer shows it (text/sticky/stamps stay on pages).
- `BookSpreadSessionLayer` at z-[24]; live draft overlay at z-[30].

## Live vs committed incremental (clarification)

| Kind | When | Phase |
|------|------|-------|
| **Live incremental** (append segment while dragging) | Pointer move | Already shipped (task 4 pen plan); may disable in Phase 4 if joins look rough. |
| **Committed incremental** (paint only new stroke on lift) | Pointer up | Phase 2 — **not** the same as live incremental. |

---

## Changelog

| Date | Phase | Note |
|------|-------|------|
| 2026-06-01 | — | Plan created. |
| 2026-06-01 | 1 | Spread session enabled; spread-owned commit; page layer canvas filter; hydrate fix; `syncCommands` on store. |
| 2026-06-01 | 2 | `appendCommand` + append-only undo; incremental spread session layer paint; store-driven toolbar undo/redo. |
| 2026-06-01 | 3 | Debounced autosave; persist on store destroy/teardown; visibility/pagehide/beforeunload guards; store lifecycle scoped to spread key. |
| 2026-06-01 | 4 | Full live spread draft redraw; `createRafCoalescer` on pointermove; coalesced events unchanged. |
| 2026-06-01 | 5 | Spread select/undo via session store; eraser-line on spread layer; per-marker multiply slices. |
| 2026-06-01 | 6 | Safe polish: dev session UI removed; `spreadSessionEditingEnabled` only; no runtime incremental cap. |

## Phase 6 — implementation notes (safe v2)

- Removed dev overlay (`spread-session rev…`) and `session: on/off` toggle from `BookCanvasStage`.
- Spread session follows `spreadSessionEditingEnabled` in `feature-flags.ts` only (no in-reader toggle).
- Removed unused `onSpreadSessionStoreReady` / store-revision re-render bump.
- Updated `.cursor/rules/spread-effect-pen-ink.mdc` for session commit model.

### Phase 6 — explicit non-goals (v1)

- **No** `spread-session-perf-config.ts` or runtime command-count guard on incremental paint (reverted Phase 6 caused full replay slowdown).
- **No** changes to `BookSpreadSessionLayer` paint path, autosave timing, or marker slice pooling.

### Phase 6 — manual perf budget

Repeat test script item **3** (20 letters quickly) after this phase. Lift must stay as snappy as Phase 5. Regressions → `PARKING_LOT.md`, not new runtime caps.

### Phase 6 — test checklist

- [ ] **20 letters fast** — no growing pause (primary gate).
- [ ] Pen tap + one letter — no jump on release.
- [ ] Long curve across seam — one line.
- [ ] Undo one letter while pen active.
- [ ] Turn spread / reload — ink returns.
- [ ] No `session: on/off` button or debug overlay in dev reader.

## Phase 5 — implementation notes

- `spread-session-select-proxy.ts` — select/undo keyboard + toolbar delegate to spread session store.
- `useAnnotationController` — shared `spreadSessionStoreRef`; toolbar undo/redo in select + draw modes.
- `BookSpreadSessionLayer` — `buildAnnotationRenderSlices` + per-marker multiply canvases; eraser-line dead-index preview.
- `BookSpreadStrokeOverlay` — eraser-line live draft on spread session (not split to pages when session on).
- `spread-session-store.selectNextInStack` — respects eraser-line dead indices (`selectNextStackId`).

### Phase 5 — test checklist

- [ ] Pixel eraser on spread — strokes erase; undo restores.
- [ ] Eraser-line on spread — live preview hides ink; commit persists; undo.
- [ ] Highlighter crosses — overlap darkens (multiply per stroke).
- [ ] Select tool — tap/marquee/move/delete; Cmd+Z undo one stack.
- [ ] Shapes (line/rect/arrow) on spread — commit + undo.
- [ ] Turn spread / reload — all tools’ ink still saved.

## Phase 4 — implementation notes

- `spread-live-draw-config.ts` — `spreadLiveStrokeIncrementalPaintEnabled = false` (smoother joins).
- `spreadLiveStrokeRafCoalesceEnabled = true` — one live repaint per animation frame while dragging.
- `lib/books/raf-coalesce.ts` — shared rAF coalescer (`schedule` / `flush` / `cancel`).
- Pointer down uses **flush** (immediate dot); pointer move uses **schedule**; up/cancel **cancel** pending frame.
- Coalesced pointer samples (`getCoalescedEvents`) still applied on each move before scheduling paint.

### Phase 4 — test checklist

- [ ] Long curve across spread — smooth, no visible segment kinks while dragging.
- [ ] Pen tap — dot on down, no jump on lift.
- [ ] Fast scribble — ink follows finger without obvious stutter.
- [ ] Effect pen first stroke — still loads pattern (Phase 1–6 preload unchanged).

## Phase 3 — implementation notes

- `SPREAD_SESSION_AUTOSAVE_MS` (3s) — debounce **resets** on each edit (`spread-session-store`).
- `destroy()` / effect cleanup — checkpoint spread + project to per-page before dropping store.
- `useSpreadSessionPersistGuards` — spread checkpoint on tab hide; checkpoint + page flush on unload.
- `requestSpreadSessionFlush` (close overlay, etc.) — unchanged; still projects to per-page storage.
- Spread session store effect deps **no longer** include layout (seam/resize) — avoids remount on measure.

### Phase 3 — test checklist

- [ ] Draw, wait 3+ s, refresh — ink still on spread (`bookSpreadSessionV1`).
- [ ] Draw, turn spread within 3 s — ink saved on **previous** spread.
- [ ] Close book overlay — ink on spread + per-page projection.
- [ ] Switch browser tab away and back — no lost strokes.

## Phase 2 — implementation notes

- `spread-session-store.appendCommand` — O(1) extend; undo removes one command by id.
- `BookSpreadStrokeOverlay` commits via `onSpreadSessionAppendCommand` (no mirror / full `syncCommands` per stroke).
- `BookSpreadSessionLayer` — committed incremental paint via `canIncrementallyAppendSpreadSessionCommands`.
- Toolbar undo/redo while drawing on spread uses spread store (`onSpreadOverlayCaps` from store subscribe).

### Phase 1 — test checklist

- [ ] Two-page spread: pen/marker ink only on spread layer (not duplicated on left/right page canvases).
- [ ] Stroke across seam is one continuous line.
- [ ] Turn spread → ink saved; new spread starts fresh or loads its own doc.
- [ ] Reload: spread ink returns (`bookSpreadSessionV1`); legacy per-page ink hydrates when spread doc empty.
- [ ] Text/sticky on a page still work.

### Phase 2 — test checklist

- [ ] **20 letters fast** — lift stays snappy (no growing delay).
- [ ] Undo/redo one letter while pen tool active.
- [ ] Long session (50+ strokes) — still responsive on lift.
- [ ] Turn spread / reload — ink still correct (Phase 1 + autosave).
