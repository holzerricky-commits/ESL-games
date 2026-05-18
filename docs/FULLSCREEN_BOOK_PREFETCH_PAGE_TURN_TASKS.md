# Fullscreen book — prefetch on map + instant page turns

Last updated: 2026-05-09 (C4 done; Phase D1 checklist expanded)

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
| Overlay mount | After first open, overlay view stays mounted while closed (B1); `null` only before first open (`!isMounted && !open`). Student switch remounts via `key={student.id}` on map route. |
| Library load | `hooks/useBookLibraryLoader.ts` — `fetch('/api/books')` runs only when `open` is true. |
| PDF.js ready flag | `hooks/usePdfJsWorker.ts` — worker via `ensureReactPdfWorker()`; `pdfReady` gates PDF load in `sections/BookCanvasStage.tsx`. |
| Live spread | `BookCanvasStage.tsx` — `loadCachedPdfDocument` + `PdfPage` with `pdf` prop (shared `getDocument` cache with thumbnails). |
| Existing caches | `pdf-thumbnail-cache.ts` — `pdfLoadCache` + thumbnail `dataUrlCache`. Reader spread bitmaps: `reader-page-prefetch-queue.ts` LRU (cleared on unit switch, alignment signature change, stale width bucket). |
| Layout | `hooks/useBookViewportLayout.ts` — measures `pageAreaRef` when `open`; aspect/width can change after first `onPdfPageLoadSuccess`. |
| Chrome vs content | `fullscreen-book-overlay-view.tsx` — decorative `Book Opened.png` wraps viewport; placeholders show until library + `pdfReady` + unit PDF load complete. |

---

## Phase A — Foundation (shared by open + turns)

### A1 — Inventory and single “session warm” contract

- [x] Write a short **inline comment or type** (in one chosen module) describing the intended contract: *what must be warm before overlay is shown vs optional idle prefetch*.
- [x] List every code path that calls `pdfjs.getDocument` / mounts `Document` today (overlay, `pdf-thumbnail-cache`, any API). No code change required unless duplicates are obvious — goal is **no surprises** before refactor.

**Source of truth:** `lib/books/pdf-js-document-load-inventory.ts` (`PDF_JS_DOCUMENT_LOAD_PATHS` + module JSDoc contract).

**Acceptance:** We can name all `getDocument` entry points in a reply; checklist in this file updated.

---

### A2 — Warm books library before `open` (map-side or always-mounted shell)

- [x] Load `/api/books` (same payload shape as today) while the student is on the **fullscreen map** with a known student, **without** requiring `open === true`.
- [x] Avoid duplicate in-flight fetches (e.g. React Query, SWR, or a small module-level promise cache keyed by stable inputs).
- [x] Thread **initial selection** (book/unit/page rules) so overlay can **reuse** warmed state when opened (mirror logic from `useBookLibraryLoader` or extract a pure function + one hook).

**Implementation:** `lib/books/fetch-books-library-cached.ts` (in-memory + single-flight), `lib/books/resolve-initial-book-reader-selection.ts` (shared rules), map prefetch in `student-fullscreen-map-route-client.tsx`, loader uses cache and skips `setLoading(true)` when cache already populated.

**Key files:** `student-fullscreen-map-route-client.tsx`, `hooks/useBookLibraryLoader.ts`, possibly new `hooks/useBookLibraryWarmup.ts` or context.

**Acceptance:** With network throttling, opening the book after map idle shows **no** “Loading book...” for the common case (same assigned books as warm path). Errors still surface in overlay.

---

### A3 — Keep PDF.js worker warm (optional: with A4)

- [x] Ensure worker setup runs **once per map session** or **once per app** where cheap, not only on first overlay mount after unmount.
- [x] If overlay still unmounts when closed, worker warm-up must live **outside** `FullscreenBookOverlay` return `null` path (e.g. parent route or small provider).

**Implementation:** `lib/books/ensure-react-pdf-worker.ts` (single-flight `ensureReactPdfWorker()`), called from the fullscreen map warm-up effect and from `usePdfJsWorker`; `student-card-lesson-preview.tsx` dedupes via the same helper.

**Key files:** `hooks/usePdfJsWorker.ts`, `student-fullscreen-map-route-client.tsx`.

