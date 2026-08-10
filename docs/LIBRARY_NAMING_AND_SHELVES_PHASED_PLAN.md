# Library naming & series shelves — phased plan

Last updated: 2026-07-22

**How to use:** Implement **one phase at a time**. After each phase, **you test** in the app, then say go for the next. Do not skip ahead.

**Goal:** Find books by series (e.g. only Wonders), with clean names in the app. Disk file cleanup is a separate, explicit step — not every title edit.

**Hard rule:** Never rename a book's hidden `id` after it exists (assignments, ink, bookmarks stay attached). Pretty **title** and later **folder/PDF names** can change.

---

## Naming standard (locked)

| Layer | Example | When it changes |
|-------|---------|-----------------|
| **Title** (app) | `Journeys Grade 3 — Book 1` | Anytime in the identity form |
| **Series / Grade / Role** | Journeys · G3 · Student book | Anytime in the identity form |
| **Folder / PDF on disk** | `journeys-g3-book-1/journeys-g3-book-1.pdf` | Only Phase 2 "Clean up files" |
| **Book id** | `journeys-g3-book-1` | Never after create |

**Starter series:** Journeys, Wonders, HKMKC, Other

**Roles (optional):** Student book, Workshop, Literature, Teacher guide

**Grades (optional):** K, G1–G6

---

## Phase 0 — Agree labels ✅

- Series / Grade / Role + naming standard above.
- No free-form nested folders in this track.

---

## Phase 1 — Identity fields + edit in app ✅

**Goal:** Every book can store Series, Grade, Role, and an editable Title. Missing labels are guessed from the current title/id on load (in memory). Saving writes them to the library list. **No disk renames.**

### Tasks

- [x] Types + validation for `series`, `grade`, `role` on each book
- [x] Infer missing labels from title / id / folder name
- [x] Resolve inference in the UI (do not overwrite saved values; Save writes labels)
- [x] Identity editor on the selected book (title + series + grade + role) with Save
- [x] Unit tests for inference + schema

### Acceptance (you test)

- [ ] Open Books → pick a Journeys book → Series/Grade look sensible (or fix and Save)
- [ ] Change Title / Series → Save → refresh → values stick
- [ ] Clear Grade → Save → still works
- [ ] PDF still opens; folders on disk **unchanged**

### Non-goals

- Renaming folders/PDFs on disk
- Series shelves UI, search, student pin
- Changing book `id`

---

## Phase 2 — Clean up files on disk ✅ (test next)

**Goal:** Explicit **Clean up files** action: preview old → new folder/PDF names from Series/Grade/Role, then move files and update all stored paths. Keep `id` unchanged.

### Tasks

- [x] Canonical folder/PDF naming from Series / Grade / Role
- [x] Preview + apply API (never changes book id)
- [x] Rewrite unit paths, page alignment, cover, supporting index
- [x] **Clean up files…** button with confirm dialog
- [x] Clear error when files are locked / open

### Acceptance (you test)

- [ ] Preview shows folder + PDF rename
- [ ] After apply, book opens; ink/bookmarks for that book still work
- [ ] If file is locked (open elsewhere), clear error — no half-move

### Non-goals

- Auto-rename on every title edit
- New upload naming polish can land here or Phase 6

---

## Phase 3 — Library groups by series ✅ (test next)

**Goal:** Collapsible series shelves in the Library list; remember last open series.

### Tasks

- [x] Group books by Series (inferred if not saved yet)
- [x] Collapsible shelves; expand/collapse
- [x] Remember expanded shelves in local storage
- [x] Auto-expand the selected book’s series
- [x] Sort: Journeys → Wonders → HKMKC → custom → Other; within shelf by grade then title

### Acceptance (you test)

- [ ] Library shows series shelves (e.g. Journeys, Other), not one flat pile
- [ ] Collapse Journeys → those books hide; other series still visible
- [ ] Refresh → same shelves stay open/closed
- [ ] Select a book in a collapsed series → that series opens and the book highlights

### Non-goals

- Search (Phase 4)
- Student books pin (Phase 5)

---

## Phase 4 — Search ✅

**Goal:** Search by title, series, grade, role.

### Tasks

- [x] Search box in Library
- [x] Filter by title, series, grade, role, id
- [x] While searching, matching shelves stay open
- [x] Empty state when nothing matches; clear search

### Acceptance (you test)

- [ ] Type `g3` → Grade 3 books show
- [ ] Type `wonders` → only that series (if you have any)
- [ ] Clear search → full shelves return
- [ ] Nonsense query → clear “no books match” message

### Non-goals

- Student books pin (Phase 5)

---

## Phase 5 — Student's books on top ✅ (test next)

**Goal:** When a student is linked, pin their assigned books above the rest.

### Tasks

- [x] Resolve assigned books for linked student
- [x] “This student” / name pin shelf at top
- [x] Series shelves show the rest of the library (no duplicates)
- [x] Search still filters pin + shelves
- [x] No student linked → normal shelves only

### Acceptance (you test)

- [ ] Open Books with `?student=…` (or from a student’s book link) → their assigned books appear on top
- [ ] No student in the URL → no pin section
- [ ] Student with no assigned books → note, full library only
- [ ] Selecting a pinned book still opens the book on the right

### Non-goals

- Smarter upload naming (Phase 6, optional)

---

## Phase 6 (optional) — Smarter upload ✅ (test next)

**Goal:** On PDF drop, guess Series/Grade from filename; create clean folder/PDF names at upload time.

### Tasks

- [x] Guess series / grade / role from download filename
- [x] Save under clean folder + matching PDF name
- [x] Write title + labels into the library list
- [x] Toast shows the clean name and guessed labels

### Acceptance (you test)

- [ ] Drop something like `JOURNEYS G3 BOOK 1.pdf` → lands as `journeys-g3-book-1/journeys-g3-book-1.pdf`
- [ ] New book shows Series/Grade in Book details without hand-labeling
- [ ] Dropping a second PDF into an existing clean name adds a unit (or unique `-2` file) without crashing
- [ ] Random PDF still uploads under `other-…` rather than failing

### Non-goals

- Asking for Series/Grade in a form before upload (can add later if guesses are wrong often)

---

## Order rules

1. One phase at a time; you test before the next.
2. No free-form nested folders in this track.
3. Don't redesign the whole Books page — library list + book identity only.
