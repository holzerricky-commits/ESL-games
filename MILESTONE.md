# Milestone — what ships next

Stable intent lives in **`PROJECT_CONTEXT.md`**. This file is the **execution roadmap**: phases, current sprint, and explicit non-goals.

---

## North star (short)

You can run a **1:1 online lesson** in your chosen environment (see **Notes**), with **student + book** in one flow, then add **interactive book** and **student context** in thin vertical slices—without blocking on perfect extraction or full RPG.

---

## Phased path (order matters)

| Phase | Name | Outcome you can feel |
|-------|------|----------------------|
| **0** | **Teach-ready shell** | App runs where you teach; you trust it not to lose work; one happy path through student → book → back. |
| **1** | **Lesson ritual** | Each regular student has book(s) assigned, clear entry to reader, bookmark / resume position; optional timed challenge as spice, not blocker. |
| **2** | **Interactive vocab v0** | One vocab zone (even manually defined): word list + **one** deep word panel (definition + examples first; media later). |
| **3** | **Reading checks v0** | Teacher-placed or simple cadence popups on a reading span (one story unit), minimal question types. |
| **4** | **Student knowledge MVP** | Vocabulary bank: words tagged **strong / needs practice** (manual + later from task results); stub for **phrases** and **named errors**. |
| **5** | **AI lesson prep v0** | Before class: plan + time bands using **structured fields** (length, level, last page, weak words)—draft you edit in under 1 minute. |
| **6+** | **Motivation layer** | Map nodes tied to **book checkpoints**; coins for completed book-linked tasks; cosmetics—**after** core loop feels solid. |

Defer **perfect PDF/LLM extraction**, **full monster/boss combat**, and **student-owned devices** until the row you are on is done.

---

## Current sprint — Phase 0 → start of Phase 1

**Goal:** *“I can open my build, pick a student, open their book, teach for 25–60 minutes without fighting the app.”* (Timed challenge / map are optional extras, not required for Phase 0.)

### Checklist (Phase 0 — complete)

- [x] **Run target** — Teaching with **`npm run dev`** on localhost is the chosen default (see **Notes**). `npm run build` + `npm run start` stays **optional** if you ever want a calmer, production-style run.
- [x] **Data safety** — Backup habit in place; **Settings → Download backup JSON**; see **`docs/PHASE0.md`**.
- [x] **One student lesson-path try** — Walked student → book → pages → exit without a hard failure.
- [x] **Optional activity** — *Skipped:* timed challenge / map not part of the current teaching plan.
- [x] **Phase 1 entry criteria** — Written in **Notes** (bookmark = last viewed page at **end class**, after teacher returns to the page they want saved).

### Explicit non-goals (this sprint)

- [ ] No requirement for interactive vocab deep-dive, reading popups, AI lesson generator, or map redesign.
- [ ] No requirement for multi-device sync or student logins.
- [x] **No single-page-centered book reader** — v1 is spread-only (left + optional right); see `PROJECT_CONTEXT.md` → *Book reader layout — spread-only v1*.

---

## Next sprint preview — Phase 1 (after Phase 0 is ✓)

### Recently shipped (toward Phase 1)

- [x] **Curriculum “where reading starts” (anchor)** — Teacher sets the planned first lesson piece on the Curriculum tab; it is stored on the student and used as the default section in **Classes** when there is no prior completed class with a chosen piece; Curriculum also shows a read-only **last class bookmark** next to the plan.
- [x] **Classes spotlight preview** — The PDF spread for the next/live class card updates automatically when the resolved section changes (no extra click on the section title to align the preview).
- [x] **Classes tab stability** — Fixed a crash when opening the Classes tab (`Cannot access 'library' before initialization` from hook ordering).
- [x] **Dashboard today’s classes** — Home screen centers on **today’s schedule** with **Prepare / Enter** (ClassIn-style); optional **20‑minute** corner reminder before a class.
- [x] **After-class recap (optional)** — End-class dialog can include a quick recap; past classes can **add a note later** or **dismiss** the gentle prompt.
- [x] **Reader “last stop” with a student** — Opening the book from the student’s class flow uses the **newest** of end-of-class bookmark vs reader history for that book/unit (with **Last time / Today** lines on the next-class card and **Open book at last stop**).
- [x] **Default reader target + resume from partial URLs** — `getStudentDefaultBookUnitForReader` resolves book/unit from assignments when `/books` has `student` but missing `book`/`unit` (or book only); same helper feeds list **Book**, profile/plan **Open book**, and Curriculum reader link.
- [x] **Session log per class** — `sessionNote` on `StudentClassSession`; end-class dialog + Past classes editing via `updateStudentClassSessionNote`.

