# Notebook Rebuild Phases (Intent-Driven)

> **Superseded (2026-06-24):** The lesson notebook / class log side panel was removed in Phase A. Saved words live in the translate dock; the live teaching surface is the **lesson board**. Kept for historical context only.

Last updated: 2026-05-27

## Locked product decisions from this thread

1. **Whiteboard vs notebook split**
   - Whiteboard is fast/freehand for live teaching.
   - Notebook is structured, revisitable, and feeds long-term learning memory.
2. **No accidental notebook creation**
   - Page turns or browsing ahead must not create notebook entries.
   - Entry creation is intent-driven only.
3. **Navigation behavior**
   - Scrolling older notebook content must not auto-turn book pages.
   - Notebook entries should expose a manual `Go to source page` action.
4. **Notebook format**
   - Infinite growing notebook (organized by session/part/entry), not hard pagination.

---

## Phase 0 - Stabilize current notebook (hotfix)

### Tasks
- [x] Restore typing reliability in notebook editor.
- [x] Ensure save path runs and persists content (no silent failure).
- [x] Verify correct section targeting for load/save behavior.
- [x] Add clear save feedback (`saved`, `saving`, `error`, `conflict`).

### Acceptance checks
- [ ] Can type, paste, close, reopen, and recover content. *(verify in app)*
- [ ] No "looks editable but not saved" behavior. *(verify in app)*
- [ ] Save conflicts are visible and recoverable. *(verify in app)*

---

## Phase 1 - Canonical data model

### Tasks
- [ ] Finalize hierarchy: `Class -> Session -> Part section -> Entries`.
- [ ] Define entry kinds: `note_text`, `whiteboard_capture`, `vocab_card`, `image`.
- [ ] Add source metadata to entries:
  - `bookId`, `unitId`, `pageSpanKey`, `tocPartKey`, `lessonPartLabel`, `createdAt`.
- [ ] Add `createdByTrigger` metadata (`typing`, `whiteboard_capture`, `vocab_save`, `paste`).

### Acceptance checks
- [ ] All notebook writes conform to one schema.
- [ ] Every entry can trace back to source context.

---

## Phase 2 - Intent-based entry creation

### Tasks
- [x] Remove/disable creation on page turn alone.
- [x] Create first entry only when a valid trigger occurs:
  - typing (debounced)
  - save whiteboard
  - save vocab/flashcard (opens translate dock)
  - paste into notebook
- [x] Add empty-state CTA in new lesson parts:
  - `Start note`
  - `Capture whiteboard`
  - `Add vocab`
- [x] Add dedupe guard to avoid duplicate entry creation from rapid repeat events.

### Acceptance checks
- [ ] Browsing future pages creates zero notebook entries.
- [ ] First meaningful interaction creates exactly one section/entry context.

---

## Phase 3 - Whiteboard to notebook capture

### Tasks
- [x] Add `Save to Notebook` action in whiteboard UI.
- [x] Save whiteboard snapshot as `whiteboard_capture` entry with source metadata.
- [ ] Optional quick title/note at save time.
- [x] Add idempotency window (for double-click or repeated trigger safety).

### Acceptance checks
- [ ] Whiteboard capture appears in notebook in 1-2 clicks.
- [ ] Captured items are tied to class/session/lesson-part context.

---

## Phase 4 - Notebook and book navigation contract

### Tasks
- [x] Keep book page stable when notebook history is scrolled.
- [x] Show source context per entry and add `Go to source page` action.
- [x] Add `Back to current page` return helper after manual jumps.
- [ ] (Optional) Add `Link notebook to book` toggle (default OFF).

### Acceptance checks
- [ ] No disorienting auto-jumps while reading notebook history.
- [ ] Manual source navigation works predictably.

---

## Phase 5 - Organization and retrieval UX

### Tasks
- [x] Group stream by session and lesson part.
- [x] Add filters: `Vocabulary`, `Sentences`, `Concepts`, `Diagrams`.
- [x] Add collapsible section headers and quick jumps.
- [x] Keep infinite scroll smooth for longer sessions. *(phase-5 nav/list parsing optimized with deferred + capped anchors)*

### Acceptance checks
- [x] Teacher can find old notes quickly without hard page model.
- [x] Stream remains readable and performant as it grows. *(deferred parse + capped extraction + progressive load-more control)*

---

## Phase 6 - Vocab and flashcard integration

### Tasks
- [ ] Save translated words as `vocab_card` entries.
- [ ] Support image + translation + example sentence payload.
- [ ] Add `Save to class vocabulary` from translation flow.
- [ ] Link notebook vocabulary entries with class vocabulary bank.

### Acceptance checks
- [ ] Vocabulary captured in lesson can be reviewed across sessions.
- [ ] Vocab entries remain anchored to lesson context.

---

## Phase 7 - Migration, tests, rollout

### Tasks
- [ ] Add non-destructive migration for existing notebook data.
- [ ] Add test coverage:
  - no entry creation on page turn
  - trigger-based creation
  - save/reload integrity
  - source-page navigation
- [ ] Roll out behind a feature flag (if needed) and monitor.

### Acceptance checks
- [ ] Existing notes remain intact after migration.
- [ ] New workflow is stable in real class sessions.

---

## Working status

- [x] Phase 0 complete *(pending your smoke test)*
- [ ] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete *(optional caption at save time still open)*
- [x] Phase 4 complete *(optional link toggle still open)*
- [ ] Phase 5 complete
- [ ] Phase 6 complete
- [ ] Phase 7 complete

---

## Notes log

- 2026-05-27: Created plan file from implementation planning discussion.
- 2026-05-27: Phase 0 follow-up — wire `activeClassSessionId` into book overlay, auto-detect live class, backfill missing notebook on hydrate, relax editable gate to in-progress class.
- 2026-05-27: Phase 3 — whiteboard **Save to notebook** captures PNG into flowing doc + `whiteboard_capture` entry; 2.5s dedupe; opens notebook panel on success.
- 2026-05-27: Phase 2 — intent-only part headings (type/paste/whiteboard/vocab CTAs); empty-state panel; dedupe on part key.
- 2026-05-27: Phase 4 — notebook source nav chips + **Back to current page** after manual book jumps; scrolling notebook does not turn book pages.
- 2026-05-28: Phase 5 slice — source nav now supports category filters (`Vocabulary`, `Sentences`, `Concepts`, `Diagrams`) and collapsible groups (parts vs whiteboard captures).
- 2026-05-28: Phase 5 performance pass — notebook source nav uses deferred HTML parsing and capped anchor extraction to stay responsive in long sessions.
- 2026-05-28: Phase 5 session grouping — source nav groups anchors by session/date and then by lesson-part vs whiteboard-capture.
- 2026-05-28: Phase 5 progressive reveal — `Load more anchors` grows source-nav result window in batches to handle very long sessions without blocking typing/scroll.
