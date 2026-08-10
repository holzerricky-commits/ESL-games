# Ink engine v2 — architecture rebuild

**Status:** R3 PaintEngine shipped (`inkPaintEngineEnabled`). **`inkEngineV2Enabled`** stays **false** until R8.

**Why:** Long classes (45+ min) slow down drastically; line eraser leaves “ghost” ink (Ctrl+A shows erased items); memory climbs on Main + PDF worker. Root cause is **wrong data semantics** (hide-in-place eraser, snapshot undo, full-doc React saves), not the spread-session *shape* from Phase 1 spread ink.

**Keeps:** One session per surface, spread-normalized coordinates, live overlay + committed layer, feature flags, debounced checkpoint on teardown.

**Replaces:** Dead-index eraser model, full-scene snapshot undo for pen, `spreadSessionDoc` in React state, whole-root JSON autosave, incremental paint with many escape hatches.

**Related:** `docs/SPREAD_INK_PHASED_PLAN.md`, `docs/WHITEBOARD_INK_UNIFIED_PLAN.md`, `PROJECT_CONTEXT.md` (spread-only v1, session owns canvas ink).

---

## Locked product decisions (R0)

| Topic | Decision | Notes |
|-------|----------|--------|
| Line eraser | **Destructive ops** on the visible scene + operation undo | No `deadIndices` in paint path after R2 |
| Rubber eraser | **Hide in v1 rebuild** (line eraser + select/delete) | Revisit stroke-split later if needed |
| Undo | **Operation-based** history, separate from scene | No full-scene snapshot on routine pen lift |
| Pen auto-group | **Batch patch** undo entry | Not `patchCommands` → snapshot |
| Page storage | **Hydrate + end-class projection only** during session | Not a live mirror of spread session |
| React | **Revision + selection** subscriptions only | Not full `commands[]` in `useState` |
| Stamp pop-in | **Transient overlay** | Must not invalidate committed ink replay |
| Incremental paint | **Default path**; full replay only on explicit invalidate | Resize, unit change, zoom — not eraser |
| PDF prefetch | **Session memory budget** (parallel track R7) | Throttle when ink store is hot |
| Runtime command caps | **Never** | Reverted once; breaks pen — see parking lot |

---

## Four layers

```
┌─────────────────────────────────────────────────────────┐
│  UI (React) — toolbar, sidebar, panels                  │
│  Subscribes: revision, selection, tool caps             │
└──────────────────────────┬──────────────────────────────┘
                           │ narrow API
┌──────────────────────────▼──────────────────────────────┐
│  SceneStore (vanilla TS)                                │
│  • commands = visible scene only                        │
│  • HistoryStack (operations, not scene snapshots)       │
│  • emits: revision++, selectionChanged, capsChanged     │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ PaintEngine   │  │ PersistAdapter  │  │ SurfaceAdapter   │
│ slice pool    │  │ per-docId save  │  │ spread / board   │
│ dirty slices  │  │ idle / teardown │  │ coords + key     │
│ rAF scheduler │  │                 │  │                  │
└───────────────┘  └─────────────────┘  └──────────────────┘
```

### SceneStore

- **Scene** = exactly what is painted. If it is not visible, it is not in `commands` (or it lives only in undo history until discarded).
- **HistoryEntry** (target types in `lib/books/ink-engine-v2-contract.ts`):
  - `append` — added commands
  - `delete` — removed commands (inverse of erase)
  - `patch` — metadata changes (pen figure group ids, nudge)
  - `batch` — macro undo (e.g. pen auto-group in one gesture)
- **Compaction:** Cap undo depth or idle-compact redo; teaching rarely needs hundreds of full-spread undo levels.

### PaintEngine

- Owns canvas slice refs; React passes dimensions + `revision`, not command arrays.
- **Default:** append one command → paint one command on the active slice.
- **Full replay:** only on `invalidateAll(reason)` — resize, spread key change, migration.
- Stamp / paste animations on **overlay** canvases, not committed layer deps.
- Marker multiply: slice pool with reuse; avoid unbounded slice DOM growth.
- **Optional (post–core R3):** live line-eraser mask overlay during drag — cheap composited hide until lift commit; replaces R2.5 punch-out / slice redraw experiments (parked).

### PersistAdapter

- Authoritative during class: `bookSpreadSessionV1[docId]` / `bookWhiteboardInkSessionV1[docId]`.
- Save **dirty docId only**; stringify in idle or worker when large.
- Debounce longer while drawing (e.g. 10–15s); immediate on page turn, visibility hidden, end class.
- Per-page `esl_book_annotations_v2`: hydrate when session empty; project on teardown / end class — not every stroke.