### Still on the roadmap

Phase 1 preview items above (bookmark paths, **Open book**, session log) are **checked**. **Two-page spread ink** (Phases 1–6 in `docs/SPREAD_INK_PHASED_PLAN.md`) is v1-shippable; further pen speed / marker canvas tuning is parking-lot only. **Phase 2 interactive vocab v0** has a shippable slice (one demo section + reader shelf UI). **Phase 3 reading checks** Phase 0–7 done through in-class check list (story map + text + packs + quiz editor + Generate + Prepare glance + live speak→mark); **Phase 8 polish** only after one real lesson—or other active tracks if those are the ship priority.

**Lesson board (session notebook pages):** Product locked in `docs/LESSON_BOARD_PRODUCT.md`. Implement **phase by phase** per `docs/LESSON_BOARD_PHASED_PLAN.md` (test after each phase before continuing). Replaces infinite-scroll-as-product and spread-width fullscreen.

**Lesson board navigation & identity:** Product locked in `docs/LESSON_BOARD_NAV_PRODUCT.md`. Implement **phase by phase** per `docs/LESSON_BOARD_NAV_PHASED_PLAN.md` (test after each phase). Footer identity (role + color) + cross-book Boards menu — not handmade curriculum units. Ship bar: Phase 1 footer/Boards for teaching; 2–4 as needed.

**Class schedule lifecycle (move / clock / auto live / missed):** Product locked in `docs/CLASS_SCHEDULE_LIFECYCLE_PRODUCT.md`. Implement **phase by phase** per `docs/CLASS_SCHEDULE_LIFECYCLE_PHASED_PLAN.md` (test after each phase; **Move while live before auto-start**). Calendar is the source of truth for end time; no-shows → Missed; capped overtime then auto-end.

**Lesson Hub + multi-book (Wonders Workshop/Literature):** Product locked in `docs/LESSON_HUB_AND_MULTI_BOOK_PRODUCT.md`. **Deferred** until Phase 2–3 interactivity ships; includes static reader backdrop (no dimmed map), Focus/Dock/Park sources, hub carousel, class-start streak. Teach with book + board **now** per “ready for classes” levels in that doc.

**Student home (roster → one teacher page per kid):** Product locked in `docs/STUDENT_HOME_PRODUCT.md`. Implement **phase by phase** per `docs/STUDENT_HOME_PHASED_PLAN.md` (test after each phase). Kills Plan vs Preview split; Next class default; Start / Open book in header. Phase 0–2b done (shell + Next class UX); next code phase **3 kill /plan split**.

**Class toolbox (in-lesson coin / dice / timers):** Product locked in `docs/CLASS_TOOLBOX_PRODUCT.md`. Implement **phase by phase** per `docs/CLASS_TOOLBOX_PHASED_PLAN.md` (test after each phase). Book left-strip menu → dock + stage for coin/dice; timers in bottom-right dock only. **Phase 0–5 done** (shell + coin + multi-dice + timer + stopwatch). Next: **Phase 6 polish** only after real class use. Parkable vs student-home / lesson-board if those are the active ship track.

**Reading checks (story popups):** Product locked in `docs/READING_CHECKS_PRODUCT.md`. Implement **phase by phase** per `docs/READING_CHECKS_PHASED_PLAN.md` (test after each phase). Story map → text fuel → check pack (draft/approve) → Books desk → AI draft → Prepare glance → in-class check links (speak→mark). **Phase 0–7 done**; **Phase 9a–9c + 9e** lesson frame, skill-aware Generate, Stop and Check, Literature→Workshop link in `docs/READING_CHECKS_LESSON_AWARE_PHASED_PLAN.md`. Phase 8 polish only after real class use.

**Books library & prep desk:** Product locked in `docs/BOOKS_LIBRARY_PRODUCT.md`. Implement **phase by phase** per `docs/BOOKS_LIBRARY_PHASED_PLAN.md` (test after each phase). Library → lesson shelf → parts → part shell — **not** a teaching lobby. Teach stays on student/class. **Phase B–E done** (part prep + workshop open). **Workshop chrome:** `docs/BOOKS_WORKSHOP_PRODUCT.md` — Phase 1–4 (place bar through vocab Words on the bar).

