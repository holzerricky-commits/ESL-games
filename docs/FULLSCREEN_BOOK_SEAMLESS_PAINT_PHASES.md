# Fullscreen book — seamless paint (no empty stage)

Last updated: 2026-05-09

## Why this doc exists

The prefetch / warm-open work lives in [`FULLSCREEN_BOOK_PREFETCH_PAGE_TURN_TASKS.md`](./FULLSCREEN_BOOK_PREFETCH_PAGE_TURN_TASKS.md) (Phases A–D). **That track is largely complete in code.**  
This doc captures **follow-up product intent** so we do not lose context:

- Prefer a **short delay** (or a covered viewport) over showing the **book wrapper with a blank white page area** while PDFs catch up.
- **Page turns** must **not** reveal an empty white placeholder while the next page renders — keep the **previous** spread visible until the **next** is ready (or show an explicit non-white loading state).

Work here is **Phase E** (below). After finishing each phase, **check the boxes** in that section and add a line to the **Progress log** at the bottom.

---

## How to use (with the agent or solo)

1. Implement **one phase at a time** in order (E1 → E2 → E3 → E4) unless a later phase is explicitly time-boxed as “later”.
2. When a phase is done and verified, mark it **[x]** in this file and append **Progress log**.
3. Related code you will touch most often:
   - `components/students/student-fullscreen-map-route-client.tsx` — map; early warm-up.
   - `components/students/fullscreen-book-overlay/hooks/useFullscreenBookOverlayController.ts` — `presentationReady`, prefetch scheduling.
   - `components/students/fullscreen-book-overlay/fullscreen-book-overlay-view.tsx` — chrome vs page viewport visibility.
   - `components/students/fullscreen-book-overlay/sections/BookCanvasStage.tsx` — spread mount.
   - `components/students/fullscreen-book-overlay/sections/ReaderPageSlot.tsx` — prefetch bitmap → `PdfPage`.
   - `lib/books/reader-page-prefetch-queue.ts` — LRU `ImageBitmap` cache, idle queue.

---

## Principles (carry through every phase)

| # | Rule |
|---|------|
| P1 | **Shell vs stage:** Decorative frame / dimmed map may appear per UX choice, but the **page pixel stage** must not show as **empty white** while we wait for the first paint. |
| P2 | **Turns:** Do **not** hide the **current** spread until the **target** spread has a drawable surface (prefetch hit or `react-pdf` ready). |
| P3 | **Timeouts:** Never block forever — align with `prefers-reduced-motion` and existing B2-style caps; degrade to explicit message if needed. |
| P4 | **Placeholders:** If something must show through briefly, use **paper-tone** (`surface-2` / off-white), not pure `#fff`, unless the real page is already there. |

---

## Phase E1 — Gate first open (after “open book” click)

**Goal:** User does not see the **inner page viewport** as a blank white hole while the first spread loads after a cold or warm click.

### Tasks

- [x] **E1a — Define “first spread ready”**  
  Document in code one predicate, e.g. for resolved unit + anchor: prefetched bitmap exists for **left** (and **right** if two-up), **or** `react-pdf` `onLoadSuccess` has fired for those pages.  
  Implemented: `lib/books/first-spread-paint-ready-contract.ts` (gate uses `onLoadSuccess` for required pages).

- [x] **E1b — UX choice (pick one and implement)**  
  - **Option A:** Delay transitioning `open` / overlay until first spread ready (loading state on map button), **or**  
  - **Option B:** Allow overlay chrome immediately but **cover** the page viewport (opaque plate / spinner) until E1a, then reveal — **no** white rectangle.  
  Implemented: **Option B** — `BookCanvasStage` `viewportPaintHold` (paper-tone + spinner) until first spread callbacks; controller `spreadFirstPaintReady` + timeout fallback. **Map route:** defers visible overlay (`presented`) until first paint — **Option A** on the map (spell book spinner + toast on timeout); shell and first spread appear together.

- [x] **E1c — Start work earlier**  
  On map, when student + selection are known: kick off **PDF + first-spread prefetch** in parallel with existing `/api/books` + worker warm-up so E1a is more often true before click.  
  Implemented: `lib/books/map-initial-book-spread-warmup.ts` from `student-fullscreen-map-route-client.tsx`.

- [x] **E1d — Acceptance**  
  Cold refresh → map → open book: user never sees an **empty white** page stage; at worst a deliberate loader or delayed open.

---

## Phase E2 — Gate every page turn (no white flash)

**Goal:** After next/prev (or jump), user **never** sees an empty placeholder; they see **old spread until new is ready**.

### Tasks

- [ ] **E2a — Turn state machine**  
  On navigation intent: do **not** swap visible `pageNumber` / spread props until target pages are “ready” (same definition as E1a, per target indices), **or** keep rendering old indices underneath until ready then atomic swap.

- [ ] **E2b — Prefetch integration**  
  Ensure `ReaderPageSlot` (or successor) **always** prefers a ready bitmap for the **incoming** page; on miss, **hold** previous frame (no white).

- [ ] **E2c — Miss path**  
  If target not prefetched: either block turn until render completes, or show **non-white** edge loader while old spread remains — document which.

- [ ] **E2d — Acceptance**  
  Rapid 10+ turns: no full-viewport white flash; worst case hold on previous spread or explicit loader.

---

## Phase E3 — Prefetch policy tuned for open + turn

**Goal:** Minimize wait in E1/E2 without unbounded memory.

### Tasks

- [ ] **E3a — Map idle:** Prefetch **current** spread (and optional ±1 spread) for resolved book/unit/page when map is visible.

- [ ] **E3b — Overlay open:** Immediately enqueue visible window (reuse `getReaderPrefetchVisiblePageIndices`); consider **higher priority** than idle-only for the **current** anchor pages.

- [ ] **E3c — Each turn:** Enqueue newly exposed window edge (“load one more” forward/back).

- [ ] **E3d — LRU:** Keep existing cap / eviction; optionally bias eviction **backward** if most navigation is forward.

- [ ] **E3e — Acceptance**  
  Cold open and turns hit cache more often; memory stays bounded (profile on low-end if possible).

---

## Phase E4 — Polish & failure modes

### Tasks

- [ ] **E4a — Timeouts & a11y**  
  Wire `prefers-reduced-motion` and max-wait so UI never hangs; match spirit of B2.

- [ ] **E4b — Visual**  
  Any intentional placeholder uses paper-tone, not stark white.

- [ ] **E4c — Extend manual QA**  
  Add rows to D1 in prefetch doc or duplicate a short checklist here: cold open, turn spam, unit switch, resize, throttle.

- [ ] **E4d — Acceptance**  
  Failure paths are understandable; no infinite blank.

---

## Dependency on prior work

| Prior | Use for Phase E |
|-------|------------------|
| A2–A4 | Single `getDocument` path, map warm-up |
| B2 | `presentationReady` — may need to incorporate **pixel-ready** |
| C2–C4 | Prefetch queue, `ReaderPageSlot`, LRU, invalidation |

---

## Progress log

| Date | Phase | Note |
|------|-------|------|
| 2026-05-09 | E1 | E1a–E1d: first-spread contract, Option B viewport hold, map warmup prefetch, timeout fallback; `tsc --noEmit` clean. |

---

## Open notes

- If E1 Option A (delay open) feels heavy, prefer **E1 Option B** (chrome + covered viewport) first.
- Coordinate with [`FULLSCREEN_BOOK_PREFETCH_PAGE_TURN_TASKS.md`](./FULLSCREEN_BOOK_PREFETCH_PAGE_TURN_TASKS.md) **Phase D1** manual QA after E2+.
