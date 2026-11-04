# Book workbench shell — contract

Last updated: 2026-10-09

**Status:** Locked. Edit outline uses this shell; story part prep moved to the class reader (rule 3).

**Code:** [`components/books/book-workbench-shell.tsx`](../components/books/book-workbench-shell.tsx)

**Outline job today:** Still passes legacy `children` for its columns (slot migration next).

**Story part desk today:** Does not use this shell. It runs on the class reader — see [Story part desk](#story-part-desk-class-reader) below.

---

## What this is

One full-screen desk for **working on a book**:

- **Left** — the current job’s controls  
- **Right** — the book pages  

Same window chrome for Outline, Story text, Checks, Vocab, etc. Swap the job; keep the frame.

---

## Zones (stable)

| Zone | Owns | Does not own |
|------|------|----------------|
| **Header** | Back/close, job title, book name, optional cover | Job forms, page tools |
| **Left panel** | Only the active job’s controls | PDF rendering |
| **Left footer** (optional) | Primary job actions (Continue, Save, step dots) | Book page chrome |
| **Right (book)** | Page view, turn pages, job-specific overlays on the page | Outline extract forms, scan/paste editors |

---

## Frame vs job

**Frame (shell) owns**

- Full-viewport overlay (`fixed inset-0`)
- Left column width and scroll
- Right book pane layout
- Escape / Back to leave
- Shared surface tokens (left `surface-2`, book pane dark/neutral)

**Job owns**

- Left body content
- Left footer actions
- What appears **on** the book (hide/not-counted for Outline; selectable text for Story text; pins for Checks)
- Save / continue logic

---

## Jobs (plug-ins)

| Job | Entry | Left | Book extras |
|-----|--------|------|-------------|
| **Outline** | Edit outline | TOC → align → extract → review | Not-counted / hide page (align) |
| **Story text** | `BookPartClassDesk` · Text chip | Scan / paste / Make selectable | Class text select (reloads when the selectable copy is saved) |
| **Checks** | `BookPartClassDesk` · Checks chip | Draft / approve checks (left scroll) | Draft pins on the class reader |
| **Vocab** *(later)* | Vocab part | Words tools | Highlights as needed |

---

## Rules

1. **One shell file** — do not copy left/right layout into part prep again.  
2. **Book chrome is job-owned** — Outline page buttons must not stay visible for Text/Checks.  
3. **Story part jobs run on the class reader** — `BookPartClassDesk` mounts `FullscreenBookOverlay` in prep mode and puts the job in its `deskRail` (via `DeskToolRail`). Do not build another preview viewer for story pages; what you test on the desk is what class shows. This shell stays for Edit outline.  
4. **One job visible at a time** in the left panel.  
5. **Changing the shell** updates every job that uses it.

---

## Story part desk (class reader)

**Code:** [`components/books/book-part-class-desk.tsx`](../components/books/book-part-class-desk.tsx)

- **Book:** `FullscreenBookOverlay` with `isPrepMode`, `BOOKS_WORKSHOP_STUDENT_ID`, opened on the story's first page.
- **Left:** `deskRail` + `deskRailWidthPx` (300, Checks 420). Opens on a **Story prep** checklist (`DeskStepList` / `DeskStepRow` with `DeskStatusChip`): Pages, Selectable pages, Story text, Reading checks. Running scans show a progress bar on their row. Each step screen has one main button; rarer actions sit in `DeskOverflowMenu` ("⋯"). Pages uses `onSpreadChange` from the reader for "Use p. N" buttons. Reading checks (`StoryCheckPackPanel` `embed`) is a list of checks that opens one at a time ("All checks" returns), with "Approve for class" pinned at the bottom; tapping a pin on the book opens that check. A row drills into that job; `DeskPanelHeader` back arrow returns to the checklist (from the checklist it returns to the parts list). Jobs stay mounted while hidden so Pages auto-confirms and scans keep running.
- **Page jumps:** `focusPdfPage` — story start, or the active check's page on Checks.
- **Pins:** `prepReadingCheckPins` shows draft stops; place/move results go through the reading-check hotspot events so the Checks job saves them.
- **Selectable text:** no extra wiring — the reader reloads on `SEARCHABLE_PDF_UPDATED_EVENT`.
- Back / Escape return to the parts list.

---

## Out of scope for the shell

- Class timer / student session  
- Library shelf / lesson list navigation (those stay outside)  
- Embedding Advanced Outline tab’s small side preview (different purpose: peek while browsing the tree)
