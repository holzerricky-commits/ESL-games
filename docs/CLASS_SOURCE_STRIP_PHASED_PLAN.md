# Class source strip — phased implementation plan

Last updated: 2026-09-18

**Product source of truth:** `CLASS_SOURCE_STRIP_PRODUCT.md`  
**Notebook chip / rail jobs:** `NOTEBOOK_PRODUCT.md` (do not re-lock storage or Pin/Tab here).

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next. Do not skip phases unless a prerequisite is already done and checked.

**Four prompts (locked):** docs, then book swap, then notebook Focus, then chrome settle. Fewer dumps layout risk into the first code pass. More just redraws an empty bar.

```text
0 docs
  → 1 strip + book swap + notebook park/dock   ← ship this; teachable
      → 2 notebook Focus
          → 3 chrome settle
```

---

## Baseline (reuse, don’t rebuild)

- Left rail: `BookWorkspaceLeftBar`
- Mid-class book change: close overlay → yellow Pick shelf → open other cover (`chosenBookId` on the map route)
- Last page already saved per book/unit (`saveUnitPage` / `getSavedUnitPage`)
- Overlay already switches when `preferBookId` / `preferUnitId` change (`useBookLibraryLoader`)
- `handleOpenBook` currently no-ops while the overlay is presented
- Notebook: Pin / Tab / Overlay / Park per `NOTEBOOK_PRODUCT.md`; Boards picker goes away with the student notebook
- Class clock: `PrepSessionCapsule` tucked to the **right** of the source strip while the book is open
- Workshop place bar already uses `topChrome` + `--book-top-chrome-clearance`

---

## Phase 0 — Documentation ✅

| Item | Status |
|------|--------|
| `CLASS_SOURCE_STRIP_PRODUCT.md` | Done |
| `CLASS_SOURCE_STRIP_PHASED_PLAN.md` | Done |
| Cross-links in hub / board-nav / classroom home / `MILESTONE.md` / `PROJECT_CONTEXT.md` | Done with this pass |

**Your test:** Confirm: strip = sources; left rail = tools; X still goes to shelf; Focus is Phase 2 not Phase 1.

### Non-goals

- No extra product decisions in this phase.

---

## Phase 1 — Strip + book swap + notebook park/dock

**Goal:** Mid-class, tap the other book and keep teaching. Overlay never closes. Notebook chip is the same park/dock as the left-rail board button.

**Code status:** Implemented 2026-09-16. Acceptance still open for you.

### Tasks

- [x] Helper + tests: `listClassSourceBooks` from assigned books (role label + accent + last page). Always include a Notebook chip in the UI. One book → still show the strip.
- [x] `ClassSourceStrip` — thin top chips on the **open** fullscreen book overlay only. Not on yellow Welcome / Pick / Wrap. Not in Books workshop.
- [x] Book chips: catalog role (`Workshop` / `Literature`) or short title; quiet page (e.g. `p.42`); active = current Focus book.
- [x] Tap other book: set teaching book/unit **while `bookOpenPresented` stays true**. Resume saved page. Do **not** close to the shelf.
- [x] Flush current book page + ink/board before switching. Prefetch/warm the other PDF.
- [x] Notebook chip: pressed = board open and not minimized. Tap = existing whiteboard open / minimize.
- [x] Reserve top inset (`--book-top-chrome-clearance`) so the spread still fits. Chips stay **left**; clock/End tuck **right** (Phase 3).
- [x] No badges, streak, End, or tools on the strip.

### Files (expected)

- `lib/books/class-source-strip.ts` + `*.test.ts`
- `components/students/fullscreen-book-overlay/sections/ClassSourceStrip.tsx`
- Wire: overlay view + controller + `student-fullscreen-map-route-client.tsx`

### Acceptance (you test)

- [ ] Two assigned books: open Workshop → tap Literature → Literature at last page; no yellow shelf
- [ ] Tap Workshop again → back on the Workshop page you left
- [ ] Refresh mid-class → still on the focused book
- [ ] Notebook chip minimizes / restores the board; left-rail board button still matches
- [ ] X / Esc still returns to Pick shelf
- [ ] One-book student: strip still shows that book + Notebook; spread not clipped