### SurfaceAdapter

- Spread: spread-normalized coords, left/right key.
- Whiteboard / lesson board: document or viewport coords, `storagePageKey`.
- Same SceneStore + PaintEngine; adapters differ in key + projection only.

---

## Line eraser (R2 target)

**Today (legacy):** `eraser-line` strokes stay in `commands[]`; `computeEraserLineDeadIndices` hides targets at paint time; erased items remain in memory; incremental paint disabled when `deadIndices.size > 0`; spread `selectAll` ignores dead state.

**V2:**

```
onEraserLineCommit(points) →
  hits = computeHits(scene.commands, points)
  next = removeOrSplit(scene.commands, hits)
  history.push({ type: 'delete', commands: hits })
  scene.replace(next)
```

- Eraser-line gesture is **not** stored as permanent ink (optional: store only in undo batch metadata).
- Ctrl+A → all visible command ids. Erase all → select nothing.

---

## React boundary (R4 target)

Replace `setSpreadSessionDoc(state.doc)` with:

| Consumer | Subscription |
|----------|----------------|
| Toolbar undo/redo | `canUndo`, `canRedo` |
| Selection chrome | `selectedIds`, `revision` |
| Session paint layer | store ref + `revision` (imperative pull) |
| Sidebar / chrome | **no** per-stroke subscription |

---

## Memory budget (R7 target)

| Pool | Soft cap (guidance) |
|------|---------------------|
| Ink scene + undo + slices | ~150 MB |
| PDF prefetch + worker | ~150 MB |

Coordinator throttles prefetch while pointer is down or ink revision is hot.

---

## Phased rebuild

| Phase | Name | Flag | Gate |
|-------|------|------|------|
| **R0** | Plan + contract | `inkEngineV2Enabled` **false** | No behavior change; contract tests green |
| **R1** | SceneStore + op undo | false (shipped in store) | 500 append/undo cycles — sublinear heap growth ✓ |
| **R2** | Eraser redesign | false | Erase all → Ctrl+A empty; no dead indices |
| **R2.5** | Live eraser preview | `inkEraserLivePreviewEnabled` **false** (parked) | Not a gate — ink hides on lift (R2); revisit with R3 mask overlay |
| **R3** | PaintEngine | `inkPaintEngineEnabled` **true** (shipped) | 20 letters fast **after** heavy erase; stamp &lt;100ms @ 500 cmds |
| **R4** | React boundary | `inkSessionReactBoundaryEnabled` **true** (shipped) | Profiler: sidebar not on pen lift |
| **R5** | Persist v2 | `inkSessionPersistV2Enabled` **true** (shipped) | No &gt;50ms save block while drawing |
| **R6** | Page layer demotion | `inkSessionPageLayerDemotionEnabled` **true** (shipped) | One commit path for canvas ink |
| **R7** | PDF budget | `inkPdfMemoryBudgetEnabled` **true** (shipped) | 45 min sim — heap stable |
| **R8** | Ship | **true** | Full spread test script + real class |

**Order:** R0 → R1 → R2 → R3 → R4 → R5 → R6 → R8; R7 parallel after R4.

---

## Test script (repeat after R3+)

From `docs/SPREAD_INK_PHASED_PLAN.md`, plus:

1. Line eraser clears page → **Ctrl+A selects nothing**.
2. **45 min** pen + stamps + eraser + page turns — no growing lift pause.
3. Memory: Main ink-related stable; no climb after erase-all.
4. Book + whiteboard + lesson board share engine (after R6).

---

## Explicit non-goals (v2)

- Runtime command-count caps on incremental paint.
- Rubber eraser pixel compositing without vector semantics (until explicit design).
- Reintroducing per-lift split to left/right page layers when session is on.
- Big-bang rewrite without per-phase gates.

---

## Contract module

Invariants and v2 paint rules live in:

- `lib/books/ink-engine-v2-contract.ts`
- `lib/books/ink-engine-v2-contract.test.ts`

Operation undo (R1) lives in:

- `lib/books/ink-session-history.ts` — `diffCommandsToHistoryEntry`, `applyHistoryUndo` / `applyHistoryRedo`, `buildPenAutoGroupHistoryBatch`
- `lib/books/ink-session-store.ts` — `appendPenWithAutoGroup`, `commitEraserLine`, `INK_SESSION_UNDO_MAX_ENTRIES` (200)

Destructive eraser (R2) lives in:

- `lib/books/annotation-geometry.ts` — `applyEraserLineCommit`, `compactLegacyEraserLineScene`
- `lib/books/ink-session-store.ts` — `commitEraserLine` (no stored `eraser-line` commands)

