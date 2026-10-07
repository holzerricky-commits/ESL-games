# Notebook — phased implementation plan

Last updated: 2026-09-18

**Product source of truth:** `NOTEBOOK_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next. Do not skip phases unless a prerequisite is already done and checked.

```text
0 docs
  → 1 chrome contract (Pin / Tab / Overlay / Park)
      → 2 student-scoped store + merge
          → 3 book links (book + page + spot)
              → 4 copy settle   ← current
```

Page model (Standard / Wide, New page, ink) stays as built in `LESSON_BOARD_PHASED_PLAN.md`. Do not reopen that work here.

---

## Baseline (reuse, don’t rebuild)

- Strip Notebook chip + left-rail board button + header dock/float/minimize already exist
- Tab (notebook Focus) hides the book and keeps the PDF warm
- Pin = slot; Overlay = floating Standard page; Wide pages cover the spread
- Ink store today: `wb:session:local:{bookId}:{unitId}` (no student id on the key)
- Board links today: scoped to student + book + unit; payload is PDF page + spot only
- Boards menu lists per-book notebooks for this student

---

## Phase 0 — Documentation ✅

| Item | Status |
|------|--------|
| `NOTEBOOK_PRODUCT.md` | Done |
| `NOTEBOOK_PHASED_PLAN.md` | Done |
| Cross-links in board / nav / strip / hub / `MILESTONE.md` / `PROJECT_CONTEXT.md` | Done with this pass |

**Your test:** Confirm: one student notebook; Pin / Tab / Overlay / Park; strip = Tab; rail = Pin/Park; links optional and explicit; changing books does not swap notes.

### Non-goals

- Code.

---

## Phase 1 — Chrome contract ✅

**Goal:** One tap has one job. Same ink store as today. Teachable without a merge.

**Code status:** Implemented 2026-09-18. Acceptance still open for you.

### Tasks

- [x] Strip Notebook chip: Park → Tab; Pin/Overlay → Tab; Tab → Park (restore that book). Never Pin.
- [x] Strip visuals: Park = off; Pin/Overlay = present but **book** stays selected; Tab = Notebook selected, books not.
- [x] Left rail: Park/closed → Pin; Pin/Overlay → Park; Tab → Pin. Never Tab. Restore from Park is always Pin.
- [x] Rail label / title / aria: **Notebook** (Pin / Hide), not “lesson board”.
- [x] Header: **Pin to book** / **Overlay on book** / **Hide notebook**. Overlay still exits Tab. Wide pages still cannot Overlay.
- [x] `W` = rail (Pin / Park). Do **not** close the session.
- [x] `Esc` on an open notebook **Parks** (does not destroy the session). Book overlay close still goes to the yellow shelf.
- [x] Remember Pin vs Overlay vs Park vs Tab for the open class (refresh comes back to that layout).

### Files (expected)

- `components/students/fullscreen-book-overlay/sections/ClassSourceStrip.tsx`
- `lib/books/class-source-strip.ts` + `*.test.ts`
- `components/students/fullscreen-book-overlay/fullscreen-book-overlay-view.tsx`
- `hooks/useFullscreenBookOverlayController.ts`
- `sections/BookWorkspaceLeftBar.tsx`
- `sections/WhiteboardChrome.tsx`
- `hooks/useBookOverlayKeyboardShortcuts.ts`
- `docs/BOOK_OVERLAY_KEYBOARD_SHORTCUTS.txt`

### Acceptance (you test)

- [ ] Book open → rail → notebook Pins beside the book; strip still shows the book selected
- [ ] Strip Notebook → Tab (book hidden, notebook on the desk); tap book chip → same spread, notebook Parked
- [ ] From Pin, header Overlay → sheet on the book; Pin snaps back to the slot
- [ ] `W` Pins / Parks; it does not wipe the notebook
- [ ] Refresh in Pin stays Pin; refresh in Tab stays Tab
- [ ] Wide page still covers the spread; Standard page never stretches

### Non-goals

- New storage key, merge, link payload, Boards menu removal, `whiteboard*` rename

**Paste this prompt:**

> Implement **Notebook Phase 1 only** from `docs/NOTEBOOK_PHASED_PLAN.md`. Chrome contract: strip = Tab, rail = Pin/Park, header = Pin ↔ Overlay / Hide. `W` matches the rail (never close the session). `Esc` Parks the notebook. Strip visuals: Park off, Pin present with book selected, Tab = Notebook selected. Remember Pin/Overlay/Park/Tab across refresh. Same ink store. No student-scoped merge, no link rewrite. Then I test.

---

## Phase 2 — Student-scoped store + merge ✅

**Goal:** One lasting notebook per student. Changing books does not swap notes.

**Code status:** Implemented 2026-09-18. Acceptance still open for you.

### Tasks

- [x] Canonical key includes the student, e.g. `wb:session:local:student:{studentId}`.
- [x] First open for that student: **copy** pages from existing `wb:session:local:{bookId}:{unitId}` boards for this student’s assigned books/units into that notebook. Preserve page order inside each old board. Concatenate in assigned-book order, then unit order. Active page = the one that was active on the most recently used source board.
- [x] Stamp a weak source hint on copied pages (which book / unit / old `bookPageHint`) so Phase 3 can turn real links. Do not invent links.
- [x] Leave old book/unit keys in place as backup. Do not delete in this phase.
- [x] If two students later open the same old book/unit key, each gets a **copy** into their own notebook; they diverge after that.
- [x] Changing the PDF **never** loads a different notebook.
- [x] Boards menu as notebook picker: hide when there is only one student notebook (always, after this phase). Header title = **Notebook**, not Workshop / Literature.
- [x] Page list / footer still paginate **this** notebook.

### Files (expected)

- `lib/books/whiteboard-storage.ts` + tests
- `lib/books/student-notebook-merge.ts` + tests
- `lib/books/whiteboard-session-storage.ts` / session store load path
- Overlay controller + ink session hooks (`studentId` already flows in)

### Acceptance (you test)

- [ ] Draw on a page, switch Workshop → Literature: **same** notebook page still there
- [ ] Second student: empty or their own notes; not the first kid’s pages
- [ ] Reload: merged pages still there; old book/unit keys still on disk
- [ ] Header no longer implies “this is the Workshop board”
- [ ] Pin / Tab / Overlay from Phase 1 still work

### Non-goals

- Link jump UX, deleting old keys, TOC filters, code rename

**Paste this prompt:**

> Implement **Notebook Phase 2 only** from `docs/NOTEBOOK_PHASED_PLAN.md`. One lasting notebook per student (`wb:session:local:student:{studentId}`). Copy-merge existing book/unit boards into it on first open; leave old keys as backup. Changing books must not swap the notebook. Hide the Boards notebook picker. Header title = Notebook. No new link UX. Then I test.

---

## Phase 3 — Book links ✅

**Goal:** A page can point at a place in a book. Book is a citation, not a folder.

**Code status:** Implemented 2026-09-18. Acceptance still open for you.

### Tasks

- [x] One **primary** link per notebook page: `bookId` + PDF page + optional spot (normalized center). Persist with the student notebook (not a per-book-unit links file).
- [x] Teacher places the link on purpose (existing “link to book” placement is the interaction).
- [x] From the notebook page: **Go to {role} p.N** — Focus that book at that page; notebook Parks or Pins (Pin if it was Pin; Park if it was Tab).
- [x] On the book: marker opens **that** notebook page (Pin if book stays Focus).
- [x] Migrate old links: they already have page + spot; add `bookId` from the old scope.
- [x] No auto-create on page turn. Weak create/edit hints may still record book + page for recap; they are not links until the teacher places one.
- [x] Clear / replace the one primary link.

### Files (expected)

- `lib/books/lesson-board-page-links.ts` + tests
- `hooks/useBoardLinkPlacement.ts`
- Notebook chrome + page list (jump control)
- Book overlay markers

### Acceptance (you test)

- [ ] From a notebook page, link to Literature p.18; Go to → Literature p.18
- [ ] Tap the marker → that notebook page
- [ ] A page with no link stays unlinkable; turning the PDF does not create links
- [ ] Switch books without a jump: notebook does not follow
- [ ] Old markers on a merged Workshop board still resolve to Workshop, not the open book

### Non-goals

- Many links per page, TOC “linked to Workshop” filter, auto-hints as folders

**Paste this prompt:**

> Implement **Notebook Phase 3 only** from `docs/NOTEBOOK_PHASED_PLAN.md`. One primary link per page: book + PDF page + optional spot. Intent-only placement. Jump notebook → book and book marker → notebook page. Migrate old per-unit links with bookId. No auto-links on page turn. Then I test.

---

## Phase 4 — Copy settle

**Goal:** Teacher-facing language matches the product. Small pass only.

### Tasks

- [ ] Remaining “lesson board” / “whiteboard” / “dock” / “float” strings in overlay chrome, tooltips, aria, shortcuts file.
- [ ] `CLASS_SOURCE_STRIP_*` and board nav docs already point here; fix any leftover contradicting sentences found while grepping the UI.
- [ ] Optional: Notebook chip tooltip names the student, not a book.

### Acceptance (you test)

- [ ] A pass over strip, rail, header, `W`, shortcuts file: Notebook / Pin / Overlay / Hide
- [ ] No user-visible “lesson board” on the open class

### Non-goals

- Renaming `whiteboard*` modules, deleting backup keys, Hub card

**Paste this prompt:**

> Implement **Notebook Phase 4 only**. Teacher-facing copy: Notebook, Pin, Overlay, Hide. No storage or layout changes. Then I test.

---

## Parking lot (later tracks)

- Soft TOC groups (this unit, last class, linked to Workshop)
- Many links per page
- Delete old `wb:session:local:{bookId}:{unitId}` keys after a confirmed backup
- Rename `whiteboard*` / `lessonBoard*` code
- Student-home Notebook list / Lesson Hub card
- Search notebook pages

---

## Test script (every code phase)

1. Start a live class with two assigned books.
2. Pin notebook beside Workshop; write something; Overlay; Pin again.
3. Strip → Tab; tap Literature; confirm notebook Parked and Literature at last page.
4. Rail Pin on Literature: **same** notes (Phase 2+).
5. (Phase 3+) Link a page to Literature; jump both ways.
6. `W` and `Esc` Park; they do not wipe notes. X still goes to the yellow shelf.
