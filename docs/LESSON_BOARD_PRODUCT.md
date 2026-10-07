# Lesson board — product decisions (locked)

Last updated: 2026-09-18

**Status:** **Page model still stands** (Standard / Wide, New page, ink coordinates). **Ownership, teacher-facing name, and layout chrome** now live in **`NOTEBOOK_PRODUCT.md`** / **`NOTEBOOK_PHASED_PLAN.md`**.

Replaces the “infinite vertical scroll = the product” framing in `INFINITE_WHITEBOARD_V1.md` for **structure and navigation**. Page-model implementation phases live in **`LESSON_BOARD_PHASED_PLAN.md`**.

**UI name (teacher-facing):** **Notebook** (see `NOTEBOOK_PRODUCT.md`). Code may still say `whiteboard` / lesson board until a rename pass.

---

## What this is

- **One lasting notebook per student** — see `NOTEBOOK_PRODUCT.md`. Same ink across class sessions and when the **book** turns pages or swaps. Do **not** keep a separate board per book unit.
- **Book-first** — default view is the **spread + notebook Pin** beside the active book page. The curriculum spine stays the PDF; the notebook is the working paper.
- **Not** a second app with “import from whiteboard into notebook.” Everything is **pages in one session document**, one table of contents (TOC).

**Out of scope for this track**

- The legacy **lesson notebook / class log** side panel (removed; was behind `BOOK_OVERLAY_NOTEBOOK_UI_ENABLED`).
- Student devices, sync, or multi-user editing on the board.
- Auto-creating class-log notebook entries on page turn (see superseded `NOTEBOOK_REBUILD_PHASES.md`).

---

## Page model (replaces “one endless scroll”)

### Unit of storage

- A session board is an **ordered list of pages**.
- Each page has its own ink + DOM annotations (commands), height, metadata.
- **TOC and side previews** refer to **pages**, not scroll positions.

### Page size behavior

| Rule | Detail |
|------|--------|
| **Minimum height** | About **one board viewport** (visible slot height minus header) when the page is empty or new. |
| **Growth** | Page **height grows** as content needs it (text, stickies, images, ink near the bottom). |
| **Width** | Fixed per page **orientation** (see below). Width does **not** change when “focusing.” |
| **New page** | **Explicit only** — teacher taps **New page** (keyboard shortcut TBD). No auto-split when hitting the bottom. |
| **Optional title** | Skippable name per page for TOC (e.g. “Irregular verbs”). |

### Orientation (two page kinds, v1)

Chosen **when the page is created**; **not** rotatable after content exists (duplicate page if wrong).

| Kind | Use | Aspect (logical) |
|------|-----|------------------|
| **Standard** (portrait) | Notes, vocab, stickies, most teaching | Same ratio as today’s **docked slot** board (~one book page width × tall page). |
| **Wide** (landscape) | Diagrams, timelines, comparisons, “draw the whole picture” | Fixed wide ratio (e.g. **16∶9** or spread-like **~2∶1** — pick one constant in implementation). |

- **Same tools** on both kinds (pen, marker, text, shapes, stickies, etc.).
- **TOC / thumbnails** show orientation (portrait vs landscape preview).
- **Wide page ≠ spread-width stretch** of a Standard page. Wide is its own logical canvas.

### Book vs board page

- **Book page** = PDF page number in the reader.
- **Board page** = index in the session board list.
- UI must never imply they are the same index.
- Optional metadata per board page: weak `bookPageHint` (PDF page you were on when you created or last edited) — for recap, not a folder. Explicit **book links** (book + page + spot) are defined in `NOTEBOOK_PRODUCT.md`.

---

## Layout & focus (replaces spread fullscreen)

### Layout chrome → Notebook product

Pin (slot), Tab, Overlay (float), and Park, plus which control does what, are locked in **`NOTEBOOK_PRODUCT.md`**. This section only keeps the page-geometry rules:

- **Do not** widen a Standard page to full spread width — that stretches ink.
- **Standard** pages keep native aspect in Pin, Tab, and Overlay.
- **Wide** pages cover the spread when a book is focused; they are not a free Overlay window.

Slot side swap and Overlay drag/resize stay as built.

---

## Coordinates & ink (technical intent)

- Commands stay **normalized 0–1** relative to that page’s **logical width × height**.
- Switching **view** (slot, focus, float) only changes **scale/transform** of the viewport — not the stored aspect of the page.
- **One lasting store key per student** (`wb:session:local:student:{studentId}` — see `NOTEBOOK_PHASED_PLAN.md` Phase 2). Legacy `wb:session:local:{bookId}:{unitId}` and per-class keys may still be read once to merge. Document shape includes `pages[]` (see phased plan).

---

## Relation to older docs

| Doc | Relationship |
|-----|----------------|
| `INFINITE_WHITEBOARD_V1.md` | Historical implementation plan; Phases 1–3 largely **built**. Scroll runway may remain **inside a page** but is not the product model going forward. |
| `NOTEBOOK_PRODUCT.md` | **Ownership, layouts, chrome, links.** Source of truth for those. |
| `NOTEBOOK_REBUILD_PHASES.md` | Historical typed class log. Do not revive. |
| `WHITEBOARD_INK_UNIFIED_PLAN.md` | Session ink layer — still valid; scope per **page** instead of one tall runway. |
| `LESSON_BOARD_NAV_PRODUCT.md` | Footer page nav still useful. Per-book storage and Boards-as-picker superseded by `NOTEBOOK_PRODUCT.md`. |

---

## Success criteria (overall)

1. Teacher can run a class with **multiple board pages**, explicit **New page**, and find them later via **TOC / previews**.
2. **Standard** and **Wide** pages coexist; thumbnails show orientation.
3. **No** horizontal stretch when switching layout modes on the same page.
4. Book page turns do not wipe or split board content.
5. Notebook notes (and book↔notebook links) survive into the next class for **this student**.

---

## Open questions (resolve in implementation, not blockers for Phase 1)

- Exact **wide page** aspect ratio constant (16∶9 vs 2∶1) — 16∶9 is already in types.
- **Page delete / reorder** in v1 or v2.
- Export snapshots vs full JSON — later.
- Layout chrome / Tab / ownership → `NOTEBOOK_PRODUCT.md` (no longer open here).
