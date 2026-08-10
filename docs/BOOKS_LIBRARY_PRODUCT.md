# Books library & prep desk — product

Last updated: 2026-08-09

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
| **Lesson shelf** | Inside one book: lessons by unit (or outline CTA) | No |
| **Part prep** (later) | Scan / confirm / fuel for one part | No |
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

- If **no outline** → empty state + one CTA: **Outline this book**
- If outlined → lesson covers in rows **by unit**, left→right in outline order
- Presentation books without lesson trees → **unit** cards; no units → empty CTA to add PDF
- Easy **Library** back; **Advanced tools** (materials / plan) as quiet overflow on the lesson shelf only — part prep is the main path

### Later (not this step)

- Lesson → parts list → prep module (scan / confirm / stories / checks) — **Phase B done**; **Phase C** = real prep in the shell
- Map + Ready merge into that part module
- Tools (guides, advanced) as secondary overflow

---

## Success criteria

- Someone who didn’t build the app can: find a book → open it → see lessons (or know to outline) — without asking you.
- You never wonder “am I teaching?” on this page — no end-class ritual here.
- Teach still starts from the student/class path.

---

## Explicit non-goals (this rethink)

- Full Lesson Hub / carousel / streak lobby
- Multi-book Focus/Dock teaching shell from Books
- Replacing student home or class prepare
- Perfect extraction before shelf/prep IA is clear

---

## Decisions locked

- Books = **library + outline + lesson desk + context**, not teaching HQ
- **Cover click** = lesson shelf (or outline empty state)
- **Teach without student as a product path** = no
