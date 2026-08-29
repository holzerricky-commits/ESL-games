# Books workshop chrome — product

Last updated: 2026-08-20

**Status:** Locked. Build **phase by phase** per `docs/BOOKS_WORKSHOP_PHASED_PLAN.md`.

**UI names:** Workshop book · Place bar · Mark this section · Close

**Related:** `BOOKS_LIBRARY_PRODUCT.md` (library → parts), `READING_CHECKS_PRODUCT.md` (story map / fuel / pack — data unchanged), `BOOK_EXERCISES_PRODUCT.md` (box a task — same mark-then-type idea).

---

## What this is

You open the book from Books (clock off, no student). A thin **place bar** says where you are. You either land on a named outline part, or **Mark this section** on the pages, pick a type, then use **only that type’s tools**. Packs stay on the book.

Outline is a shortcut that pre-fills the mark. No outline still preps.

---

## What this is not

- The Checks side wizard (pick book / pick story / numbered steps)
- A second CMS
- Equal chips for Checks / Vocab / Scan
- A teaching lobby (no clock, no kid, no end-class)

---

## Two doors, same book

| How you got here | Place bar shows | First action |
|------------------|-----------------|--------------|
| **Outlined** (lesson → part → Open book) | Book · lesson · part · type · pages | Tools for that type. No “pick a story.” |
| **No outline** (Open book from the shelf) | Book + current pages · unmarked | **Mark this section** → page span on the book → pick **Story / Vocab / Exercise** |

Copy **Box a task**: mark the span, then pick the type.

---

## Place bar (thin)

Docked strip in the book chrome (same height and fill as the bottom bar, beside the left strip). Not a glass overlay on the pages.

- **Left:** muted path (book › lesson) then current part; type chip beside it
- **Close** lives on the left strip (no second X on this bar)
- Pages stay in the bottom chrome
- **Tools** (outlined story): opens scan → checks → pin → Approve beside the book
- Later: one primary action per type on the bar itself
---

## Tools (type decides) — later phases

| Type | Tools |
|------|--------|
| **Story** | Scan text → draft/edit checks → place pins on the page → Approve |
| **Vocab** | Scan / edit words for the reader (same editor as the part desk) |
| **Exercise** | Already boxing on the page — do not merge |

One tool surface at a time, beside the book, **no dim**. The wizard’s “step 1 pick book / pick story” is retired as product UI.

Class **Continue** may keep the old Checks shortcut until this chrome is copied there. Do not rebuild Prepare.

---

## Success

Unmapped PDF → Open book → mark pages → Story → scan → two checks → pin → Approve. Outlined story skips the mark and does the same.

Phase 1 success is smaller: open an outlined part → see the place bar (where you are + Close) → no Checks wizard.

---

## Explicit non-goals

- Lesson Hub
- AI “what to prep next”
- Dumping every tool on the bar
- Rebuilding Today’s class / class Continue in this track
- Requiring outline before you can prep

---

## Decisions locked

- Workshop chrome lives **on the open book**
- Outline optional
- Kill the Checks side wizard as the workshop UI
- Type decides tools; mark-then-type when unmarked
- Story data model (map / fuel / pack) stays
