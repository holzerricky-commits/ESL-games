# Notebook — product decisions (locked)

Last updated: 2026-09-18

**Status:** Agreed direction. Implementation phases live in **`NOTEBOOK_PHASED_PLAN.md`**.

**UI names (teacher-facing):** Notebook · Pin · Tab · Overlay · Hide

**Code may still say** `whiteboard` / `lesson board` until a later rename pass. Do not block teaching work on that rename.

**Related:** `LESSON_BOARD_PRODUCT.md` (page model: Standard / Wide, New page, ink — still stands), `CLASS_SOURCE_STRIP_PRODUCT.md` (book chips + Notebook as a source), `PROJECT_CONTEXT.md` (book-first, 1:1 screen share).

**Supersedes for Notebook ownership and chrome:** book-scoped storage and “PDF change swaps the board” in `LESSON_BOARD_NAV_PRODUCT.md` and `CLASS_SOURCE_STRIP_PRODUCT.md`; dock/float/minimize naming as the teacher-facing model in `LESSON_BOARD_PRODUCT.md`. Typed class-log notebook in `NOTEBOOK_REBUILD_PHASES.md` stays dead.

---

## What this is

Notebook is **this student’s lasting working paper**. Ink, stickies, images, diagrams, vocab lists. It survives page turns, book swaps, and the next class.

It is **not**:

- A third book
- A typed class log you “save the whiteboard into”
- A scratch pad that dies when you close the overlay
- One notebook per book or PDF unit
- A notebook shared across students

Pinning it beside a book is **layout**, not ownership. The same notebook can sit next to Workshop or Literature.

---

## Ownership

| Decision | Choice |
|----------|--------|
| Hard tie | **This student** |
| Not tied to | Open PDF, book unit, single class session |
| Across students | Never. One kid, one notebook |
| Change book | **Same notebook stays.** The open book is what you can pin beside or link to |
| Boards menu as notebook picker | Goes away once there is one notebook per student. TOC + links find pages |

Existing per-book / per-unit boards **merge by copy** into that student notebook (see phased plan). Old keys stay as backup until a later cleanup.

---

## Layouts (exactly one)

| State | Student sees | Meaning |
|-------|--------------|---------|
| **Pin** | Book + notebook in the slot | Teaching with the page. **Home** layout |
| **Tab** | Notebook owns the desk; book stays loaded | Notebook is the page |
| **Overlay** | Notebook floating on the spread | Quick sheet over the book |
| **Park** | Book only | Hidden; one tap away |

Park is hide, not a teaching layout. Do not add more window states.

### Page kinds (unchanged from lesson board)

- **Standard** pages can Pin, Tab, or Overlay. Never stretch to spread width.
- **Wide** pages cannot Overlay as a free window. With a book focused, a Wide page covers the spread. In Tab, it is just the stage.

---

## Control jobs (one tap, one job)

No control cycles Pin → Tab → Overlay → Park.

| Surface | Job |
|---------|-----|
| **Source strip** Notebook chip | **Tab.** Where we are. |
| **Left rail** | **Pin / Park.** Put the notebook on the desk / take it off. |
| **Notebook header** | **Pin ↔ Overlay** (Standard pages only), or **Hide** (Park). Swap Pin side. |

### Strip

| From | Tap Notebook chip |
|------|-------------------|
| Park | **Tab** |
| Pin | **Tab** (promote) |
| Overlay | **Tab** |
| Tab | **Park** (restore the book that was showing) |

Tap a **book** chip from Tab → that book Focus, notebook **Parks**.

Visual:

- **Park** — chip looks off (not selected)
- **Pin / Overlay** — notebook looks present; the **book** chip stays the selected source
- **Tab** — Notebook is the only selected source; book chips are not selected

Strip never Pins. Want notes beside the book → rail.

### Left rail

| From | Tap rail |
|------|----------|
| Park / closed | **Pin** |
| Pin | **Park** |
| Overlay | **Park** |
| Tab | **Pin** (book visible again, notebook in the slot) |

Rail never takes Tab. Restore from Park is always **Pin**, not last Tab/Overlay.

Teacher-facing label: **Notebook** (not “lesson board”).

### Header

| Now-ish copy | Locked copy |
|--------------|-------------|
| Dock to book | **Pin to book** |
| Float board | **Overlay on book** |
| Minimize | **Hide notebook** |
| Move board to other side | Keep, **Pin only** |

Overlay is only for Standard pages while a book is visible. Overlay from Tab is not offered: Tab already owns the desk. Choosing Overlay exits Tab (book visible under the sheet).

---

## Keyboard and close

| Control | Job |
|---------|-----|
| `W` | Same as left rail: **Pin / Park**. Never destroy the session |
| `Esc` (notebook on desk) | **Park**. Does not close the session |
| Overlay `X` / Esc (book close) | Yellow **shelf**. Class-level close, not notebook close |
| `Alt+← / Alt+→` | Swap Pin side |

---

## Persistence (open class)

- Remember **Tab** across refresh (already).
- Also remember **Pin vs Overlay** vs Park.
- After refresh in Pin or Overlay, come back to that layout, not Tab.
- Parked stays parked.

---

## Links (book is a citation)

A notebook page may have **no link**, or **one primary link**:

- which **book**
- which **PDF page**
- optional **spot** on that page

From the notebook: **Go to Workshop p.42**.  
From the book: a small marker that opens **that notebook page**.

| Rule | Choice |
|------|--------|
| Create | **Intent only** — teacher places the link |
| Not | Auto-create on page turn or every edit |
| Count | **One primary link** per page (v1) |
| Weak hint | Optional “created while on Literature p.18” for recap; never a folder; never swaps notebooks |

Today’s board-page markers already place a spot; they only store a page number because the book was implied. Links must store **book + page + spot**.

---

## Finding pages

After the merge, finding is a **page** problem:

- Footer `‹ N/M ›` + New page (unchanged)
- Page list / TOC + optional titles
- Jump via book link

**Later (parking lot, not v1):** soft TOC groups (this unit, last class, linked to Workshop). Still one document.

---

## Non-goals

- Mega-notebook across students
- Typed class-log document
- Window manager / taskbar
- Second book docked beside the first
- Auto-links on page turn
- Many links per page (v1)
- Renaming every `whiteboard*` symbol in code (later)
- Workshop reader source strip (place bar already owns that top)

---

## Success

1. Mid-class, rail Pins the notebook beside the book; strip takes Tab; header Overlays; none of those three guesses another layout.
2. Switch Workshop → Literature: **same notebook**, same pages.
3. A page can link to Literature p.18; tap goes there; the book marker opens that page.
4. Two students on this machine never share one notebook.
5. Teacher-facing chrome says Notebook / Pin / Overlay / Hide — not board / whiteboard / dock / float.

---

## Relation to older docs

| Doc | Relationship |
|-----|----------------|
| `LESSON_BOARD_PRODUCT.md` | **Page model** (Standard / Wide, New page, coordinates) still stands. Layout chrome and ownership → this doc. |
| `LESSON_BOARD_NAV_PRODUCT.md` | Footer page nav still stands. Per-book storage, PDF-syncs-board, and Boards-as-notebook-picker → superseded. |
| `CLASS_SOURCE_STRIP_PRODUCT.md` | Book chips and strip height still stand. Notebook chip / rail jobs and storage → this doc. |
| `NOTEBOOK_REBUILD_PHASES.md` | Historical typed class log. Do not revive. |
| `INFINITE_WHITEBOARD_V1.md` | Historical runway. Pages live in lesson-board types. |