### Non-goals

- Notebook as the main stage (Phase 2)
- Moving the class timer
- Docking a second book
- Keyboard `1`/`2` while the overlay is open (Phase 3)

**Paste this prompt:**

> Implement **Class source strip Phase 1 only** from `docs/CLASS_SOURCE_STRIP_PHASED_PLAN.md`. Visible top source chips on the open book overlay. Assigned books swap in-place (keep overlay open, restore last page). Notebook chip = existing board park/dock. Reserve top inset so the spread still fits. No notebook Focus, no timer move, no Hub. Then I test.

---

## Phase 2 — Notebook Focus

**Goal:** Notebook can own the desk. Book stays loaded (parked), not closed.

**Code status:** Implemented 2026-09-16. Acceptance still open for you.

### Tasks

- [x] Source visibility: exactly one Focus: a **book** or **notebook**.
- [x] Tap Notebook when a book is Focus → notebook Focus: hide the book spread (keep overlay + PDF warm). Board is the stage. Standard pages keep **native aspect** (do not stretch to spread width).
- [x] Tap a book chip from notebook Focus → that book Focus, notebook **Park** (minimized).
- [x] Strip: Notebook chip looks active in Dock *and* Focus; Focus is the stronger state.
- [x] Left rail: board tools still work in notebook Focus; page-list is book-only (don’t jump a hidden PDF).

### Acceptance (you test)

- [ ] Book → Notebook Focus: student sees the board, not the PDF
- [ ] Draw on a Standard page → ink not stretched
- [ ] Tap the book chip → same spread/page as before Focus
- [ ] Refresh in notebook Focus → still notebook, ink intact
- [ ] Dock still works if you restore split from the chip / left rail

### Non-goals

- Two books on screen
- Independent board vs PDF (Boards menu already does board-only switch)
- Typed class-log document

**Paste this prompt:**

> Implement **Class source strip Phase 2 only** from the plan. Notebook can take Focus (book parked, overlay stays warm). Standard board pages keep native aspect. Tapping a book chip restores that book and parks the notebook. No second-book dock, no timer move. Then I test.

---

## Phase 3 — Chrome settle

**Goal:** The bar doesn’t fight drawing, zoom, or the clock. Small pass only.

**Code status:** Implemented 2026-09-16. Acceptance still open for you.

Swap speed (follow-on): assigned books keep PDF.js + last-spread prefetch across chip taps; the previous spread stays on screen until the next one is ready. No dual on-screen dock.

### Tasks

- [x] Hide or ignore-pointer the strip while a pen/marker stroke is down, and while book Focus-zoom is boxing.
- [x] `1` / `2` while the overlay is open swap assigned books (same order as the shelf). Don’t steal keys from typing / page jump.
- [x] If the floating timer overlaps chips, nudge it under the strip or tuck time + End on the **right of the strip**. Don’t redesign End class.
- [x] Vocab / top-right overlay doesn’t sit on the chips.

### Acceptance (you test)

- [ ] Draw across the top of the page → no accidental tab hits
- [ ] Focus-zoom box still works
- [ ] `1` / `2` swap books; typing in a text label does not
- [ ] Clock and End still usable on screen share
- [ ] Strip still ~one row; book still the strongest visual

### Non-goals

- Hub, celebrations, extra tabs

**Paste this prompt:**

> Implement **Class source strip Phase 3 only**. Suppress strip during ink and focus-zoom. Overlay `1`/`2` book swap. Fix timer / vocab overlap if they collide. No new sources. Then I test.

---

## Parking lot (later tracks)

- Full Lesson Hub + `⌂ Hub` chip
- Focus book + Dock second book / split preset
- Moving End class into the strip as a product choice (only if Phase 3 felt cramped)
- Typed notebook / class log (still dead; live surface is Notebook)

---

## Test script (every code phase)

1. Start a live class with two assigned books.
2. Open one book, turn a page, ink something.
3. Use the **strip** (not X) to open the other book; confirm last page.
4. Switch back; confirm ink + page.
5. Notebook chip: Tab from strip; Pin / Park from rail (see `NOTEBOOK_PRODUCT.md`).
6. X → yellow shelf still works. End class still works.