**Book exercises (workbook word-bank + choose-answer):** Product locked in `docs/BOOK_EXERCISES_PRODUCT.md`. Implement **phase by phase** per `docs/BOOK_EXERCISES_PHASED_PLAN.md` (test after each phase). Box one exercise → draft (hand or Gemini) → Approve → **Check in class**. Not reading checks and not timed challenge. **Word-bank Phase 1–5 done.** **Choose-answer Phase 1–5 done** — both types ship the full loop.

**Classroom home (Welcome / Wrap):** Product locked in `docs/CLASSROOM_HOME_PRODUCT.md`. Implement **phase by phase** per `docs/CLASSROOM_HOME_PHASED_PLAN.md` (test after each phase). Evolves the existing welcome/wrap book screen into a personal classroom home — not Lesson Hub, not a dashboard. **Phase 0–4 done.** Yellow home is the student stage. Teacher editing on yellow is superseded by Today’s class. Next: **Phase 5 greetings** only if you want them, or **Phase 6 polish** after a real class.

**Today’s class (Prepare desk):** Product locked in `docs/CLASS_PREP_DESK_PRODUCT.md`. Implement **phase by phase** per `docs/CLASS_PREP_DESK_PHASED_PLAN.md`. Prepare → teacher sheet; yellow stays Welcome / Wrap. **Phase 0–4 done** (desk + parts + Preview + part content). Next: Phase 5 ready dots.

---

## Phase 2–3 breakdown (when you start interactive book)

**Phase 2 — Interactive vocab v0 (suggested tasks)**

1. Pick **one** book + **one** vocab spread (manual region: page range or coordinates later). — **Done:** Journeys G3 U3 “Vocabulary in Context” demo pack in `lib/books/interactive-vocab.ts`.
2. Data: list of **headwords** + optional rich fields (definition, examples, synonyms…); start with **text only**; add audio/video URLs when stable. — **Done** for demo pack; saved part-context words override via `/api/context/get`.
3. UI: **word list** on or beside the page; tap word → **one** panel (drawer or modal) with definition + examples + obvious **Back to book**. — **Done:** `InteractiveVocabReaderShelf` in fullscreen reader + library reader.
4. Wire **no** or **soft** link to student vocab bank until Phase 4. — **Not wired** (as planned).

**Next for Phase 2:** add more `INTERACTIVE_VOCAB_PACKS` rows as you teach new sections; optional region highlight on page.

**Phase 3 — Reading checks v0**

Product + build order locked:

- **`docs/READING_CHECKS_PRODUCT.md`** — story map + story text + check pack; teacher-triggered check links; speak→mark; Books desk + Prepare status; AI draft after text; approve before live.
- **`docs/READING_CHECKS_PHASED_PLAN.md`** — implement **one phase at a time** (test after each). First teachable slice = end of plan Phase 7 on one Literature story.

Legacy one-liners (superseded by the docs above): reading span → teacher trigger → few question types; auto cadence / on-page pins later.

---

## Notes (fill as you go)

**Reader layout (locked in):** Spread-only v1 — two page slots per view, right may be empty. New reader/ink/selection code should not add `isSinglePageMode` branches; legacy branches may be removed when touched. PDF export’s temporary one-page capture stays isolated from reader behavior.

**Run target (locked in):** `npm run dev` on this machine for real lessons. Hot reload is rare enough that a separate `build` + `start` routine is **not** required unless that changes.

**Phase 1 — bookmark / “where we left off”:** The saved place is the **last viewed PDF page at the moment the teacher ends the class** (or taps “finish class” when we add it). If you flip ahead to preview with the student, **navigate back** to the page where you want the bookmark, then end the class there. Scheduled classes + prepared lesson parts will be assigned before class; **finish class** can later set the bookmark automatically to that “last viewed” page.

*(Voov/WeChat quirks, anything that blocked you.)*

---

## Last updated

2026-08-20 — **Workshop chrome Phase 4:** Vocab Words on the place bar (outlined + Mark → Vocab).
2026-08-20 — **Workshop chrome Phase 3:** Shelf Open book → Mark this section → Story / Exercise (Vocab stub).
2026-08-20 — **Workshop chrome Phase 1:** Place bar on the open book (where you are + Close). Checks wizard does not auto-open.
2026-08-20 — **Workshop chrome Phase 2:** Outlined story opens scan / checks / pin / Approve beside the book (no pick-story wizard).

