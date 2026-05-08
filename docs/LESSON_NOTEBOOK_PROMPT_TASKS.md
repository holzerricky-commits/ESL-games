# Lesson Notebook Feature — Prompt-by-Prompt Task Plan

Last updated: 2026-05-06

## Locked decisions from this chat

1. **Notebook scope:** Use a **session document with section anchors**.
2. **Editing model:** Use **two layers**:
   - Base layer = flowing text document.
   - Overlay layer = drawings/media annotations.
3. **Anchoring policy:** "Whatever works best" -> default to **anchor to page section + nearest paragraph block** (stable and predictable).
4. **Reading linkage:** Notebook should have **subsections per page span** (example: `p33-34`). As reading advances, previous section becomes out-of-focus and current section is in-focus.

---

## What is good about this direction

- Session-scoped notes match real class workflow and review needs.
- Page-span sections (`p33-34`) make notes searchable and auditable.
- Base text layer solves the "text tool is messy" problem.
- Overlay layer still supports pen/drawing/paste for visual teaching.

## What needs careful design

- How overlay objects reflow when base text changes.
- How "follow page" behaves when teacher wants to keep writing in an older section.
- How autosave/history works without lag.
- How to avoid mode confusion (typing vs drawing vs selecting objects).

---

## Prompt 1 — Data model + lifecycle (foundation)

### Tasks
- [x] Create `LessonNotebookSession` record model:
  - `sessionId`, `studentId`, `classSessionId`, `bookId`, `unitId`, `startedAt`, `endedAt?`
- [x] Create `LessonNotebookSection` model:
  - `sectionId`, `sessionId`, `anchorType` (`page_span`, `toc_part`), `anchorKey`, `title`, `order`
- [x] Create `LessonNotebookEntry` model:
  - `entryId`, `sectionId`, `layer` (`doc` or `overlay`), `payload`, `createdAt`, `updatedAt`
- [x] Auto-create session document when class starts.
- [x] Auto-create first section using active page span (example `p33-34`).
- [x] Auto-generate header block:
  - Class title
  - Date
  - Student
  - Book/unit
  - Active page span

### Acceptance checks
- [x] Starting a new class always creates exactly one notebook session.
- [x] Header is visible without manual input.
- [x] Notebook data is tied to class session and reload-safe.

---

## Prompt 2 — Base text document layer (Word-like typing)

### Tasks
- [x] Implement flowing rich-text editor area as the default input mode.
- [x] Enter key creates clean paragraph flow (no absolute text objects).
- [x] Add paste handling for plain text and images into document flow.
- [x] Add basic formatting controls (min set: bold, bullet list, heading).
- [x] Add autosave debounce (target 300-800ms) with save status indicator.

### Acceptance checks
- [x] Teacher can type continuously without using text tool.
- [x] Pasted images appear in predictable document flow positions.
- [x] Reload keeps typed content and image positions.

---

## Prompt 3 — Overlay layer (pen/draw/media annotations)

### Tasks
- [x] Add explicit mode toggle: `Type` / `Draw` / `Select`.
- [x] Enable pen/highlighter drawing on overlay layer.
- [x] Support paste/image insertion into overlay layer when in `Select` mode.
- [x] Store overlay objects with section anchor + local position.
- [x] Keep overlay hidden or readonly when section is out-of-focus (configurable).

### Acceptance checks
- [x] Drawing does not interfere with typing in default mode.
- [x] Overlay items persist and restore correctly on reload.
- [x] Switching sections does not lose overlay state.

---

## Prompt 4 — Page-span sections + follow behavior

### Tasks
- [x] Define page-span key generator (example `p33-34`, `p35-36`).
- [x] On page change, ensure target section exists (create if missing).
- [x] Implement focus behavior:
  - Current page-span section = focused.
  - Other sections = collapsed/out-of-focus.
- [x] Add `Follow Reading` toggle:
  - ON: auto-focus current page section.
  - OFF: stay in manually selected section.

### Acceptance checks
- [x] Moving from `p33-34` to `p35-36` shifts focus correctly.
- [x] Turning pages does not delete or overwrite older section notes.
- [x] With Follow OFF, page turns do not force context switch.

---

## Prompt 5 — TOC integration + section anchors

### Tasks
- [x] Map page span to TOC part when available.
- [x] Show section breadcrumb: `Unit > Part > p33-34`.
- [x] Allow manual re-anchor (section can be reassigned to another TOC part).
- [x] Add quick jump from notebook section to book page span.

### Acceptance checks
- [x] Notebook context reflects current reading location.
- [x] Teacher can navigate notebook <-> book without losing place.

---

## Prompt 6 — UX polish + reliability

### Tasks
- [x] Add lightweight version history snapshots per section.
- [x] Add conflict-safe save strategy (last-write protection + merge note).
- [x] Add performance guardrails (lazy load section bodies; virtualize long lists).
- [x] Add recoverability: restore from last valid autosave on crash/reload.

### Acceptance checks
- [x] Long notebook sessions remain responsive.
- [x] Reload/crash recovery restores latest saved state.

---

## Not in scope now (defer)

- Full collaborative multi-user editing.
- Complex desktop-publishing layout tools.
- AI auto-structure generation of entire notebook content.
- Student-device synchronized live notebook editing.

---

## Recommended implementation order

1. Prompt 1 (data model/lifecycle)
2. Prompt 2 (base document typing)
3. Prompt 4 (page-span focus/follow)
4. Prompt 3 (overlay drawing/media)
5. Prompt 5 (TOC anchors)
6. Prompt 6 (polish/reliability)

