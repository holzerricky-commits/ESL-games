# Lesson board — phased implementation plan

Last updated: 2026-06-03

**Product source of truth:** `LESSON_BOARD_PRODUCT.md`

**Related (finding boards / book identity):** `LESSON_BOARD_NAV_PRODUCT.md` · `LESSON_BOARD_NAV_PHASED_PLAN.md` — separate track; do not mix into these page/dock phases unless a phase explicitly depends on it.

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next phase. Do not skip phases unless a prerequisite is already done and checked.

**Current codebase baseline (pre–Phase 1):**

- Session board per class; ink survives book page turns.
- Docked slot + **spread-width fullscreen** (to be removed).
- Single tall **runway** (`useInfiniteWhiteboardRunway`) + scroll; session ink on tall canvas (document-scroll paint).
- Header: swap slot, fullscreen, minimize; no **New page** yet.

---

## Phase 0 — Documentation ✅

| Item | Status |
|------|--------|
| `LESSON_BOARD_PRODUCT.md` | Done |
| `LESSON_BOARD_PHASED_PLAN.md` | Done |
| Cross-links in `INFINITE_WHITEBOARD_V1.md`, `MILESTONE.md` | Done with this pass |

**Your test:** Read both docs; confirm product matches what you want before Phase 1 code.

---

## Phase 1 — Data model: pages in session document

**Goal:** Storage is `pages[]`, not one flat `commands[]` on the session root. Existing sessions still load.

### Tasks

- [x] Define types, e.g. in `lib/books/lesson-board-types.ts`:
  - `LessonBoardPageOrientation`: `'standard' | 'wide'`
  - `LessonBoardPage`: `{ id, orientation, title?, bookPageHint?, contentHeightPx, commands[] }`
  - `LessonBoardDocument`: `{ pages, activePageId?, meta }` (or extend `WhiteboardSessionDocument`)
- [x] Constants: `LESSON_BOARD_STANDARD_ASPECT`, `LESSON_BOARD_WIDE_ASPECT`, min height = viewport baseline.
- [x] Migration on load: if legacy doc has root `commands[]` only → single page `standard`, preserve commands.
- [x] Update `WhiteboardSessionStore` (or successor) to read/write pages; append stroke to **active page**.
- [x] Unit tests: migration, round-trip save, `docId` unchanged for same session key.

### Files (expected)

- `lib/books/lesson-board-types.ts` (new)
- `lib/books/whiteboard-session-store.ts` (or parallel store)
- `lib/books/whiteboard-session-types.ts` (wire or alias)
- Tests under `lib/books/lesson-board*.test.ts`

### Acceptance (you test)

- [ ] Open board on an **old** saved session → content appears on **page 1**.
- [ ] Draw, refresh → ink still on page 1.
- [ ] No change yet to UI (still one tall runway is OK temporarily if migration-only behind flag).

### Non-goals

- TOC, new page button, orientation picker, remove fullscreen.

---

## Phase 2 — Single-page viewport + explicit New page

**Goal:** Teacher sees **one page at a time**; runway grows **within that page only**; **New page** adds an empty page and switches to it.

### Tasks

- [x] Session state: `activePageIndex` / `activePageId` in UI store.
- [x] `InfiniteWhiteboardPanel` (or rename): `contentHeightPx` from **active page** only; remove session-wide infinite scroll across pages.
- [x] Header: **New page** button (+ optional shortcut); creates Standard page, switches active.
- [x] Simple pager: **Page N of M** or prev/next chevrons in header (minimal).
- [x] `useInfiniteWhiteboardRunway` (or per-page hook): extend height for **active page** only; persist `contentHeightPx` on page record.
- [x] Point session ink + `BookPageAnnotationLayer` at active page `commands` + dimensions for that page orientation (Standard only in this phase).
- [x] Disable or noop session-wide “scroll through all pages” — scrolling is **inside** the current page.

### Files (expected)

- `components/students/fullscreen-book-overlay/sections/InfiniteWhiteboardPanel.tsx`
- `components/students/fullscreen-book-overlay/sections/WhiteboardChrome.tsx`
- `hooks/useInfiniteWhiteboardRunway.ts` → per-page runway
- `hooks/useWhiteboardInkSession.ts`

### Acceptance (you test)

- [ ] **New page** → blank page; draw on page 1 and page 2 → content stays separate after switch.
- [ ] Reload → still two pages with correct ink.
- [ ] Book page turn → board unchanged.
- [ ] Tall content on one page → scroll **inside** page; does not merge into next page without **New page**.

### Non-goals

- TOC strip, wide orientation, focus mode.

---

## Phase 3 — TOC + page previews (navigation)

**Goal:** Find and jump to any page in the session without prev/next only.

### Tasks

- [x] Collapsible **side rail** or drawer: list of pages (title or “Page N”). *(Repurposed `PageListRail` with **Book | Board** tabs when lesson board is open.)*
- [x] Thumbnail per page (render top portion or scaled snapshot of page commands / capture root). *(`LessonBoardPageThumbnail` + `lesson-board-page-thumbnail.ts`)*
- [x] Click thumbnail → set active page; main viewport updates.
- [x] Active page highlighted in list.
- [x] Optional: rename page title (inline or modal). *(Double-click label in Board tab.)*

### Files (expected)

- `PageListRail.tsx` — Book | Board tabs + board TOC
- `LessonBoardPageThumbnail.tsx` + `lib/books/lesson-board-page-thumbnail.ts`
- `lesson-board-session-ops.ts` — `setLessonBoardPageTitle`, display labels

### Acceptance (you test)

