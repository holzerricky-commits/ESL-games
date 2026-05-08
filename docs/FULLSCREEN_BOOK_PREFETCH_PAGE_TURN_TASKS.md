# Fullscreen book — prefetch on map + instant page turns

Last updated: 2026-05-09 (A1 done)

## How to use this doc (with the agent)

- Say **`start`** when you want work to begin on **the next unchecked task** in order.
- After a task lands well, say **`next`** — we move to the following unchecked item and update checkboxes here.
- If something needs a design tweak mid-flight, note it under **Open questions** at the bottom.

---

## Goal (two user-facing outcomes)

1. **Seamless open:** On the challenge map, opening the book overlay should not show “frame first → empty buffer → PDF snaps in.” Prefer one coherent motion (or no visible intermediate states).
2. **Fast turns:** Moving forward/back **several pages** (target: ~5–10) should feel **immediate**, without watching each page **re-raster in place**. Work may happen off-screen or from cache, then swap to visible.

These share a **warm-up foundation** (books payload, PDF bytes, PDF.js worker, single document load path) but differ in **UI gating** (open) vs **neighbour render / swap** (turns).

---

## Locked context (do not lose)

| Topic | Current behaviour / constraint |
|--------|----------------------------------|
| Map shell | `components/students/student-fullscreen-map-route-client.tsx` — toggles `isBookOverlayOpen`, passes `open` to `FullscreenBookOverlay`. |
| Overlay mount | `components/students/fullscreen-book-overlay/fullscreen-book-overlay.tsx` — returns `null` when `!vm.isMounted` (after close animation, tree unmounts → cold start next open). |
| Library load | `hooks/useBookLibraryLoader.ts` — `fetch('/api/books')` runs only when `open` is true. |
| PDF.js ready flag | `hooks/usePdfJsWorker.ts` — dynamic `react-pdf` + worker; `pdfReady` gates the main `PdfDocument` in `sections/BookCanvasStage.tsx`. |
| Live spread | `BookCanvasStage.tsx` — `react-pdf` `Document` + `PdfPage` for current spread only; changing `pageNumber` repaints visible pages. |
| Existing caches | `lib/books/pdf-thumbnail-cache.ts` — `pdfLoadCache` (per file URL) + `dataUrlCache` for **thumbnail** JPEGs (e.g. rail width), **not** full spread bitmaps for the reader. |
| Layout | `hooks/useBookViewportLayout.ts` — measures `pageAreaRef` when `open`; aspect/width can change after first `onPdfPageLoadSuccess`. |
| Chrome vs content | `fullscreen-book-overlay-view.tsx` — decorative `Book Opened.png` wraps viewport; placeholders show until library + `pdfReady` + `PdfDocument` loading complete. |

---

## Phase A — Foundation (shared by open + turns)

### A1 — Inventory and single “session warm” contract

- [x] Write a short **inline comment or type** (in one chosen module) describing the intended contract: *what must be warm before overlay is shown vs optional idle prefetch*.
- [x] List every code path that calls `pdfjs.getDocument` / mounts `Document` today (overlay, `pdf-thumbnail-cache`, any API). No code change required unless duplicates are obvious — goal is **no surprises** before refactor.

**Source of truth:** `lib/books/pdf-js-document-load-inventory.ts` (`PDF_JS_DOCUMENT_LOAD_PATHS` + module JSDoc contract).

**Acceptance:** We can name all `getDocument` entry points in a reply; checklist in this file updated.

---

### A2 — Warm books library before `open` (map-side or always-mounted shell)

- [ ] Load `/api/books` (same payload shape as today) while the student is on the **fullscreen map** with a known student, **without** requiring `open === true`.
- [ ] Avoid duplicate in-flight fetches (e.g. React Query, SWR, or a small module-level promise cache keyed by stable inputs).
- [ ] Thread **initial selection** (book/unit/page rules) so overlay can **reuse** warmed state when opened (mirror logic from `useBookLibraryLoader` or extract a pure function + one hook).

**Key files:** `student-fullscreen-map-route-client.tsx`, `hooks/useBookLibraryLoader.ts`, possibly new `hooks/useBookLibraryWarmup.ts` or context.

**Acceptance:** With network throttling, opening the book after map idle shows **no** “Loading book...” for the common case (same assigned books as warm path). Errors still surface in overlay.

---

### A3 — Keep PDF.js worker warm (optional: with A4)

- [ ] Ensure worker setup runs **once per map session** or **once per app** where cheap, not only on first overlay mount after unmount.
- [ ] If overlay still unmounts when closed, worker warm-up must live **outside** `FullscreenBookOverlay` return `null` path (e.g. parent route or small provider).

**Key files:** `hooks/usePdfJsWorker.ts`, `student-fullscreen-map-route-client.tsx`.

**Acceptance:** Second open-close-open cycle does not repeat long “Preparing PDF viewer...” if network is instant; worker import is not the dominant delay.

---

### A4 — Unify or align PDF document loading with `pdf-thumbnail-cache`

