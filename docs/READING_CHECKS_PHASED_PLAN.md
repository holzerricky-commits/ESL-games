# Reading checks — phased implementation plan

Last updated: 2026-08-03

**Product source of truth:** `READING_CHECKS_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, then start the next. Do not skip phases unless a prerequisite is already done and checked.

**Baseline before Phase 1:** Interactive vocab v0 exists (demo pack + reader shelf). Books have outline / parts (including story-like kinds) for some titles; context scan exists for unit/lesson/part but is **not** yet a reading-check pack. No in-reader reading-check UI.

**Milestone:** Roadmap Phase 3 — Reading checks v0.

---

## Phase 0 — Documentation

| Item | Status |
|------|--------|
| `READING_CHECKS_PRODUCT.md` | Done |
| `READING_CHECKS_PHASED_PLAN.md` | Done |
| Cross-links in `MILESTONE.md`, `PROJECT_CONTEXT.md` | Done with this pass |

**Your test:** Read both docs; confirm they match the locked decisions before Phase 1 code.

---

## Phase 1 — Story map (one story) ✅

**Goal:** The app knows **which pages are one story**, even when the outline is missing.

### Tasks

- [x] Pick **one Literature** (or Journeys anthology) story you will teach soon — **Jump!** (Journeys G3 Unit 3 Lesson 11)
- [x] Data: story identity tied to book + unit/lesson/part (or a dedicated reading-span record) with **start/end PDF pages**
- [x] UI on **Books**: set or confirm page range for that story (manual always; prefill from outline/part when present) — **Stories** tab
- [x] Reader (or Books preview) can resolve “current page is inside this story” — badge in fullscreen reader

### Acceptance (you test)

- [ ] You can mark/confirm one story’s page range without a perfect outline
- [ ] Opening that range in the reader clearly belongs to that story identity

### Non-goals

- Check questions, AI, approve flow, in-class popup UI

---

## Phase 1b — Stories desk list (all stories + previews) ✅

**Goal:** Books → Stories shows **every** outline story (main + paired) with a first-page preview and clear status.

### Tasks

- [x] Discover `main_story` / `paired_story` parts from the live book outline (merge with seeds + manual)
- [x] Stories tab: cards with first-page thumbnail, page status (guessed / confirmed), **Text: not yet**
- [x] Unit filter: this unit (default when a unit is selected) / all units; grouped by unit
- [x] Keep edit start/end + Confirm pages + Open at start + add manual story
- [x] API loads book library so discovery is not seed-only

### Acceptance (you test)

- [ ] Journeys G3 → Stories lists many stories (not only Jump!), each with a preview when PDF is ready
- [ ] Jump! shows guessed pages + Text: not yet; Confirm flips pages chip to confirmed
- [ ] Manual add still works

### Non-goals

- Story text extraction (Phase 2)
- Prepare glance, visual start/end picker on the spread

---

## Phase 2 — Story text fuel (scan one story) ✅

**Goal:** That story’s **words are saved** for later AI (and for you to skim).

### Tasks

- [x] Scan / extract text for **only that story’s page range** (reuse existing context/scan patterns where sensible)
- [x] Store text on the story / part context; show a simple preview on the story desk
- [x] Allow re-scan and light manual paste/edit if extraction is messy
- [x] When the PDF has no selectable text, fall back to **Gemini on that story’s page range** (2-page chunks) — not whole-book OCR
- [x] Block “Generate checks” until text exists **or** teacher chooses hand-written-only path — *Generate not built yet; Text: ready chip gates future generate*

### Acceptance (you test)

- [ ] After scan, you can read a usable text dump for that one story
- [ ] Re-scan does not require scanning the whole book
- [ ] Image-only story PDFs: Scan still produces text via Gemini (skim/edit as needed)

### Non-goals

- Whole-book OCR, teacher-guide materials, generating questions yet

---

## Phase 3 — Check pack data + draft / approved ✅

**Goal:** A **check pack** exists as data: stops + questions, with a clear **draft vs approved** state.

### Tasks

- [x] Types: stop (label, page hint, optional mid-page note), question(s), pack status (`draft` | `approved`)
- [x] Persist pack per story (book-level, shared across students)
- [x] **Manual** create/edit: add a stop anywhere in the story range; add MCQ or true/false (1–2 types max for v0)
- [x] Only **approved** packs are eligible for the live reader (`getLiveEligibleReadingCheckPack`)
- [x] Un-approve / re-edit returns pack to draft (live reader hides or ignores until approved again)

### Acceptance (you test)

- [ ] You can hand-write 2–3 checks for the story and mark the pack **Approved**
- [ ] Draft packs do not appear as live teaching checks (`getLiveEligibleReadingCheckPack` returns null)

### Non-goals

- AI generation, Prepare status strip, fancy reader UI (stub list OK only if needed to verify data)

---

## Phase 4 — Story desk on Books (review UI)

**Goal:** One place on **Books** to see map + text + pack and **Approve**.

### Tasks

- [ ] Story desk panel/tab for the chosen story: range, text preview, check list, Approve / back to draft
- [x] *Partial:* Checks edit opens a roomy **quiz-builder dialog** with **one-check carousel + numbered steps** (calm Notion/Typeform-like chrome) — full dedicated desk still later
- [ ] Edit stops and questions without leaving that desk
- [ ] Empty states: “Mark pages” → “Add or scan text” → “Add checks or generate”

### Acceptance (you test)

- [ ] You can go from story range → text → hand checks → Approve without hunting multiple unrelated screens

### Non-goals

- Prepare/next-class glance (Phase 6), AI generate (Phase 5), live class popup polish

---

## Phase 5 — AI draft (after text exists) ✅

**Goal:** From saved story text, AI proposes **natural stop points + questions**; you still edit and approve.

### Tasks

- [x] “Generate draft” on story desk (disabled or warned if no story text)
- [x] AI proposes 2–5 stops at section/paragraph-like beats (not strict every-N-pages); mid-page stops allowed via page + short anchor label
- [x] Fills 1–2 question types per stop (comprehension first) — true/false or MCQ
- [x] Result lands as **draft** (never auto-approved)
- [x] Teacher can delete/move/edit before Approve
- [x] Optional: light lesson goals from existing lesson context if present — *skipped; title + page range hint only*

### Acceptance (you test)

- [ ] Generate on the Literature story → sensible draft stops → you edit one → Approve
- [ ] Without text, generate does not silently invent a live pack

### Non-goals

- Teacher-guide / pacing-guide as fuel
- Live mid-class generation as primary path
- On-page pins

---

## Phase 6 — Prepare / next-class status glance

**Goal:** Before class you see whether that story’s checks are ready.

### Tasks

- [x] On Prepare / next class (or equivalent): status line for the upcoming story — e.g. “Reading checks: approved (4)” / “Needs review” / “None”
- [x] Tap opens **Books story desk** for that story (deep link), not a duplicate editor
- [x] *Prep shortcut:* Prep chrome + glance open a **Reading checks prep** side panel (manual pages → scan → generate/approve) that saves through the same Stories APIs

### Acceptance (you test)

- [ ] Draft vs approved is obvious before you start class
- [ ] One tap gets you to the desk to finish approve

### Non-goals

- Full second CMS on the student home

---

## Phase 7 — In-class check list + speak → mark

**Goal:** Teachable loop on screen share for **one approved** story.

### Tasks

- [x] In fullscreen reader, when current pages are inside an **approved** story pack: show **check links list** (labels), not auto-popup on turn
- [x] Tap link → popup with question(s); **you mark** correct / incorrect / skip
- [x] Dismiss returns to book; page position does not jump
- [x] Skipping or ignoring checks never blocks page turns
- [x] Optional soft local log of marks (for later Phase 4 student knowledge) — do not block on bank wiring

### Acceptance (you test)

- [ ] Approved Literature story: open book → see check links → tap → student would speak → you mark → keep reading
- [ ] Draft-only pack: no live check links
- [ ] You can flip past checks freely

### Non-goals

- Auto cadence, on-page pins, student tap-to-answer UI, map rewards

---

## Phase 8 — Polish slice (only after real class use)

**Goal:** Small upgrades after one real lesson with Phase 7.

Pick only what hurt in class (do not do all at once):

- [ ] On-page pins near a beat (optional)
- [ ] Second question type or denser packs for long Journeys stories
- [ ] Workshop short-story pack using the same pipeline
- [ ] Soft link of marks → student knowledge stubs
- [ ] Optional light auto-suggest “you’re past this stop” without forcing a popup

### Shipped alongside Phase 7 (class wrap)

- [x] Live marks tagged with `classSessionId`
- [x] Student-facing end-of-class wrap (mirror of welcome): today’s check counts + Done → roster
- [x] Short `readingCheckWrapLine` saved on the completed class for teacher Past classes
- Hard auto-end still skips the wrap ceremony (exits to roster)

### Non-goals until Phase 7 felt good

- Full materials-aware engine
- Auto every-N-pages as default
- Lesson Hub dependency

---

## Suggested build order (summary)

| Order | Phase | You can feel |
|-------|-------|----------------|
| 0 | Docs | Decisions locked |
| 1 | Story map | One story has page bounds |
| 1b | Stories desk list | All stories + previews + status |
| 2 | Story text | Words saved for that story |
| 3 | Check pack + approve flag | Hand checks exist as draft/approved |
| 4 | Story desk | Review/approve in one Books place |
| 5 | AI draft | Generate → edit → still approve |
| 6 | Prepare glance | Green light before class |
| 7 | In-class list + mark | Real teaching loop |
| 8 | Polish | After one real class |

**First teachable milestone:** end of **Phase 7** on one Literature story (AI optional if Phase 5 slipped; hand pack still counts).

---

## Parking (do not pull into early phases)

- Teacher edition / pacing guide as generation context
- Per-student packs and class-length density knobs
- Live layout detection without story text
- Merging with Timed Challenge / legacy quiz engine
- Map / coins / boss framing on reading checks

Paste new parkables into `PARKING_LOT.md` if they keep coming up mid-build.