**Acceptance:** Second open-close-open cycle does not repeat long “Preparing PDF viewer...” if network is instant; worker import is not the dominant delay.

---

### A4 — Unify or align PDF document loading with `pdf-thumbnail-cache`

- [x] Confirm whether `react-pdf` `Document` and `getThumbnailDataUrl` each parse the PDF separately today.
- [x] Prefer **one** `getDocument` promise per file URL for the session (extend `pdf-thumbnail-cache` or a thin `pdf-document-session.ts` used by both).
- [x] Document any limitation (e.g. react-pdf still creates its own proxy) in a one-line comment if full unification is not possible.

**Confirmed:** Previously `<Document file={url}>` called `getDocument` again while thumbnails used `pdf-thumbnail-cache` — two loads per URL.

**Implementation:** Exported `loadCachedPdfDocument` (awaits `ensureReactPdfWorker`, then shared `getDocument` promise). Fullscreen reader uses `PdfPage` with `pdf={proxy}` instead of `<Document>`. Teacher `books-page-client` / wizard / outline still use `<Document>` (separate path).

**Key files:** `lib/books/pdf-thumbnail-cache.ts`, `BookCanvasStage.tsx`, `react-pdf` usage.

**Acceptance:** Network panel shows **one** full PDF fetch per unit per session where possible; no regression on page list thumbnails.

---

## Phase B — Seamless open (UX polish)

### B1 — Overlay lifecycle: avoid full unmount on close (or delay unmount)

- [x] Choose strategy: **(1)** keep overlay mounted, `pointer-events-none` + hidden when “closed”, **or (2)** keep unmount but accept only prefetch gains.
- [x] If (1): `fullscreen-book-overlay.tsx` must not return `null` when closed; sync with `useFullscreenOverlayPanels` (`hooks/useFullscreenOverlayPanels.ts`) so animations and a11y (`inert` / `aria-hidden`) stay correct.

**Implementation:** (1) — `useFullscreenOverlayPanels` no longer clears `isMounted` after close; shell renders when `isMounted || open`; root uses `pointer-events-none`, `aria-hidden`, `inert` when `!open`. Map route `key={student.id}` remounts overlay for a different student.

**Acceptance:** Closing then reopening does **not** re-run full library + worker cold path unless curriculum/student changed.

---

### B2 — Gate visibility until first spread is presentable (optional complement to B1)

- [x] Delay `isVisible` / book-stage opacity (see `fullscreen-book-overlay-view.tsx`) until `!loading && pdfReady &&` first document/page ready (define exact conditions).
- [x] Respect `prefers-reduced-motion`: do not block forever; cap wait with timeout fallback.

**Implementation:** `readerPresentationCore` = when `open`: false while `loading`; else true on `error`, no curriculum, or no resolved unit; else `pdfReady && numPages != null` (PDF document loaded). `useFullscreenOverlayPanels` sets `isVisible` only when `presentationReady` (`core` OR timeout: 450ms reduced-motion, 2800ms otherwise).

**Acceptance:** User does not see decorative frame with empty viewport during the opening motion in the happy path.

---

### B3 — Layout stability on first paint

- [x] Reduce jump when `pageAspectRatio` updates from default to measured (e.g. reserve space, or apply measured aspect before fade-in).
- [x] Touch `hooks/useBookViewportLayout.ts` + `useFullscreenBookOverlayController` spread width state only as needed.

**Implementation:** After `loadCachedPdfDocument`, `BookCanvasStage` awaits `getPage` + `getViewport({ scale: 1 })` and passes `pageAspectRatio` in `BookReaderDocumentReadyMeta` **before** `setSharedPdf`, so layout runs with measured ratio before first `PdfPage` paint. `useBookViewportLayout` `baseKey` no longer includes aspect (target still recomputes on resize/aspect); `selectedUnitId` change resets aspect to default until the next prime. `useBookPdfPageSync` calls `primeReaderPageAspectRatio`.

**Acceptance:** No obvious width “snap” after first page loads on a typical unit.

---

### B4 — Asset preload for frame (small win)

- [x] Preload `Book Opened.png` (or equivalent) from map layout or route head so decode is not on first open critical path.

