# Book workbench shell — contract

Last updated: 2026-09-03

**Status:** Locked. Edit outline and story part prep share this shell.

**Code:** [`components/books/book-workbench-shell.tsx`](../components/books/book-workbench-shell.tsx)

**Outline job today:** Still passes legacy `children` for its columns (slot migration next).

**Story part desk today:** Uses `left` + `book` slots. Back returns to the parts list.

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
| **Story text** | Part desk · Text chip | Scan / paste / Make selectable | Text layer when ready |
| **Checks** *(later pins)* | Part desk · Checks chip | Draft / approve checks (left scroll) | Pins on pages (Phase 3) |
| **Vocab** *(later)* | Vocab part | Words tools | Highlights as needed |

---

## Rules

1. **One shell file** — do not copy left/right layout into part prep again.  
2. **Book chrome is job-owned** — Outline page buttons must not stay visible for Text/Checks.  
3. **Do not mount the class fullscreen reader as the shell** — shell is the Edit-outline-shaped desk; the book *viewer* inside may grow toward class fidelity over time.  
4. **One job visible at a time** in the left panel.  
5. **Changing the shell** updates every job that uses it.

---

## Out of scope for the shell

- Class timer / student session  
- Library shelf / lesson list navigation (those stay outside)  
- Embedding Advanced Outline tab’s small side preview (different purpose: peek while browsing the tree)