- [ ] 4+ pages → jump from TOC to page 3 in one click.
- [ ] Thumbnails distinguish empty vs inked pages.
- [ ] Teaching flow: docked slot + TOC usable on 1280×720 share screen.

### Non-goals

- Wide pages, focus overlay.

---

## Phase 4 — Standard + Wide page creation

**Goal:** Two orientations at create time; mixed TOC; correct logical canvas per page.

### Tasks

- [x] **New page** menu: **Standard** | **Wide** (orientation locked after create). *(`LessonBoardNewPageMenu` in header + TOC footer)*
- [x] Wide logical size: fixed aspect, width baseline = slot width; height from 16∶9 aspect.
- [x] Viewport: wide pages letterbox vertically in slot when shorter than viewport.
- [x] Ink + annotations use page’s width/height for norm coords (per-page `contentHeightPx` + orientation).
- [x] Thumbnails show **portrait vs landscape** shape (`lessonBoardThumbDimensions`).
- [x] TOC row shows orientation icon (portrait / landscape) beside label.

### Files (expected)

- `lib/books/lesson-board-types.ts` — orientation helpers
- `InfiniteWhiteboardPanel.tsx` — page dimensions from orientation
- `WhiteboardChrome.tsx` — new page menu
- `LessonBoardPageNav.tsx` — mixed aspect thumbnails

### Acceptance (you test)

- [ ] Create Wide page → draw wide diagram → switch to Standard page → no stretch.
- [ ] Return to Wide page → diagram unchanged.
- [ ] TOC shows one portrait and one landscape preview correctly.

### Non-goals

- Rotate page after creation; spread-width fullscreen.

---

## Phase 5 — Remove spread fullscreen (Focus removed per product review)

**Goal:** No spread-width stretch of Standard pages. Board stays **slot + wide auto-spread** only.

### Tasks

- [x] Remove `layoutMode === 'fullscreen'` spread-width path from `BookCanvasStage` / `useWhiteboardPlacement`.
- [x] **Focus mode removed** (user feedback) — no header zoom; slot side only in prefs.
- [x] Wide pages still auto-present across spread in slot mode (Phase 4).
- [x] Legacy `fullscreen` / `focus` session prefs ignored; only `slotSide` persisted.

### Files (expected)

- `hooks/useWhiteboardPlacement.ts`
- `BookCanvasStage.tsx`
- `WhiteboardChrome.tsx`
### Acceptance (you test)

- [ ] Standard page stays in slot; no control stretches it to spread width.
- [ ] Wide page still opens across spread (Phase 4).
- [ ] No focus / fullscreen button on board header.

### Non-goals

- Free-floating resize (Phase 6).

---

## Phase 6 — Float + dock (optional polish)

**Goal:** Board can detach, move, resize with **locked aspect**; dock returns to slot.

### Tasks

- [x] `layoutMode`: `'slot' | 'floating'` (drop old fullscreen).
- [x] Floating window: drag header grip, corner resize proportional.
- [x] Max size clamped to overlay; min size usable (`lesson-board-float-layout.ts`).
- [x] **Dock to book** restores slot + side.
- [x] Pointer / ink mapping unchanged (uniform CSS scale; same page document).
- [x] Wide pages auto-dock (spread overlay only).

### Files (expected)

- `hooks/useWhiteboardPlacement.ts`
- `hooks/useWhiteboardFloatMotion.ts`
- `lib/books/lesson-board-float-layout.ts`
- `BookCanvasStage.tsx`
- `InfiniteWhiteboardPanel.tsx`
- `WhiteboardChrome.tsx`

### Acceptance (you test)

- [ ] Float, draw, dock → ink aligns with slot view (no coordinate drift).
- [ ] Resize float window → content scales uniformly.

### Non-goals

- Independent width/height resize (breaks aspect).

---

## Phase 7 — Polish & hooks for recap / class log

**Goal:** Nice teaching details; metadata for future class log export.

### Tasks

- [ ] Optional `bookPageHint` when creating page (default: current PDF page).
- [ ] Soft hint when page height > 3× viewport: “Consider new page?”
- [ ] Page delete (with confirm) and/or duplicate.
- [ ] Update `INFINITE_WHITEBOARD_V1.md` appendix: mark superseded sections.
- [ ] `TODO(post-class)` export: page list + thumbnails for session note (stub only if no consumer).

### Acceptance (you test)

- [ ] Hint appears on very tall page; dismissible.
- [ ] bookPageHint visible in TOC or page settings.

---

## Dependency graph

```text
Phase 0 (docs)
    → Phase 1 (data)
        → Phase 2 (new page + single viewport)
            → Phase 3 (TOC)
                → Phase 4 (wide)
                    → Phase 5 (focus, kill fullscreen)
                        → Phase 6 (float) [optional]
                            → Phase 7 (polish)
```

---

## Testing checklist (every phase)

1. `npm run dev` — open reader, start/open class, open board (`W`).
2. Draw pen + marker + one sticky; undo if available.
3. Turn **book** page — board content unchanged.
4. Refresh browser — session persists.
5. Minimize board, reopen.
6. If phase touches layout: slot swap, focus/float, exit.

---

## Parking lot (not in v1 phases)

- Zoom/pan inside Standard page (portrait focus without new Wide page).
- Auto page at bottom (explicitly rejected).
- Merge with `NOTEBOOK_REBUILD_PHASES` class log entries.
- Multi-session board search across lessons — see **`LESSON_BOARD_NAV_PHASED_PLAN.md`** instead.
- Page reorder drag-and-drop in TOC.

---

## When a phase fails review

Document the issue at the bottom of this file under **## Phase review log** (date, phase, what broke, fix before continuing).

### Phase review log

*(Add entries as you test.)*