**Implementation:** `BOOK_OPENED_FRAME_IMAGE_SRC` + `preloadBookOpenedFrameImage()` in `fullscreen-book-overlay/constants.ts`; fullscreen map client calls it in the same warm-up `useEffect` as books/worker and removes the `<link>` on unmount. Overlay `<img>` uses the shared constant.

**Acceptance:** Frame image is cache-hit on repeat open (verify in network).

---

## Phase C — Instant page turns (window + swap)

### C1 — Design the window policy

- [x] Document in code: prefetch **N** pages (PDF indices) ahead/behind current anchor, respecting `getVisiblePdfPages` / bounds (`lib/books/page-range.ts`).
- [x] Choose **N** (start with 4–6 PDF pages or ±2 spreads) and **LRU eviction** to cap memory.

**Implementation:** `lib/books/reader-prefetch-window.ts` — `READER_PREFETCH_VISIBLE_SLOTS_BEFORE` / `_AFTER` (4+4 visible-list slots ≈ ±2 spreads when consecutive), `READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES` (24) for future LRU; `getReaderPrefetchVisiblePageIndices` uses `clampPdfPageToVisible` + slice only over `visiblePages`. Tests in `reader-prefetch-window.test.ts`.

**Acceptance:** Written constants + comment; no prefetch of out-of-bounds pages.

---

### C2 — Prefetch implementation (pick one approach and implement)

**Option 2a (recommended first):** Offscreen canvas / `ImageBitmap` cache at **spread `spreadPageWidth`** (or fixed scale), keyed by `(unitId, pdfPage, widthBucket)`, using shared `getDocument` from Phase A4.

**Option 2b:** Double-buffer hidden `PdfPage` components — only if 2a is insufficient.

- [x] Implement background queue with concurrency cap (reuse pattern from `enqueuePdfWork` in `pdf-thumbnail-cache.ts`).
- [x] Idle scheduling: `requestIdleCallback` or low-priority `setTimeout` chains so map HUD stays smooth.

**Implementation:** `lib/books/reader-page-prefetch-queue.ts` — `queueReaderPrefetchWindowIdle` (`requestIdleCallback` + 2s timeout, `setTimeout` fallback) → `prefetchReaderPageBitmapIfMissing` via `enqueueReaderPrefetchWork` (max 2 concurrent); `renderPageToImageBitmap` uses `loadCachedPdfDocument` + `page.render` + `createImageBitmap`; LRU `Map` capped by `READER_PREFETCH_BITMAP_CACHE_MAX_ENTRIES`; `getReaderPrefetchedImageBitmap` for C3; `clearReaderPrefetchCacheForUnit` from `usePdfUnitCacheOnChange`. `useFullscreenBookOverlayController` schedules prefetch when `open && pdfReady` with window from `getReaderPrefetchVisiblePageIndices`.

**Acceptance:** Neighbour pages raster off-main-thread idle path into the LRU (verify CPU idle / no map jank). **C3** consumes `getReaderPrefetchedImageBitmap` so turns skip visible re-raster when a cache hit exists.

---

### C3 — Swap without visible intermediate raster

- [x] Visible spread shows **last good** frame until new page cache entry is **ready**, then swap (opacity or crossfade ≤ 1 frame if possible).
- [x] Annotation layer (`BookPageAnnotationLayer`) remains correct for **current** visible page indices after swap.

**Implementation:** `subscribeReaderPrefetchCache` + `notifyReaderPrefetchCache` on LRU insert/clear. `ReaderPageSlot` + `ReaderPrefetchCanvas`: if `getReaderPrefetchedImageBitmap` hits, paint canvas while `react-pdf` `PdfPage` loads invisibly; on `onLoadSuccess` reveal `PdfPage` and drop prefetch overlay. `useReaderPrefetchCacheRevision` in `BookCanvasStage` drives `useMemo` cache reads. Annotations stay in `z-[2]` siblings.

**Acceptance:** No blank flash between pages when cache hit; graceful fallback when miss (existing behaviour OK).

---

### C4 — Invalidate cache on unit change / alignment change

- [x] On unit switch, clear window cache (align with `usePdfUnitCacheOnChange` / `clearThumbnailCacheForUnit` semantics).
- [x] Width bucket invalidation when `spreadPageWidth` changes meaningfully (debounce or bucket quantisation).

