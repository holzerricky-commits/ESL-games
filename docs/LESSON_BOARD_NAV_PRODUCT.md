# Lesson board navigation & identity — product decisions

Last updated: 2026-07-30

**Status:** Agreed direction. Implementation phases live in **`LESSON_BOARD_NAV_PHASED_PLAN.md`**.

**Related:** `LESSON_BOARD_PRODUCT.md` (board pages, dock/float), `LESSON_HUB_AND_MULTI_BOOK_PRODUCT.md` (later hub “Board” card), `PROJECT_CONTEXT.md` (book-first).

---

## Problem

Boards stay tied to **student + book + unit** (correct for teaching). Friction: with several books/units it is hard to tell **which notebook** you are in, and hard to **open the right one** without hunting — especially Workshop + Literature as two books.

---

## Locked rules

1. **Storage stays curriculum-scoped** — one lasting board per student + book + unit (`wb:session:local:{bookId}:{unitId}`). Do **not** merge into one mega-board per student across all books.
2. **Header left = notebook title** — short role label (`Workshop`, `Literature`, …) + color accent; tap opens **Boards** menu. Full library titles only in the menu / tooltip.
3. **Header right / center = tools + window** — image search, drag grip, More, float/dock/swap, minimize. No page arrows in the header.
4. **Footer = page navigation** — `‹ N/M ›` + New page (which page inside this notebook).
5. **Footer label** uses catalog **role** when available (`Workshop`, `Literature`, … via `resolveBookCatalogIdentity`); else a short title. Multi-unit: `Literature · Unit 3`.
6. **Boards menu** lists notebooks for **this student** from assigned books/units (not only the open book).
7. **Switch notebook → board only** — changing book/unit in Boards loads that lasting board; do **not** yank the PDF by default.
8. **PDF nav syncs board** — when the teacher changes book/unit in the reader, the board notebook follows that selection.
9. **One notebook / no peers** — if the shelf has only one entry, show label without a picker.
10. **End of unit ≠ create curriculum unit** — never invent new `BookUnit` rows from the board. Soft “next unit’s board” is Phase 2.
11. **Page list stays** — Boards finds *which notebook*; board TOC / page list finds *which page* inside it.
12. **Lesson-level nav** — later only.

---

## Chrome layout

```text
Header:  [● Workshop ▾] [search] …… grip …… [⋯] [float] [⇄] [−]
Footer:  …………… (‹ 2/5 ›) …………… (+)
```

Centered floating page pill; floating New page (+) on the right.

| Zone | Job |
|------|-----|
| Header left | Which notebook (title + Boards) |
| Header tools | Image search, layout, minimize |
| Footer | Pages inside this notebook |

---

## Out of scope

- Header tab strips for every unit or lesson
- One board for the whole student across books
- Teacher-created curriculum units at last PDF page
- Auto-switching the board on every book page turn
- Merging Workshop + Literature into one board
- Jumping PDF when picking another book’s board
- Full Lesson Hub carousel (student-home Boards list remains later)

---

## Success criteria

1. Teacher can tell at a glance which **book** (role) and **unit** (if multi-unit) the open board belongs to — from the **header title**.
2. With Workshop + Literature assigned, Boards menu lists both; picking the other loads that board without moving the PDF.
3. Page ‹ › and New page live in the **footer**; header stays title + tools.
4. Header tools stay usable on a docked share-screen width.
5. Leaving a unit can open the **next existing** unit’s board when offered (Phase 2); no handmade units.
6. Page titles / book-page hints make finding a page inside a board easy (Phase 3).

---

## Open questions (not blockers)

- ~~Whether “next unit board” triggers from last PDF pages, a Boards menu footer action, or both (Phase 2).~~ → **Both** (near-end chip + Boards menu shortcut).
- Student-home Boards list vs waiting for Lesson Hub.
