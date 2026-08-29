# Parking lot

Deferred ideas and polish. Paste assistant `--- PARKING_LOT ---` blocks under **Entries**.

## Entries

<!-- Newest on top -->

### Outline Align — bulk folio auto-scan (retired)

- **What:** Scan PDF text for footer page numbers and auto-fill a long “not counted” list; consistency voting across later pages.
- **Why parked:** Produced unsafe “weak match” results (e.g. printed 1 ≈ PDF 109 → ghost pages 2–108). Wrong folio reads amplify into huge skip lists.
- **Keep intact:** `lib/books/page-alignment-detect.ts` helpers + `detect-page-alignment-client.ts` remain for experiments; wizard no longer auto-runs them.
- **Shipped instead:** One sync point in the Align step (`notCountedFromSyncPoint`, max 20 not-counted) + skip / advanced lists.
- **Resume when:** Only with hard caps, no auto-apply on weak, and teacher confirm for large offsets — or never.
- **Next if resumed:** Cap max not-counted; never auto-apply weak; require confirm before applying >~10 skips.

### Spread seam overlap — revive outside structure wizard

- **What:** Controls to set / auto-adjust how much facing pages overlap at the binding (spread gutter) while mapping book structure.
- **Why parked:** Structure mapping is now TOC → Align → Extract → Review. Seam tweaking is a reader/display setting, not part of outline setup. Wizard no longer edits or saves gutter fields; existing book values stay as-is.
- **Keep intact:** `lib/books/spread-gutter*.ts` and reader preview still use stored gutter ratios.
- **Resume when:** Adding spread / reader display settings (not structure mapping).
- **Next if resumed:** Put seam slider + auto-adjust under reader or book display settings; optionally re-save `spreadGutterPullRatio` / per-file overrides from there.

### Class toolbox (coin / dice / countdown / stopwatch)

- **Docs:** `docs/CLASS_TOOLBOX_PRODUCT.md` + `docs/CLASS_TOOLBOX_PHASED_PLAN.md`
- **Built:** Phase 0 docs; Phase 1 empty shell; Phase 2–2b coin over book; Phase 3–3b multi-dice (d4–d20)
- **Why parkable mid-track:** Remaining tools (timers) are spice for live class; do not block student home / lesson board / schedule lifecycle
- **Resume when:** Need countdown/stopwatch live in class, or after current ship tracks feel calm
- **Next if resumed:** Phase 4 countdown → Phase 5 stopwatch → optional Phase 6 polish

### Live line-eraser preview during drag (R2.5)

- **What:** Ink vanishes **while** dragging the line eraser, not only on lift.
- **Built:** Draft wiring on pointer move, committed-layer freeze, slice redraw + destination-out punch-out (`ink-session-eraser-live-preview.ts`).
- **Why parked:** Still lags on modest stroke counts; punch-out was slower than slice redraw. Needs R3 PaintEngine (mask overlay or per-stroke layers), not more canvas hacks on the current paint path.
- **Flag:** `inkEraserLivePreviewEnabled` in `lib/books/feature-flags.ts` — **false** (default). Erase-on-lift via R2 `commitEraserLine` remains.
- **Resume when:** R3 PaintEngine core gates pass; optional mask overlay spike.
- **Re-enable now:** Set `inkEraserLivePreviewEnabled = true` and hard-refresh (expect drag lag until R3).

### Ink engine v2 rebuild (long-class perf + eraser semantics)

- **Doc:** `docs/INK_ENGINE_V2.md` — SceneStore, PaintEngine, destructive eraser, op-based undo, React boundary, persist per docId.
- **Flag:** `inkEngineV2Enabled` in `lib/books/feature-flags.ts` — **false** until R8.
- **Contract:** `lib/books/ink-engine-v2-contract.ts` + tests.
- **Phases:** R0 ✓ → R1 op undo ✓ → R2 eraser ✓ → R2.5 live preview **parked** → R3 paint ✓ → R4 React ✓ → R5 persist ✓ → R6 page demotion ✓ → R7 PDF budget ✓ → **R8 ship** (next).
- **Resume when:** R8 — flip `inkEngineV2Enabled` after full spread test script + real class.
- **Not:** Runtime command-count caps; rubber eraser pixel model without vector semantics.

### Prepare lesson — first-run tip (onboarding)

- **What:** One-time tip when the teacher first uses **Prepare lesson** (or first sees the prep controls over the book): e.g. *“Prepare lesson sets up the book without starting the clock.”* Optional short line under **Start class**: *“Starts the timer.”* Never show again after dismiss / first use.
- **Why parked:** Permanent “Preparing — not live” chrome was noisy; buttons alone are enough for daily use. Tutorial plumbing belongs with real onboarding, not a one-off tip system now.
- **Resume when:** Building app onboarding / tutorials.
- **UI default until then:** Quiet top-right cluster only — **Save & exit** (ghost) + **Start class** (primary); no status banner.

### 2.5D page-turn animation (CSS fold)

- **Flag:** `spreadSlideEnabled` in `lib/books/feature-flags.ts` (currently **false**).
- **Built:** Phases 1–4 — slide/fold overlay, multiply lighting, frame cast-shadow soften, opaque paper fix, hardcover isolation (no shell squish).
- **Why parked:** Not convincing enough for live class; instant cut feels better. Realistic curl needs snapshot → dedicated flip layer (see `FULLSCREEN_BOOK_STABLE_PAGES_PLAN.md` Phase 4c).
- **Resume when:** Shipping to users and budgeting a proper flip milestone, or a short polish pass if fold quality crosses “good enough.”
- **Re-enable now:** Set `spreadSlideEnabled = true` and hard-refresh.

### Fill tool (paint bucket) for closed pen shapes

- **Doc:** `docs/FILL_TOOL_PLAN.md`
- **Resume when:** Coloring hand-drawn outlines is a recurring lesson pain; lesson board + spread ink stable.
- **Effort:** ~1–3 days for v1; optional Phase 0 quick win (shape fill defaults + hold-to-shape fill) in hours.

### Whiteboard ink — viewport tiles (if needed after unified engine)

- **Resume when:** Phase 5 of `docs/WHITEBOARD_INK_UNIFIED_PLAN.md` done but tall runway still heavy on live drag.
- **Not:** Runtime command-count cap on incremental paint (caused unusable pen before).

### Book spread ink — further speed (post v1)

- **Resume when:** Core teaching flow shipped; 20-letter test on book already OK.
- **Ideas:** Marker canvas pooling, segment live paint tuning — one engine in `spread-session-*` / future `ink-session-*`.

