# Reader instant turn plan (industry-standard page flip)

**Status:** R0–R5 shipped in code — manual acceptance below.

**Related docs:** `FULLSCREEN_BOOK_STABLE_PAGES_PLAN.md`, `FULLSCREEN_BOOK_PREFETCH_PAGE_TURN_TASKS.md`, `MILESTONE.md` (Phase 1 reader quality).

**North star:** Instant page flip on keypress; load pages ahead; on turn always show **something** (blurry placeholder → sharp), never a blank white spread.

---

## How teachers should experience it (plain English)

| Situation | Expected behavior |
|-----------|-------------------|
| **One tap** next/back | Spread changes **right away**; sharp if ready, otherwise **soft/blurry** page for a split second, then sharp. |
| **Several quick taps** (e.g. 5× right) | **One visible spread per tap** when possible — pages may flash by fast, but you should **not** teleport straight to “+5” with nothing in between. |
| **Hold** arrow key | Fast stepping through spreads; may cap speed, but still **moving through** pages. |
| **Jump** to a page (list / typed number) | OK to land **directly** on that page (you chose a target). |
| **First open** book | Brief full-viewport load is OK; after that, not on every arrow key. |

**Not industry-standard (current bugs to fix):**

- Five separate taps → only see the **final** spread (teleport).
- **White blank** spread while the real page loads.
- Full-screen “Loading pages…” on every turn.

---

## Product rules

### No blank spread on routine turns

> On page turn, the teacher must **always** see book content (sharp or soft), or a **small loader on the spread** — **never** an empty white spread with nothing on it.

| OK | Not OK |
|----|--------|
| Slightly blurry page briefly | Empty white spread, no book content |
| Small loader on the spread only | Full-screen “Loading pages…” on every arrow key |
| Old page for one frame while new page sharpens (fallback) | Frozen on old page with no response |
| Sharp page when cache is ready | Teleport +5 with no visible steps between |

### Progressive page on turn (placeholder only when sharp missing) — **R3**

> **Not** a deliberate “blurry-then-sharp” effect. Show blur **only** when sharp is not ready. If full-res cache or PDF is ready, show **sharp immediately** with **no blur flash**. When sharp is missing, flip instantly and show a soft stand-in (low-res prefetch or upscaled thumbnail + light CSS blur), then **cut** to sharp when it arrives. Ink/annotations stay sharp on top.

**How (conceptual):**

```text
Press Next
  → Anchor moves to new spread immediately (R1)
  → If sharp ready: full cache or PDF — no placeholder
  → Else: placeholder (low-res P0 cache → 240px thumb → 76px thumb) + blur(2px)
  → When sharp ready: instant cut placeholder off (no long crossfade)
  → R3.5 optional: keep previous spread until placeholder/sharp (not needed if placeholder is instant)
```

**Building blocks (R2 + R3 wired):**

- Sidebar / page-list **thumbnails** — `peekCachedThumbnailDataUrl` (76px / 240px).
- **Low-res P0** prefetch — `getReaderPrefetchedLowResBitmap`.
- **Full spread** cache — `getPageRenderCacheBitmap` / sharp layer.
- Display policy — `lib/books/reader-page-display.ts`, `ReaderPageSlot.tsx`.

**Not a guarantee in every edge case:** broken PDF, first open, jump 20 pages ahead with zero warm-up — but **normal next/prev** should never be white.

---

## How to use this file

1. Complete **one phase** in Agent mode.
2. Review in the app (checklist under that phase).
3. Check boxes; add **Finished: YYYY-MM-DD** if helpful.
4. Say **“start R1b”**, **“start R2”**, etc.

---

## Phase R0 — Policy decisions

- [x] **R0.1** Optimistic navigation — page updates on every valid turn.
- [x] **R0.2** Prefetch tiers: P0 immediate (current + next 3 spreads forward + 1 back); P1 idle (rest of ±10).
- [x] **R0.3** Display while warming — cache, else PDF; **blurry placeholder** until sharp (R3).
- [x] **R0.4** No cache gate on routine turns.
- [x] **R0.5** Instant cut; slide off; crossfade off (hotfix).
- [x] **R0.6** Debounced last-page save; flush on close / unit change.
- [x] **R0.7** One visible step per discrete tap (not teleport) — **R1b**.
- [x] **R0.8** Blurry placeholder from cache when sharp not ready — **R3**.

