# Reading checks — product decisions (locked)

Last updated: 2026-08-20

**Status:** Agreed direction from brainstorm. Implementation order lives in **`READING_CHECKS_PHASED_PLAN.md`**.

**UI names (teacher-facing):** Reading checks · Check link · Story desk (prep/approve)

**Milestone tie-in:** Roadmap **Phase 3 — Reading checks v0**. Follows interactive vocab v0 (Phase 2 pattern: mark section → content pack → on-book UI).

**Related:** `PROJECT_CONTEXT.md` (interactive book · reading / story sections), `MILESTONE.md` Phase 3, `docs/BOOKS_WORKSHOP_PRODUCT.md` (workshop chrome), existing book outline / part tags.

---

## What this is

During a **story / reading stretch**, light **comprehension (and related) check-ins** at natural story beats — not a separate quiz app and not page-count robots.

You **prep before class** (AI can draft; you always can write by hand). You **review and approve** before anything is live. In class you **tap a check link** next to that beat; the **student speaks**; **you mark** the answer. Book stays central; checks never block your free page turning.

---

## Three pieces (keep separate)

| Piece | Job |
|-------|-----|
| **Story map** | Which pages are this story (outline when present; **manual page range** when not). |
| **Story fuel** | Saved **story text** (scan one story at a time) + light lesson frame if already available. Teacher guide / extra materials **not** required for v1. |
| **Check pack** | Stop points + questions for that story; **draft → approved**; book-level (same pack for all students in v1). |

AI only helps fill the check pack from story fuel. Hand-written checks always work without AI.

---

## Where it lives

| Surface | Role |
|---------|------|
| **Books · workshop book** | Standing **working surface** (place bar). Story tools (scan / checks / pins / Approve) attach to the marked or outlined story — not a pick-book wizard. See `docs/BOOKS_WORKSHOP_PRODUCT.md`. |
| **Books · part desk** | Confirm page range + status. Jump to workshop to place on the pages. |
| **Prepare / next class** | Short **status only** (e.g. “4 checks · approved” or “Needs review”). Opens workshop / Stories for that story — not a second full editor. |
| **Fullscreen book reader** | **Live teaching**: list of check links for the **current approved** story pack; tap → popup; you mark; dismiss/skip anytime. |

Do **not** bury approve-only UI inside live class chrome. Do **not** invent a giant separate “content CMS” product for v1. The Checks prep **sheet/wizard** is retired as workshop UI.

---

## In-class behavior (locked)

1. **Teacher-triggered** — tap a **check link** for a specific story beat (not auto on every page turn). Optional auto cadence is **later**.
2. **Natural stops** — AI (and you) place checks at story beats (problem, turning point, resolution, scene changes), including **mid-page** when that is where the beat ends. Not “every N pages.”
3. **Page density** — on long or event-heavy pages, **multiple light checks on the same page** are fine (e.g. quick true/false). No minimum gap between checks and no per-page cap. Heavier why/how questions belong at major beats.
4. **Illustration-only spreads** — story scan tags art-only pages in saved text; AI may place visual or bridge checks there, or anchor on nearby text with a picture reference.
5. **First UI = story check list** next to the reading stretch (labels like “Check 1 · after the market scene”). **On-page pins** are later polish.
6. **Student speaks → you mark** (correct / not / skip). No student-owned device required.
7. **Manual always** — add questions and place stops anywhere, with or without AI.
8. **Never gate the teacher** — turn pages freely; skip or dismiss any check.

---

## Prep behavior (locked)

1. Prefer **prep-ahead**: draft pack before class → you edit → **Approve** → live in reader.
2. **AI on day one** is allowed **only after** that story’s text (or enough hand context) exists for that story.
3. If AI is unavailable or weak: **hand-written pack** still teaches.
4. Packs are **per story (book content)**, not per student, in v1.

---

## Books in scope

- **Both** Workshop-style and Literature / Journeys-style stories (shorter vs longer).
- **First teachable story:** Literature-style anthology story you actually teach soon.
- Journeys (single book, longer stories) and Wonders Workshop (shorter in-book stories) share the same model; only story length / density differ.

---

## What the engine knows (v1 vs later)

### v1 — enough for good drafts

- Story page range (outline or manual)
- Story text saved for that story (including **illustration-only page markers** when scan finds no prose)
- **Beat-first AI placement** with story-length check budget and dense-page hints (not page-count cadence)
- **Lesson frame fuel** (Phase 9a): scan opener / comprehension / vocab pages → skill, strategy, essential question, target vocab; mark ready before Generate for better questions (Generate still works without it)
- Optional light lesson frame (goals / skill) if already on the book
- Your edits + **approved** flag
- Question types today: true/false and MCQ; **future types** (e.g. gamified light checks) plug in with a weight (light vs heavy) — same beat/density rules

See also: `docs/READING_CHECKS_LESSON_AWARE_PHASED_PLAN.md` (Phases 9a–9e).

### Later (explicitly not v1 gates)

- Teacher edition / pacing guide / other uploaded materials as generation fuel
- Student weak words, class length density knobs, per-student packs
- Live mid-class AI regeneration as the main path
- Layout “computer vision” that finds chapter breaks without text
- Auto-fire checks on page turn

---

## Relation to other features

| Feature | Relation |
|---------|----------|
| **Interactive vocab** | Sibling pattern (pack + on-book UI). Vocab ≠ reading checks. |
| **Timed challenge / legacy quizzes** | Stay **extras**. Do not merge into reading checks. |
| **Student knowledge (Phase 4)** | Optional later: log marks into vocab / comprehension memory. Soft or none in v1. |
| **Lesson Hub / multi-book shell** | Still later; reading checks do not wait on Hub. |

---

## Explicit non-goals (v1)

- Auto checks every N pages as the primary UX
- On-page pins before the list + approve flow works
- Requiring teacher-guide indexing before first popup
- Student tap-to-answer as the only path
- Blocking page turns until a check is finished
- Perfect whole-book OCR before one story works
- Map / RPG / coins tied to reading checks

---

## Success

You pick one Literature story, save its text, get an AI draft (or write checks yourself), **approve**, open the book in class, tap a **check link** at a natural beat, mark the student’s spoken answer, dismiss, and keep reading — without fighting the app.

**End of class (wrap):** After you confirm End class, the student sees a short goodbye on the shared lesson screen (same world as welcome) with today’s check counts when any were marked; then Done returns you to the teacher roster. Private student pages stay teacher-only.

---

## Changelog

- **2026-08-19** — Prepare destination is Today’s class; glance still status-only (Stories jump).
- **2026-08-05** — Literature → Workshop lesson link (Phase 9e): Literature Stories pick a Workshop week; Generate uses that skill frame.
- **2026-08-05** — Stop and Check harvest (Phase 9c): detect publisher pauses in story text; import to pack; Generate must-cover anchors.
- **2026-08-05** — Skill-aware Generate (Phase 9b): ready lesson frame steers checks toward skill / EQ / target vocab.
- **2026-08-05** — Lesson frame fuel (Phase 9a): scan skill / EQ / vocab from lesson opener pages; Stories Frame row; Generate soft-warn if frame missing.
- **2026-08-05** — AI draft rules: beat-first + page-density placement; illustration-only page tags in story fuel; story-length check budget; multiple light checks per dense page OK.
- **2026-08-03** — Locked from product brainstorm: story map + fuel + check pack; teacher trigger; natural beats; speak→mark; Books desk + Prepare status; AI draft after story text; Literature first; both Workshop and Journeys in scope.
