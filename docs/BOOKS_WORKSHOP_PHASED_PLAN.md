# Books workshop chrome — phased plan

Last updated: 2026-08-20

**Product:** `docs/BOOKS_WORKSHOP_PRODUCT.md`  
**Rule:** Implement **one phase at a time**. Test before continuing.

---

## Phase 0 — Lock docs

- [x] Product + this plan
- [x] Pointers from `BOOKS_LIBRARY_*`, `READING_CHECKS_PRODUCT.md`, `MILESTONE.md`

**Status:** Done 2026-08-20.

---

## Phase 1 — Place bar (this slice)

**Goal:** Open workshop from an outlined part → thin bar says where you are + Close. Checks wizard does **not** auto-open (or open at all).

- [x] Place bar on the workshop book (docked chrome, not overlay)
- [x] Line: book · lesson · part/type · pages (skip empties)
- [x] Close returns to the part desk
- [x] Do not mount / auto-open the Checks prep sheet
- [x] Class Continue Checks shortcut unchanged

**Test:** Story part → Open book → bar shows the story, no side wizard. Close → still on that part.

**Status:** Code in 2026-08-20 — test next.

---

## Phase 2 — Outlined story tools

**Goal:** This part’s scan + check list + place pins + Approve, without “pick a story.”

- [x] Open outlined story → story tools panel (locked to that story)
- [x] Scan text + checks pack + Place on book + Approve
- [x] No pick-book / pick-story wizard
- [x] Place bar **Tools** toggles the panel; pin place dismisses it
- [x] Class Continue Checks shortcut unchanged

**Test:** Story part → Open book → tools for that story → scan → checks → pin → Approve. Close book → still on that part.

**Status:** Code in 2026-08-20 — test next.

---

## Phase 3 — Mark this section (no outline)

**Goal:** Open book from the shelf (unmapped or no part). **Mark this section** → page span → pick Story / Vocab / Exercise → Story uses the same tools as Phase 2.

- [x] Shelf **Open book** lands in workshop as **Unmarked** (not browse-only).
- [x] Place bar: **Mark this section** → start/end pages → **Story / Vocab / Exercise**.
- [x] **Story** creates a manual story map and unlocks Text / Checks (same as Phase 2).
- [x] **Exercise** opens the Exercises rail (box a task).
- [x] **Vocab** stub until Phase 4.

**Test:** Books → Open book → Mark this section → pages → Story → scan / checks. Same door → Exercise → Exercises list. Close → still on the shelf.

**Status:** Code in 2026-08-20 — test next.

---

## Phase 4 — Vocab on the bar

**Goal:** Outlined vocab (and Mark → Vocab) get a Words icon on the place bar — same scan/edit/save editor as the part desk, above the open book.

- [x] Outlined vocab → Open book → Words icon → scan / edit / save
- [x] Mark → Vocab → synthetic part key → same Words tools
- [x] Status dot on the icon (amber empty / green ready)
- [x] Class Continue unchanged

**Test:** Vocab part → Open book → Words → scan → save. Shelf → Mark → Vocab → Words. Close → still on the desk/shelf.

**Status:** Code in 2026-08-20 — test next.

---

## Order

```text
0 docs → 1 place bar → 2 outlined story tools → 3 mark section → 4 vocab
```

**Park:** Lesson Hub, AI “what to prep next,” class Continue chrome copy, equal tool chips.