**R0 signed off:** 2026-05-31 (user)

---

## Phase R1 — Instant navigation

| ID | Task | Done |
|----|------|------|
| R1.1 | Commit page in bounds without cache gate | [x] |
| R1.2 | Removed blocking `pendingPageNumber` | [x] |
| R1.3 | Skip pixel-ready reset when new spread cache-primed | [x] |
| R1.4 | Debounced `saveUnitPage` | [x] |
| R1.5 | No full-screen hold after first drawable | [x] |

### R1 hotfix (2026-05-31)

- [x] Keep book stage visible after first open (`spreadHasBeenDrawable`).
- [x] Crossfade off — instant cut only.
- [x] Crossfade cleanup does not leave spread at zero opacity.

### R1 manual acceptance

- [ ] Spam ArrowRight: anchor moves every press.
- [ ] Close book / switch unit: last page still saved.

**Phase R1 complete:** [ ] — _date after review_

**Known gaps (drive R1b + R3):** teleport on burst taps; white blanks on cold pages.

---

## Phase R1b — One visible step per tap (not teleport)

**Problem:** Five quick rights update the page five times but the screen only paints once → you land on +5 with no visible steps. That is **not** how PDF/slide apps behave for discrete taps.

| ID | Task | File(s) | Done |
|----|------|---------|------|
| R1b.1 | Track anchor with a **ref** so each tap advances from the latest page, not stale state | `useGatedBookNavigation.ts`, `reader-adjacent-turn-step.ts` | [x] |
| R1b.2 | Step queue: first tap instant, further steps ~48 ms apart (one visible spread each) | `useGatedBookNavigation.ts` | [x] |
| R1b.3 | Coalesce **save** only (`scheduleSaveUnitPage`); display uses step queue | `progress.ts` | [x] |

### R1b manual acceptance

- [ ] Five quick taps: see **up to five** spread changes (fast is OK; teleport to final only is not).
- [ ] Single tap: still instant.

**Phase R1b complete:** [ ] — _date_

---

## Phase R2 — Priority prefetch (ahead-loading)

**Problem:** ±10 window loads on idle; next spreads often not ready → blanks and slowness.

| ID | Task | Done |
|----|------|------|
| R2.1 | Helper: `{ immediate, idle }` page lists | [x] |
| R2.2 | Controller: immediate P0, idle for rest | [x] |
| R2.3 | Kick immediate prefetch on adjacent turn | [x] |
| R2.4 | Optional burst concurrency for immediate queue | [x] |
| R2.5 | Sort immediate: forward first | [x] |
| R2.6 | **Prefetch fast low-quality** bitmaps for P0 window (placeholder source for R3) | [x] |

### R2 manual acceptance

- [ ] Sit on page ~2 s, flip forward: spreads 11–14 often **sharp** quickly.
- [ ] Throttled network: turn still instant; quality catches up.

**Phase R2 complete:** [ ] — _date_

---

## Phase R3 — Progressive display (placeholder only when sharp missing)

**Problem:** White blanks when sharp cache/PDF not ready; R1 alone does not show a stand-in image.

| ID | Task | File(s) | Done |
|----|------|---------|------|
| R3.1 | On turn: show **placeholder** immediately — upscale existing thumbnail and/or fast low-res cache + light CSS blur | `reader-page-display.ts`, `ReaderPageSlot.tsx` | [x] |
| R3.2 | When **sharp** bitmap/PDF ready, **cut** placeholder → sharp (page layer only; no long crossfade) | `ReaderPageSlot.tsx` | [x] |
| R3.3 | Blur on **page image only**; annotations stay sharp | `ReaderPageSlot.tsx` (z-0 page, z-2+ ink) | [x] |
| R3.4 | Split **open ready** vs **turn ready** — no full-viewport spinner on routine turns | `spread-drawable-ready.ts`, view | [x] |
| R3.5 | Optional fallback: keep **previous spread** visible until placeholder or sharp exists | — | [ ] skipped — placeholder + book paper bg first |
| R3.6 | Wire `peekCachedThumbnailDataUrl` (76px / 240px) when full cache miss | `reader-page-display.ts` | [x] |

### R3 manual acceptance

- [ ] Cold turn: **instant** flip + **blurry/s soft** page (not white), then sharp.
- [ ] Cached turn: sharp immediately, no unnecessary blur flash.
- [ ] Ink on top stays sharp while page softens.

