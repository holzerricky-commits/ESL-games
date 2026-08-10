# Lesson board navigation & identity — phased implementation plan

Last updated: 2026-07-30

**Product source of truth:** `LESSON_BOARD_NAV_PRODUCT.md`  
**Base board product:** `LESSON_BOARD_PRODUCT.md` / `LESSON_BOARD_PHASED_PLAN.md`

**How to use:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next. Do not skip phases unless a prerequisite is already done and checked.

**Ship bar:** Phase **1** (footer + cross-book Boards) must feel teachable. Phase **2** next-unit handoff after that. Phase **3** when finding pages inside a unit hurts. Phase **4** student-home Boards list only if still painful weekly (or Lesson Hub).

---

## Phase 0 — Documentation

| Item | Status |
|------|--------|
| `LESSON_BOARD_NAV_PRODUCT.md` | Done (updated for footer + cross-book) |
| `LESSON_BOARD_NAV_PHASED_PLAN.md` | Done |
| Cross-links from lesson-board product + `MILESTONE.md` | Done with this pass |

**Your test:** Read both nav docs; confirm they match what you want before Phase 1 code.

**Non-goals:** Code.

---

## Phase 1 — Identity + Boards picker (footer)

**Goal:** Always see which notebook is open; switch across **books and units** without crowding header tools or jumping the PDF.

### Tasks (initial header pass — superseded by UX correction)

- [x] Shelf helper for one book’s units + tests.
- [x] Board-only unit switch (flush → load) without jumping PDF.

### Tasks (UX correction — footer + cross-book)

- [x] **Header = tools only** — remove identity from header.
- [x] **Footer** identity: role/short label + color accent; multi-unit `Role · Unit`.
- [x] **Boards menu** lists assigned books/units for the student (Workshop + Literature).
- [x] Board spine: `lessonBoardBookId` + `lessonBoardUnitId` (independent of PDF until book nav syncs).
- [x] Chrome height includes header + footer for runway math.
- [x] Unit tests: role labels, two books one unit each, multi-unit titles.

### Acceptance (you test)

- [ ] Header left shows short role (`Workshop` / `Literature`); Boards lists assigned books; pick other → board swaps; PDF stays.
- [ ] Footer has page ‹ › and New page; header has no pager.
- [ ] Docked board: title readable; right-side tools still fit.
- [ ] Refresh: ink still on the correct book/unit notebook.
- [ ] Docked + floating: chrome consistent.

### Non-goals

- Jump PDF on Boards pick; lesson submenu; creating units; student-home entry; page-title polish (Phase 3).

**Code status:** Footer + cross-book Boards implemented 2026-07-30. Chrome retune 2026-07-30: title left in header; page nav + New page in footer. Acceptance still open for you.

---

## Phase 2 — End of unit / sparse outline

**Goal:** Leaving a unit feels intentional; books without a rich outline stay simple. **Never** invent curriculum units from the board.

### Tasks

- [x] Soft handoff when a **next unit already exists**: “Open next unit’s board?” (from near last pages of current unit and/or a control near the picker).
- [x] No next unit → no create-unit flow; rely on **New page** / titled pages on the current board.
- [x] No lessons outline → still only units that exist in the library (or one board); **never** invent `BookUnit` records.
- [x] Keep single-unit experience calm (Phase 1 hide-picker rule).

### Acceptance (you test)

- [ ] Finish / hand off Unit 3 → Unit 4 board opens; Unit 3 notes safe.
- [ ] Last unit in book → no “create unit” dead end.
- [ ] Simple one-PDF book → still one calm board.

### Non-goals

- Auto-create book units; auto-switch board on every PDF page turn; lesson chrome.

**Code status:** Soft near-end chip + Boards menu “Open next unit board” shipped 2026-07-30. Acceptance still open for you.

---

## Phase 3 — Find pages inside the board

**Goal:** Right book/unit is open — find the page that had the notes.

### Tasks

- [x] Easy **page titles** set/edit from the board page list.
- [x] Show **book page hint** in the page list (PDF page when created/last edited).
- [x] Optional: surface titled / recent pages first.

### Acceptance (you test)

- [ ] Name two pages → jump from list in one click.
- [ ] Page hint is useful enough for a quick recap.

### Non-goals

- Full-text / handwriting search; AI auto-titles; lesson grouping (later).

**Code status:** Pencil rename + book page hints + titled-first TOC shipped 2026-07-30. Waiting on your acceptance before Phase 4.

---

## Phase 4 — Open a board without hunting (optional)

**Goal:** From student/class: pick a past board by book name/color + unit without remembering which book to open first.

### Tasks

- [ ] “Boards” list for this student: color accent + book title + unit + last used (and/or page count).
- [ ] One action → open that book + that board (same identity language as header).
- [ ] Keep minimal until full Lesson Hub; can map to hub “Board” card later.

### Acceptance (you test)

- [ ] From student/class → correct board in ≤2 clicks.

### Non-goals

- Full Lesson Hub carousel; lesson tabs; global search across all students.

**Park** this phase if Phases 0–3 already fix weekly teaching pain.

---

## Dependency graph

```text
Phase 0 (docs)
  → Phase 1 (identity + unit picker)     ← main teach win
      → Phase 2 (next-unit handoff)
          → Phase 3 (page titles / hints)
              → Phase 4 (open from student/class) [optional]
```

---

## Testing checklist (every phase that touches the app)

1. Open a student → book → board.
2. Draw something; refresh; still there.
3. Turn book pages; board unchanged.
4. If multi-unit: switch unit boards both ways; nothing lost.
5. Minimize / reopen board.
6. Confirm header identity (book name + color) still readable when docked.

---

## Parking lot (not in these phases)

- Lesson-level filter/group or “jump book to lesson” submenu.
- Optional “Open this unit in the book” when switching boards.
- One storage key per book (merge units) — only if Phase 1–2 still feel wrong after real classes.
- Color customization UI for teachers.
- Full Lesson Hub integration beyond a minimal Boards list.

---

## When a phase fails review

Document under **## Phase review log** (date, phase, what broke, fix before continuing).

## Phase review log

_(empty)_
