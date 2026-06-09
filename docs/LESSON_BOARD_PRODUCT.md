# Lesson board — product decisions (locked)

Last updated: 2026-06-03

**Status:** Agreed direction. Replaces the “infinite vertical scroll = the product” framing in `INFINITE_WHITEBOARD_V1.md` for **structure and navigation**. Implementation phases live in **`LESSON_BOARD_PHASED_PLAN.md`**.

**UI name (teacher-facing):** Lesson board (code may still say `whiteboard` in places until rename passes).

---

## What this is

- **One lesson board per live class session** — same ink when the **book** turns pages; the board does not reset on PDF page turn.
- **Book-first** — default view is the **spread + board in a slot** beside the active book page. The curriculum spine stays the PDF; the board is the session workspace.
- **Not** a second app with “import from whiteboard into notebook.” Everything is **pages in one session document**, one table of contents (TOC).

**Out of scope for this track**

- Reviving the legacy **lesson notebook / class log** side panel (`BOOK_OVERLAY_NOTEBOOK_UI_ENABLED = false`).
- Student devices, sync, or multi-user editing on the board.
- Auto-creating notebook entries on page turn (see `NOTEBOOK_REBUILD_PHASES.md` for a separate track).

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
- Optional metadata per board page: `bookPageHint` (PDF page you were on when you created or last edited) — for recap and future lesson prep, not for locking coordinates.

---

## Layout & focus (replaces spread fullscreen)

### Default: docked slot

- Board lives in **left or right spread slot** (opposite reader focus); drag header to swap sides — **keep current behavior**.
- This is the **home** layout for live 1:1 teaching.

### No fullscreen / focus zoom

- **Do not** widen a Standard page to full spread width — that stretches ink.
- There is **no** fullscreen or focus-zoom control on the board header (removed).
- **Standard** pages stay in the docked slot; **Wide** pages still open across the spread automatically.

### Floating panel (Phase 6)

- **Float** (header button) detaches a **Standard** page above the book; **Dock** snaps back to the saved slot side.
- Drag the header grip to move; **corner resize** scales uniformly (aspect locked).
- **Wide** pages stay on the spread overlay — floating is not offered for them.

---

## Coordinates & ink (technical intent)

- Commands stay **normalized 0–1** relative to that page’s **logical width × height**.
- Switching **view** (slot, focus, float) only changes **scale/transform** of the viewport — not the stored aspect of the page.
- **One session store key** per class (existing `wb:session:{id}` path); document shape gains `pages[]` (see phased plan).

---

## Relation to older docs

| Doc | Relationship |
|-----|----------------|
| `INFINITE_WHITEBOARD_V1.md` | Historical implementation plan; Phases 1–3 largely **built**. Scroll runway may remain **inside a page** but is not the product model going forward. |
| `NOTEBOOK_REBUILD_PHASES.md` | Separate **class log / structured notebook** track; not the live lesson board. No “import whiteboard capture” required if board pages are the canonical session artifact. |
| `WHITEBOARD_INK_UNIFIED_PLAN.md` | Session ink layer — still valid; scope per **page** instead of one tall runway. |

---

## Success criteria (overall)

1. Teacher can run a class with **multiple board pages**, explicit **New page**, and find them later via **TOC / previews**.
2. **Standard** and **Wide** pages coexist; thumbnails show orientation.
3. **No** horizontal stretch when switching layout modes on the same page.
4. Book page turns do not wipe or split board content.
5. Spread-width fullscreen is gone or replaced by focus / wide page flow.

---

## Open questions (resolve in implementation, not blockers for Phase 1)

- Exact **wide page** aspect ratio constant (16∶9 vs 2∶1).
- **Focus** for Standard pages: Phase 5 vs later zoom.
- **Page delete / reorder** in v1 or v2.
- Export to class log: snapshot of page thumbnails vs full JSON.
