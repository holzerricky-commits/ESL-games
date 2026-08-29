# Student home — product decisions (locked)

Last updated: 2026-08-19

**Status:** Agreed direction. Rebuild the Students area as **roster → one teacher home per student**. Implementation phases live in **`STUDENT_HOME_PHASED_PLAN.md`**.

---

## Why

Today a student had two doors: **Plan / class prep** and a game-y **Preview**. That fights 1:1 screen-share teaching. The home is teacher-first: next class, books, learning notes, quiet settings.

---

## Who this screen is for

- **You (the teacher)** operating the app while on a call and screen-sharing.
- Not a learner-owned profile app in v1.

---

## Locked defaults (v1)

| Decision | Choice |
|----------|--------|
| Mental model | Roster → **one student home** → teach |
| Default section on open | **Classes** |
| **Enter** (within ~20 min / live) | Goes to the **map** route (current teach path) |
| **Prepare** (further out) | **Today’s class** — does not start the live clock |
| First ship | **Demo-ready shell** (Phases 1–3), not a rewrite of every prep panel |

---

## Roster (`/students`)

- Page header: title, short description, quiet counts (active · need setup), **Add student**.
- Toolbar: search · status filter · sort · **list / grid** toggle (persisted in `localStorage`).
- **Status filter:** Active (default) · Needs setup · On break — on-break is first-class, not a buried section.
- **Sort:** Name A–Z (default) · Next class (soonest) · Needs setup first.
- **List:** compact one-door rows (face, name, next class, book/page, setup badge).
- **Grid:** face-forward tiles with the same meta and open/⋯ rules.
- Whole row/tile opens the student; **⋯** for remove (Restore + ⋯ when on break).
- No Plan vs Preview fork on the roster.

**Phase 1 destination (temporary):** ~~Open goes to class prep `/plan`~~ — superseded: roster Open goes to **student home** `/students/[id]` (Phase 2). `/plan` still works until Phase 3 redirect.

---

## Student home (one page)

**Top strip**

- Face, name
- Next class (time · length)
- Book / unit / page

**Big actions**

- **Start class**
- **Open book**
- Prep hint only when next class isn’t ready

**Body sections** (tabs or equivalent — same page)

| Section | Job |
|---------|-----|
| **Classes** | ClassIn-style list: upcoming rows (Prepare / countdown / Enter) + ended; Preview opens a page module; Prepare opens prep + Save prep |
| **Books** | Assign / switch curriculum (today’s Curriculum tab) |
| **Learning** | Words first; later phrases & named errors |
| **Settings** | First-class welcome toggle · on break / delete |

**Retired from student home UX (do not resurface):** Map, Avatar, coins/XP, “Map & rewards” links, quiz difficulty controls. Live class may still use an existing session URL under the hood — never label that as map/rewards.

**Setup gate:** If book or schedule is missing → short checklist first, then the same home.

### Classes section (locked)

**One job:** manage this student’s classes like ClassIn — same row shape for every upcoming class; urgency is only the button + countdown.

**List rules**

- Farther than ~20 minutes → **Prepare** (+ countdown if within 24h)
- Within ~20 minutes (or live) → **Enter**
- **Preview** → page-preview module (not a permanent hero spread)
- **Prepare** → **Today’s class** for this class; does **not** start the live clock
- Ended lessons below (recap / notes)

**Go** stays on the student-home header as Prepare or Enter for the soonest class.

---

## What stays vs moves

| Keep (reuse content) | Move | Drop from student home UX |
|----------------------|------|---------------------------|
| Classes tab guts | Words → Learning | Plan vs Preview as two homes |
| Curriculum tab guts | Welcome + remove → Settings | RPG stats / map / avatar / coins as product UI |
| Setup flow (book + schedule) | — | Empty “About you” blocks |
| Start / Open book actions | — | Quiz difficulty strip; Map & rewards links |

Teaching data (words, books, classes) stays. Motivation/RPG and quiz-difficulty **product UI** stay off this home.

---

## Out of scope (this track)

- Rewriting Next class / prep outline internals beyond Phase 2b hierarchy
- Lesson board, schedule lifecycle, interactive vocab
- Resurfacing map/avatar/rewards or quiz difficulty on the student home
- AI lesson prep UI
- Student-owned devices / logins

---

## Success

You open Students, tap a name, and always land in the same kind of place: **who this kid is, what’s next, Start / Open book**—without choosing Plan vs Preview.