**Phase R3 complete:** [x] — 2026-06-01 (placeholder only when sharp missing; PDF visibility fix same day)

---

## Phase R4 — Flip polish & cleanup

| ID | Task | Done |
|----|------|------|
| R4.1 | Crossfade stays off unless revisited with safe cleanup | [x] hotfix |
| R4.2 | Slide remains off in docs (`feature-flags.ts`, `FULLSCREEN_BOOK_STABLE_PAGES_PLAN.md`) | [x] |
| R4.3 | _(Optional)_ LRU 48→64 | [ ] deferred |
| R4.4 | Tests: prefetch priority, R1b step scheduler, placeholder | [x] |

**Phase R4 complete:** [x] — 2026-06-01

---

## Phase R5 — Smarter prefetch

| ID | Task | Done |
|----|------|------|
| R5.1 | Direction-aware prefetch (3 back / 1 forward when flipping back) | [x] |
| R5.2 | Jump prefetch (target ±1 spread immediate) | [x] |
| R5.3 | Map warm + next 2 spreads at heuristic width | [x] |

**Phase R5 complete:** [x] — 2026-06-01

_(Former R5.4 “two-tier bitmap” is core **R3** + **R2.6**, not optional.)_

---

## Explicit non-goals

- [x] Do not block routine turns on prefetch cache.
- [x] Do not rely on idle-only prefetch for **next** spreads (R2).
- [x] No full-screen loading overlay on every turn (after first drawable).
- [x] No 3D curl / spread slide as default.
- [x] No prefetch of entire unit in one go.
- [ ] Do not treat five discrete taps as “jump to final page” with no intermediate frames (R1b).

---

## Implementation order

```text
R0 ✓ → R1 ✓ (+ hotfix) → R1b → R2 (+ low-res prefetch) → R3 → R4
```

**Recommended next Agent prompt:** `start R1b` then `start R2 and R3`.

---

## Key files index

| Area | Path |
|------|------|
| Navigation | `hooks/useGatedBookNavigation.ts` |
| Controller | `hooks/useFullscreenBookOverlayController.ts` |
| View (stage visibility) | `fullscreen-book-overlay-view.tsx` |
| Prefetch priority | `lib/books/reader-prefetch-priority.ts` |
| Prefetch direction (R5.1) | `lib/books/reader-prefetch-direction-bias.ts` |
| Map warm | `lib/books/map-initial-book-spread-warmup.ts` |
| Prefetch queue | `lib/books/reader-page-prefetch-queue.ts` |
| Thumbnails (placeholder source) | `lib/books/pdf-thumbnail-cache.ts` |
| Page display | `sections/ReaderPageSlot.tsx` |
| Placeholder vs sharp policy | `lib/books/reader-page-display.ts` |
| Drawable contract | `lib/books/spread-drawable-ready.ts` |
| Flags | `lib/books/feature-flags.ts` |
| Progress save | `lib/books/progress.ts` |

---

## Changelog

| Date | Phase | Notes |
|------|-------|-------|
| 2026-05-31 | — | Plan created. |
| 2026-05-31 | R0 | Signed off. |
| 2026-05-31 | R1 | Optimistic nav, debounced save, slot visibility. |
| 2026-05-31 | R1 hotfix | Stage stay visible; crossfade off. |
| 2026-05-31 | Plan | Added R1b (visible step per tap), R3 progressive blurry placeholder, industry UX table, R2.6 low-res prefetch. |
| 2026-05-31 | R1b | Anchor ref + adjacent step queue (`reader-adjacent-turn-step.ts`, 48 ms between queued steps). |
| 2026-05-31 | R2 | P0/P1 split (`reader-prefetch-priority.ts`), immediate burst concurrency (5), low-res P0 cache for R3. |
| 2026-06-01 | R3 | Placeholder only when sharp missing; low-res + thumbnail fallback; instant cut; `reader-page-display.ts`. |
| 2026-06-01 | R3 fix | `ReaderPageSlot`: do not hide PDF after load (`pageImageHidden` = cache overlay only). |
| 2026-06-01 | R4 | Docs + tests (`reader-adjacent-step-queue`, existing prefetch/display tests). |
| 2026-06-01 | R5 | Direction bias, jump ±1 P0, map warm +2 forward (`reader-prefetch-direction-bias.ts`). |