**Implementation:** `usePdfUnitCacheOnChange` already calls `clearReaderPrefetchCacheForUnit(prev.unitId)` on unit switch. `readerPrefetchWidthBucket` uses **32px** quanta (`READER_PREFETCH_WIDTH_BUCKET_PX`); `invalidateReaderPrefetchStaleWidthBucketsForUnit` drops LRU entries for other buckets. `useFullscreenBookOverlayController` tracks `readerPrefetchAlignmentSignature` (`numPages` + sorted hidden/not-counted from `getFileAlignment`) and full-clears prefetch for the **current** unit when it changes; width-bucket ref resets on `selectedUnitId` change.

**Acceptance:** No stale page bitmap after unit change or major resize.

---

## Phase D — Verification

**Code through C4 is landed** — Phase D is **your** sign-off. Tick when you have manually verified each row.

### D1 — Manual QA checklist (tick when done)

- [ ] **D1a — Cold path (full browser refresh)**  
  - [ ] Load fullscreen map for a student with curriculum.  
  - [ ] Open book **without** idling long on the map.  
  - [ ] Note: time until spread is readable; any white flash (expected until follow-up “cold instant open” work).  

- [ ] **D1b — Warm reopen (same session, no refresh)**  
  - [ ] Close book, reopen: library/worker/cache should feel faster than D1a.  

- [ ] **D1c — Page turns**  
  - [ ] Rapid **10** turns forward, then **10** back: no long “stuck” raster; smooth inside prefetch window.  

- [ ] **D1d — Hidden / not-counted pages**  
  - [ ] Use a unit with alignment gaps: no prefetch of invisible indices; navigation still sane.  

- [ ] **D1e — Stress (optional)**  
  - [ ] Throttle CPU or shrink memory: map stays usable; prefetch queue does not lock the UI.  

---

## Open questions (fill in as we go)

- **Follow-up (tracked):** Seamless **first open** + **no white flash on turns** — implementation phases, checkboxes, and progress log: **[`FULLSCREEN_BOOK_SEAMLESS_PAINT_PHASES.md`](./FULLSCREEN_BOOK_SEAMLESS_PAINT_PHASES.md)** (Phase E1–E4). Mark phases complete there as you ship them.

---

## Progress log (optional one-liners after each `next`)

| Date | Task id | Note |
|------|---------|------|
| 2026-05-09 | A1 | Added `lib/books/pdf-js-document-load-inventory.ts` (contract + 7 load paths). |
| 2026-05-09 | A2 | Cached `/api/books` + map prefetch + `resolveInitialBookReaderSelection` shared with loader. |
| 2026-05-09 | A3 | `ensureReactPdfWorker()` on map + shared module; `usePdfJsWorker` + lesson preview use it. |
| 2026-05-09 | A4 | `loadCachedPdfDocument` + `PdfPage pdf=` in `BookCanvasStage`; removed overlay `Document`. |
| 2026-05-09 | B1 | Stay mounted after first open; `inert` + `aria-hidden` when closed; map `key` for student. |
| 2026-05-09 | B2 | `presentationReady` gates `isVisible`; timeout cap by `prefers-reduced-motion`. |
| 2026-05-09 | — | Reopen UX: only `setNumPages(null)` when book/unit selection changes; spread stage `bg-[var(--surface-2)]` vs raw white. |
| 2026-05-09 | B3 | Prime `pageAspectRatio` from `getPage` before `setSharedPdf`; viewport `baseKey` without aspect; reset aspect on unit change. |
| 2026-05-09 | B4 | `<link rel="preload" as="image">` for book frame from map route warm-up; shared `BOOK_OPENED_FRAME_IMAGE_SRC`. |
| 2026-05-09 | C1 | `reader-prefetch-window.ts`: visible-list ±4 slots, LRU cap 24, `getReaderPrefetchVisiblePageIndices`. |
| 2026-05-09 | C2 | `reader-page-prefetch-queue.ts` + controller idle prefetch; unit change clears bitmap cache. |
| 2026-05-09 | C3 | `ReaderPageSlot` prefetched canvas → `PdfPage` swap; prefetch cache subscribers. |
| 2026-05-09 | C4 | Alignment signature + 32px width buckets; stale-bucket eviction; unit switch already cleared. |