2026-08-20 — **Books Phase E:** Story/vocab **Open book** from the part desk opens the same workshop reader as class prep (clock off) with the Checks bar. Panel no longer dims the pages.

2026-08-19 — **Today’s class Phase 4:** Prepare shows saved words / story / grammar on a part; skip + star words for this class; jump to Books if empty.

2026-08-19 — **Today’s class Phase 3:** Preview yellow Welcome from the desk; Back; clock stays off.

2026-08-19 — **Today’s class Phase 2:** Lesson parts + start here; Start class off Prepare; wide desk.

2026-08-19 — **Today’s class Phase 1:** Prepare opens a teacher desk (not yellow Welcome). Continue clock off; Start class → Welcome.

2026-08-19 — **Classroom home Phase 4:** End class Review on the same home — duration, practiced lines, compact scores, review words, streak. Giant check-count board retired.

2026-08-19 — **Classroom home:** product + phased plan locked (`docs/CLASSROOM_HOME_*.md`).

2026-08-18 — **Book exercises choose-answer Phase 5:** Show answers after a wrong Check; choose-answer track complete.

2026-08-18 — **Book exercises choose-answer Phase 4:** Draft from box (Gemini fills questions + choices as draft; you still Approve).

2026-08-18 — **Book exercises choose-answer Phase 3:** approved pin → Check sheet → tap choices → green/red → close, still on the book.

2026-08-18 — **Book exercises choose-answer Phase 2:** type questions by hand, 2–4 choices, Approve when complete; Check still Phase 3.

2026-08-17 — **Book exercises:** second type locked (choose the correct answer); Phase 1 = pick type, box empty. Word-bank v1 stays.

2026-08-17 — **Book exercises Phase 5:** Show answers after Check; extra unused bank words; two gaps in one sentence.

2026-08-17 — **Book exercises Phase 4:** Draft from box (Gemini fills bank + gaps as draft; you still Approve).

2026-08-17 — **Book exercises Phase 3:** tap an approved pin → word-bank Check sheet (green/red) → close, still on the book.

2026-08-17 — **Book exercises Phase 2:** hand-typed word bank + gapped sentences + Approve (draft never live).

2026-08-17 — **Book exercises:** product + phased plan locked (`docs/BOOK_EXERCISES_*.md`); Phase 1 = box a task on the open book (no Gemini, no Check).

2026-08-10 — **Books library Phase D done:** Advanced tools hub no longer Map/Ready/Tools equal tabs; checklist removed; default Advanced tab Materials; Stories copy points to part prep. This phased plan is complete.

2026-08-10 — **Books library Phase C4 done:** Old prep desk shrunk — removed from parts/part prep; quiet Advanced tools on lesson shelf only. Next: Phase D cleanup if needed.

2026-08-09 — **Books library Phase B done (smoked):** Lesson → parts → part shell → back; fixed desk nav so opening a lesson no longer flash-reloads the whole library. **Next: Phase C** (real prep in the part shell).

2026-08-09 — **Books library Phase B:** Lesson → parts list → part prep shell (preview); deep links via lesson/part query.

2026-08-09 — **Books library Phase A:** Cover click → lesson shelf (or outline CTA); Prep/Browse doors dropped from Library cards; Teach stays on student/class.

2026-08-09 — **Books library rethink:** Product + phased plan locked (`docs/BOOKS_LIBRARY_*.md`); shelf → lesson desk direction; Teach stays on student/class.

2026-08-04 — **Reading checks prep panel:** From Prep (list icon) or status glance — pick book/unit, manual page range, scan, Generate/Approve; same save path as Books → Stories.

2026-08-04 — **Reading checks Phase 7:** In fullscreen reader, approved story shows check-link list; tap → question popup; Correct / Incorrect / Skip; soft local mark log; drafts stay hidden; never blocks page turns.

2026-08-04 — **Reading checks Phase 6:** Prepare / next-class status glance (approved / Needs review / None) on Classes + dashboard; tap opens Stories desk for that story.

2026-08-04 — **Reading checks Phase 5:** Generate draft from saved story text (Gemini) into draft check pack; never auto-approves.

2026-08-04 — **Reading checks Phase 3:** Check packs on Stories (stops + true/false or MCQ, draft/approve); only approved packs eligible for live reader helper.