Live eraser preview (R2.5 — **parked**, `inkEraserLivePreviewEnabled = false`):

- `lib/books/ink-session-eraser-live-preview.ts` — slice redraw + punch-out experiments
- `components/students/ink-session-selection/useInkSessionEraserLivePreview.ts`
- `components/students/book-spread-session-layer.tsx` — freeze committed replay while draft active

Re-enable only after R3 PaintEngine can host a mask overlay; default UX is erase-on-lift (R2).

PaintEngine (R3) lives in:

- `lib/books/ink-paint-engine.ts` — `planInkSessionPaint`, `runInkSessionPaint` (append / punch-out erase / dirty-slice replay)
- `lib/books/annotation-render-slices.ts` — `INK_PAINT_SLICE_BATCH_SIZE` ink batching
- `components/students/ink-session-selection/useInkSessionCanvasPaint.ts` — wired when `inkPaintEngineEnabled`

React boundary (R4) lives in:

- `lib/books/ink-session-store-subscription.ts` — `subscribeInkSessionStoreUi`, `pickInkSessionStoreUiSnapshot`
- `components/students/book-spread-session-layer.tsx` — `sessionStoreRef` + `commandsRevision` pull
- `components/students/fullscreen-book-overlay/sections/BookCanvasStage.tsx` — no full-doc `useState` on pen lift when flag on

Persist v2 (R5) lives in:

- `lib/books/ink-session-persist-v2.ts` — drawing-hot debounce, idle checkpoint queue, sync flush on teardown
- `lib/books/ink-session-persist-config.ts` — `INK_SESSION_AUTOSAVE_MS_DRAWING`, idle timeout, disk debounce
- `lib/books/spread-session-storage.ts` / `whiteboard-session-storage.ts` — in-memory root cache per open session
- `lib/books/ink-session-store.ts` — autosave uses idle queue; `checkpointNow` / destroy stay synchronous

Page layer demotion (R6) lives in:

- `lib/books/ink-session-page-persist.ts` — `pageLayerCommandsForPersist` / `pageLayerCommandsForLoad`
- `components/students/book-page-annotation-layer/hooks/useBookPageAnnotationLayer.ts` — page saves skip session-owned canvas ink
- `lib/books/spread-session-persist.ts` / `whiteboard-session-persist.ts` — Tier C flush on teardown only (unchanged)

PDF memory budget (R7) lives in:

- `lib/books/reader-prefetch-ink-coordinator.ts` — ink-hot detection; pauses idle prefetch
- `lib/books/reader-prefetch-budget-config.ts` — cache + concurrency caps (48→24 while hot)
- `lib/books/reader-page-prefetch-queue.ts` — defers P1 idle burst; trims LRU on hot
- `components/students/book-spread-stroke-overlay.tsx` — pointer down/up signals

Use `assertInkEngineV2SceneInvariants` in new code paths once `inkEngineV2Enabled` is true.

---

## Changelog

| Date | Phase | Note |
|------|-------|------|
| 2026-07-11 | R7 | PDF budget: idle prefetch pauses while ink hot; tighter LRU + concurrency; `inkPdfMemoryBudgetEnabled` |
| 2026-07-11 | R6 | Page layer demotion: persist/load strip session canvas ink; `inkSessionPageLayerDemotionEnabled` |
| 2026-07-10 | R5 | Persist v2: 12s debounce while drawing, idle stringify, root cache; `inkSessionPersistV2Enabled` |
| 2026-07-10 | R4 | React boundary: store ref + revision; `subscribeInkSessionStoreUi`; `inkSessionReactBoundaryEnabled` |
| 2026-07-10 | R3 | PaintEngine: batched ink slices, incremental append/erase punch-out/dirty-slice replay; `inkPaintEngineEnabled` |
| 2026-07-10 | R2.5 park | Live eraser preview disabled (`inkEraserLivePreviewEnabled`); erase-on-lift only until R3 mask |
| 2026-07-10 | R2.5b | Live eraser uses destination-out punch-out per newly hit stroke (not full ink-batch redraw) |
| 2026-07-10 | R2.5 | Wire `onSpreadEraserLineDraftChange` on pointer move; cancel-only canvas restore on lift |
| 2026-07-10 | R2 | Destructive line eraser in session store; `commitEraserLine`; legacy scene compaction on load; incremental paint gate lifted |
| 2026-07-10 | R1 | Op-based undo in `ink-session-store`; `appendPenWithAutoGroup` batch undo; `ink-session-history.ts`; undo cap 200; spread + whiteboard wired |
| 2026-07-10 | R0 | This doc, `inkEngineV2Enabled`, contract + tests, parking-lot entry |
