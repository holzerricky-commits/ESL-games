# Books library & prep desk — product

Last updated: 2026-08-20

**Status:** Locked for implementation. Build **phase by phase** per `docs/BOOKS_LIBRARY_PHASED_PLAN.md`.

**Related:** `PROJECT_CONTEXT.md` (book-first), student/class flow for **Teach**, reading-checks / outline as prep fuel.

---

## What this page is

**Books is your library and workshop** — not the classroom.

You come here to:

1. **Collect** books (import PDFs / units, cover, title, series/grade/role)
2. **Outline** them (units → lessons → parts + page map)
3. **Open a book** and see its **lessons** (then later parts → prep module)
4. **Build context** for teaching later (story ranges, text, frames, reading checks; later vocab zones, guides)

You do **not** come here to run a real class. Teaching stays on **student / schedule / class** → open book **with** that student (bookmark, end-class, notes).

---

## What this page is not

- Not a second teaching lobby
- Not “equal tabs for everything” (Materials / Plan / Advanced are not peers of the lesson desk)
- Not where student curriculum or “today’s class” lives
- Not a place that requires finishing the whole series before you can teach one unit
- Not separate **Prep vs Browse** product doors (one desk: book → lessons → parts)

---

## Modes

| Mode | Intent | Student? |
|------|--------|----------|
| **Library shelf** | Pick a book by cover | No |
| **Lesson shelf** | Inside one book: lessons by unit (same layout before and after outline) | No |
| **Part prep** | Confirm pages / status on the desk; **Open book** is the working surface | No |
| **Workshop book** | Same reader as class Continue (clock off). **Place bar** for where you are. Tools later. | No |
| **Teach** | Live lesson | Yes — **not** from Books as the primary door |

---

## What it should look like

### Library (default `/books` with no book selected)

- Cover rows as the hero (series / grade)
- Per book: cover + title + **one status** (needs map / mapped / has fuel)
- **Cover click** opens that book’s lesson shelf
- Import = clear “Add book” control with icon
- Prefer icons and status dots over instructional paragraphs

### Lesson shelf (book selected)

- Cover click always opens that book’s **lesson shelf** (same layout with or without an outline)
- **Open book** in the header looks through pages; **Outline this book** fills the empty shelf with lesson covers
- If there is **no PDF yet** → empty state + add PDF / outline
- If outlined → lesson covers in rows **by unit**, left→right in outline order
- Presentation books without lesson trees → **unit** cards; no units → empty CTA to add PDF
- Easy **Library** back; **Advanced tools** (materials / plan) as quiet overflow on the lesson shelf only — part prep is the main path

### Workshop book (from a part)

Locked in **`docs/BOOKS_WORKSHOP_PRODUCT.md`**. Open book from a part lands in the same reader (clock off, no student) with a **place bar**. Checks wizard is not the workshop UI. Class Continue stays a shortcut until that chrome is copied.

### Later (not this step)

- Workshop Phases 2–4 (story tools, mark section, vocab) — see `docs/BOOKS_WORKSHOP_PHASED_PLAN.md`
- Tools (guides, advanced) as secondary overflow

---

## Success criteria

- Someone who didn’t build the app can: find a book → open it → see lessons (or an empty shelf + Open book / Outline) — without asking you.
- You never wonder “am I teaching?” on this page — no end-class ritual here.
- Teach still starts from the student/class path.

---

## Explicit non-goals (this rethink)

- Full Lesson Hub / carousel / streak lobby
- Multi-book Focus/Dock teaching shell from Books
- Replacing student home or **Today’s class** (Prepare)
- Perfect extraction before shelf/prep IA is clear

---

## Decisions locked

- Books = **library + outline + lesson desk + context**, not teaching HQ
- **Cover click** = lesson shelf (empty until outlined; lesson-shelf **Open book** still looks through pages)
- **Part Open book** = workshop reader (same overlay as class prep; clock off; no student)
- Workshop chrome = **place bar** (`docs/BOOKS_WORKSHOP_PRODUCT.md`); Checks side wizard is retired as workshop UI
- **Teach without student as a product path** = no