2026-08-03 — **Outline wizard sync:** Switching books reloads that book’s outline; save keeps per-unit PDF paths; toast + Outline focus the saved book/unit.

2026-08-03 — **Books setup:** Removed Check pages tab; Outline is the mapping source of truth; Stories reads live outline ranges (confirmed overrides only).

2026-08-03 — **Reading checks Phase 1b:** Stories tab lists all outline stories with first-page previews, page/text status chips, unit filter.

2026-08-03 — **Reading checks Phase 1:** Story map for Journeys G3 “Jump!” — Books **Stories** tab, saved page ranges, reader badge when inside the story.

2026-08-03 — **Reading checks:** product + phased plan locked (`docs/READING_CHECKS_*.md`); Phase 3 breakdown points at story map → text → pack/approve → desk → AI → Prepare glance → in-class list.

2026-07-29 — **Class toolbox:** Drag floating dock by title bar (session remembers spot).

2026-07-29 — **Class toolbox:** Phase 5 stopwatch (counts up MM:SS, start/pause/reset, same digit look as Timer).

2026-07-29 — **Class toolbox:** Phase 4 countdown (30s / 1 min / 2 min presets, start/pause/reset, “Time’s up!” in bottom-right dock).

2026-07-29 — **Class toolbox:** Phase 3b multi-dice (d4–d20, max 6, total + dock chips).

2026-07-28 — **Class toolbox:** Phase 3 dice (dock + tumble over book, faces 1–6).

2026-07-28 — **Class toolbox:** Phase 2b dock + stage — coin flips over the book; Flip/result in bottom-right dock.

2026-07-28 — **Class toolbox:** Phase 2 coin flip (big H/T, tap to flip again); Phase 0–1 docs + shell already shipped.

2026-07-28 — **Class toolbox:** product + phased plan locked (`docs/CLASS_TOOLBOX_*.md`); Phase 0 docs + Phase 1 empty shell (book left strip → menu → blank floating panel).

2026-07-26 — **Student home** Phase 2b Next class UX (prep hierarchy; header owns Start/Open); next code phase **3 kill /plan split**.

2026-07-26 — **Student home** Phase 2 shell (`/students/[id]`: Start / Open book + Next class · Books · Learning · Settings); next code phase **3 kill /plan split**.

2026-07-26 — **Student home** Phase 1b roster chrome (header, sort, list/grid); Phase 0–1b done; next code phase **2 student shell**.

2026-07-26 — **Student home** product + phased plan locked (`docs/STUDENT_HOME_*.md`); Phase 0–1 done (docs + roster one-door); next code phase **2 student shell**.

2026-07-22 — **Class schedule lifecycle** product + phased plan locked (`docs/CLASS_SCHEDULE_LIFECYCLE_*.md`); Phase 0 docs done; next code phase **R1 Move**.

2026-06-10 — **Spread-only v1** locked in `PROJECT_CONTEXT.md`; non-goal + Notes updated; ink/selection work should assume spread (left + optional right), not single-page reader.

2026-06-08 — **Lesson Hub + multi-book:** decisions captured in `docs/LESSON_HUB_AND_MULTI_BOOK_PRODUCT.md`; build after Phase 2–3; static backdrop replaces dimmed map when implemented.

2026-05-02 — **Session log:** `sessionNote` on class sessions + End class + Past classes UI; `updateStudentClassSessionNote`; Phase‑1 roadmap session-note line checked.

2026-05-02 — **Resume everywhere:** `getStudentDefaultBookUnitForReader` + reader opens at last stop when the URL has **student** but omits book/unit (or book only); Students list **Book**, profile **Open book**, Curriculum **Open Library Reader** deep links aligned; Phase‑1 roadmap lines 1–2 checked.

2026-05-02 — **Dashboard:** removed the three shortcut tiles under Today; **Milestone** updated to reflect that + reader last-stop + partial progress on Phase‑1 roadmap bullets.

2026-05-02 — **Recently shipped:** dashboard today’s classes + start shortcuts, 20‑minute class reminder, optional post-class recap (end dialog + past-class prompt).

2026-05-02 — Documented **Recently shipped** under Phase 1: curriculum reading anchor + last-class bookmark line, Classes default section from anchor, automatic spotlight PDF preview when the section changes, and the Classes-tab `library` hook-order fix.

2026-05-03 — Phase 0 checklist completed; run target and bookmark rules captured in Notes; wording “smoke test” → “lesson-path try.”
