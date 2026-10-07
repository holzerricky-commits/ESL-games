# Lesson board navigation & identity — product decisions

Last updated: 2026-09-18

**Status:** **Partly superseded.** Ownership, Boards-as-notebook-picker, and “PDF nav syncs board” now live in **`NOTEBOOK_PRODUCT.md`**. Footer page nav (`‹ N/M ›` + New page) and page-list TOC **still stand**. Remaining nav phases: **`LESSON_BOARD_NAV_PHASED_PLAN.md`**.

**Related:** `NOTEBOOK_PRODUCT.md` (student notebook + links), `LESSON_BOARD_PRODUCT.md` (page model), `LESSON_HUB_AND_MULTI_BOOK_PRODUCT.md` (later hub card), `CLASS_SOURCE_STRIP_PRODUCT.md` (book chips), `PROJECT_CONTEXT.md` (book-first).

---

## Problem

~~Boards stay tied to student + book + unit.~~ **Superseded:** there is one notebook per student. Friction that remains is **finding a page** (titles, links), not hunting which notebook.

---

## Locked rules

1. **Storage is the student notebook** — one lasting notebook per student (`NOTEBOOK_PRODUCT.md`). Do **not** keep a separate board per book + unit. Do **not** merge across students.
2. **Header left = Notebook** — no book-role picker after the student notebook ships. Page **links** carry book identity.
3. **Header right / center = tools + window** — image search, drag grip, More, Pin/Overlay, Hide. No page arrows in the header.
4. **Footer = page navigation** — `‹ N/M ›` + New page (which page inside this notebook).
5. **Footer** does not name a book. Book identity is on **page links**.
6. **Boards menu as notebook picker** — **removed** (Phase 2 shipped). There is only one student notebook.
7. **Switching books does not switch notebooks** — the open PDF is not the notebook’s container. Links on pages cite a book.
8. ~~**PDF nav syncs board**~~ — **superseded.** Changing book/unit in the reader must **not** load a different notebook.
9. **One notebook / no peers** — header shows **Notebook** without a picker.
10. **End of unit ≠ create curriculum unit** — never invent new `BookUnit` rows from the notebook.
11. **Page list stays** — TOC / page list finds *which page* inside the student notebook.
12. **Lesson-level nav** — later only.

---

## Chrome layout

```text
Header:  [Notebook] [search] …… grip …… [⋯] [Pin/Overlay] [⇄] [Hide]
Footer:  …………… (‹ 2/5 ›) …………… (+)
```

Centered floating page pill; floating New page (+) on the right.

| Zone | Job |
|------|-----|
| Header left | Notebook (no book picker) |
| Header tools | Image search, Pin / Overlay, Hide |
| Footer | Pages inside this notebook |

---

## Out of scope

- Header tab strips for every unit or lesson
- One board **across students** (one notebook **per student** is the product)
- Teacher-created curriculum units at last PDF page
- Auto-switching the board on every book page turn
- Merging Workshop + Literature into **separate** notebooks (they share the student notebook)
- Jumping PDF when following a page **link** is allowed; picking “another book’s board” is gone
- Full Lesson Hub carousel (student-home Boards list remains later)

---

## Success criteria

1. Teacher can tell this is **this student’s Notebook** — from the header title. Book identity lives on **page links**, not as the document title.
2. With Workshop + Literature assigned, there is still **one** notebook; links point at the right book.
3. Page ‹ › and New page live in the **footer**; header stays title + tools.
4. Header tools stay usable on a pinned share-screen width.
5. Page titles / book links make finding a page inside the notebook easy (`NOTEBOOK_PHASED_PLAN.md` Phase 3).

---

## Open questions (not blockers)

- Student-home Notebook list vs waiting for Lesson Hub (parking lot).
- Soft TOC groups (this unit, last class, linked to Workshop) — later, still one document.