- [ ] Confirm whether `react-pdf` `Document` and `getThumbnailDataUrl` each parse the PDF separately today.
- [ ] Prefer **one** `getDocument` promise per file URL for the session (extend `pdf-thumbnail-cache` or a thin `pdf-document-session.ts` used by both).
- [ ] Document any limitation (e.g. react-pdf still creates its own proxy) in a one-line comment if full unification is not possible.

**Key files:** `lib/books/pdf-thumbnail-cache.ts`, `BookCanvasStage.tsx`, `react-pdf` usage.

**Acceptance:** Network panel shows **one** full PDF fetch per unit per session where possible; no regression on page list thumbnails.

---

## Phase B — Seamless open (UX polish)

### B1 — Overlay lifecycle: avoid full unmount on close (or delay unmount)

- [ ] Choose strategy: **(1)** keep overlay mounted, `pointer-events-none` + hidden when “closed”, **or (2)** keep unmount but accept only prefetch gains.
- [ ] If (1): `fullscreen-book-overlay.tsx` must not return `null` when closed; sync with `useFullscreenOverlayPanels` (`hooks/useFullscreenOverlayPanels.ts`) so animations and a11y (`inert` / `aria-hidden`) stay correct.

**Acceptance:** Closing then reopening does **not** re-run full library + worker cold path unless curriculum/student changed.

---

### B2 — Gate visibility until first spread is presentable (optional complement to B1)

- [ ] Delay `isVisible` / book-stage opacity (see `fullscreen-book-overlay-view.tsx`) until `!loading && pdfReady &&` first document/page ready (define exact conditions).
- [ ] Respect `prefers-reduced-motion`: do not block forever; cap wait with timeout fallback.

**Acceptance:** User does not see decorative frame with empty viewport during the opening motion in the happy path.

---

### B3 — Layout stability on first paint

- [ ] Reduce jump when `pageAspectRatio` updates from default to measured (e.g. reserve space, or apply measured aspect before fade-in).
- [ ] Touch `hooks/useBookViewportLayout.ts` + `useFullscreenBookOverlayController` spread width state only as needed.

**Acceptance:** No obvious width “snap” after first page loads on a typical unit.

---

### B4 — Asset preload for frame (small win)

- [ ] Preload `Book Opened.png` (or equivalent) from map layout or route head so decode is not on first open critical path.

**Acceptance:** Frame image is cache-hit on repeat open (verify in network).

---

## Phase C — Instant page turns (window + swap)

### C1 — Design the window policy

- [ ] Document in code: prefetch **N** pages (PDF indices) ahead/behind current anchor, respecting `getVisiblePdfPages` / bounds (`lib/books/page-range.ts`).
- [ ] Choose **N** (start with 4–6 PDF pages or ±2 spreads) and **LRU eviction** to cap memory.

**Acceptance:** Written constants + comment; no prefetch of out-of-bounds pages.

---

### C2 — Prefetch implementation (pick one approach and implement)

**Option 2a (recommended first):** Offscreen canvas / `ImageBitmap` cache at **spread `spreadPageWidth`** (or fixed scale), keyed by `(unitId, pdfPage, widthBucket)`, using shared `getDocument` from Phase A4.

**Option 2b:** Double-buffer hidden `PdfPage` components — only if 2a is insufficient.

- [ ] Implement background queue with concurrency cap (reuse pattern from `enqueuePdfWork` in `pdf-thumbnail-cache.ts`).
- [ ] Idle scheduling: `requestIdleCallback` or low-priority `setTimeout` chains so map HUD stays smooth.

**Acceptance:** Turning within the window shows **cached** surface on next frame (manual test: rapid arrow keys).

---

### C3 — Swap without visible intermediate raster

- [ ] Visible spread shows **last good** frame until new page cache entry is **ready**, then swap (opacity or crossfade ≤ 1 frame if possible).
- [ ] Annotation layer (`BookPageAnnotationLayer`) remains correct for **current** visible page indices after swap.

**Acceptance:** No blank flash between pages when cache hit; graceful fallback when miss (existing behaviour OK).

---

### C4 — Invalidate cache on unit change / alignment change

- [ ] On unit switch, clear window cache (align with `usePdfUnitCacheOnChange` / `clearThumbnailCacheForUnit` semantics).
- [ ] Width bucket invalidation when `spreadPageWidth` changes meaningfully (debounce or bucket quantisation).

**Acceptance:** No stale page bitmap after unit change or major resize.

---

## Phase D — Verification

### D1 — Manual QA script (checkboxes for you)

- [ ] Cold load map → open book: time to readable spread.
- [ ] Close → reopen: same.
- [ ] Rapid **10** page turns forward then back: smooth inside window.
- [ ] Unit with **hidden / not-counted** pages: prefetch respects visibility rules.
- [ ] Low-memory / throttled CPU: no runaway queue (optional stress note).

---

## Open questions (fill in as we go)

- (empty)

---

## Progress log (optional one-liners after each `next`)

| Date | Task id | Note |
|------|---------|------|
| 2026-05-09 | A1 | Added `lib/books/pdf-js-document-load-inventory.ts` (contract + 7 load paths). |
