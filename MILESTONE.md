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

---

## Next sprint preview — Phase 1 (after Phase 0 is ✓)

### Recently shipped (toward Phase 1)

- [x] **Curriculum “where reading starts” (anchor)** — Teacher sets the planned first lesson piece on the Curriculum tab; it is stored on the student and used as the default section in **Classes** when there is no prior completed class with a chosen piece; Curriculum also shows a read-only **last class bookmark** next to the plan.
- [x] **Classes spotlight preview** — The PDF spread for the next/live class card updates automatically when the resolved section changes (no extra click on the section title to align the preview).
- [x] **Classes tab stability** — Fixed a crash when opening the Classes tab (`Cannot access 'library' before initialization` from hook ordering).
- [x] **Dashboard today’s classes** — Home screen centers on **today’s schedule** with **Start** and **Plan**; optional **20‑minute** corner reminder before a class; extra clutter trimmed (including **removal of the three shortcut tiles** under Today—Students / Timed Challenge / Library—use the sidebar for those).
- [x] **After-class recap (optional)** — End-class dialog can include a quick recap; past classes can **add a note later** or **dismiss** the gentle prompt.
- [x] **Reader “last stop” with a student** — Opening the book from the student’s class flow uses the **newest** of end-of-class bookmark vs reader history for that book/unit (with **Last time / Today** lines on the next-class card and **Open book at last stop**).
- [x] **Default reader target + resume from partial URLs** — `getStudentDefaultBookUnitForReader` resolves book/unit from assignments when `/books` has `student` but missing `book`/`unit` (or book only); same helper feeds list **Book**, profile/plan **Open book**, and Curriculum reader link.
- [x] **Session log per class** — `sessionNote` on `StudentClassSession`; end-class dialog + Past classes editing via `updateStudentClassSessionNote`.

### Still on the roadmap

Phase 1 preview items above (bookmark paths, **Open book**, session log) are **checked**. **Two-page spread ink** (Phases 1–6 in `docs/SPREAD_INK_PHASED_PLAN.md`) is v1-shippable; further pen speed / marker canvas tuning is parking-lot only. **Phase 2 interactive vocab v0** has a shippable slice (one demo section + reader shelf UI). Next slice is **more vocab packs / Phase 3 reading checks** or ad-hoc polish—nothing listed here as a blocker.

---

## Phase 2–3 breakdown (when you start interactive book)

**Phase 2 — Interactive vocab v0 (suggested tasks)**

1. Pick **one** book + **one** vocab spread (manual region: page range or coordinates later). — **Done:** Journeys G3 U3 “Vocabulary in Context” demo pack in `lib/books/interactive-vocab.ts`.
2. Data: list of **headwords** + optional rich fields (definition, examples, synonyms…); start with **text only**; add audio/video URLs when stable. — **Done** for demo pack; saved part-context words override via `/api/context/get`.
3. UI: **word list** on or beside the page; tap word → **one** panel (drawer or modal) with definition + examples + obvious **Back to book**. — **Done:** `InteractiveVocabReaderShelf` in fullscreen reader + library reader.
4. Wire **no** or **soft** link to student vocab bank until Phase 4. — **Not wired** (as planned).

**Next for Phase 2:** add more `INTERACTIVE_VOCAB_PACKS` rows as you teach new sections; optional region highlight on page.

**Phase 3 — Reading checks v0**

1. Define a **reading span** (pages or lesson id from your book map).
2. **Teacher-triggered** “Insert check” for v0 (faster than smart cadence); optional **every N pages** once manual path works.
3. One or two **question types** (MCQ comprehension, quick true/false); results optional log to localStorage for Phase 4.

---

## Notes (fill as you go)

**Run target (locked in):** `npm run dev` on this machine for real lessons. Hot reload is rare enough that a separate `build` + `start` routine is **not** required unless that changes.

**Phase 1 — bookmark / “where we left off”:** The saved place is the **last viewed PDF page at the moment the teacher ends the class** (or taps “finish class” when we add it). If you flip ahead to preview with the student, **navigate back** to the page where you want the bookmark, then end the class there. Scheduled classes + prepared lesson parts will be assigned before class; **finish class** can later set the bookmark automatically to that “last viewed” page.

*(Voov/WeChat quirks, anything that blocked you.)*

---

## Last updated

2026-05-02 — **Session log:** `sessionNote` on class sessions + End class + Past classes UI; `updateStudentClassSessionNote`; Phase‑1 roadmap session-note line checked.

2026-05-02 — **Resume everywhere:** `getStudentDefaultBookUnitForReader` + reader opens at last stop when the URL has **student** but omits book/unit (or book only); Students list **Book**, profile **Open book**, Curriculum **Open Library Reader** deep links aligned; Phase‑1 roadmap lines 1–2 checked.

2026-05-02 — **Dashboard:** removed the three shortcut tiles under Today; **Milestone** updated to reflect that + reader last-stop + partial progress on Phase‑1 roadmap bullets.

2026-05-02 — **Recently shipped:** dashboard today’s classes + start shortcuts, 20‑minute class reminder, optional post-class recap (end dialog + past-class prompt).

2026-05-02 — Documented **Recently shipped** under Phase 1: curriculum reading anchor + last-class bookmark line, Classes default section from anchor, automatic spotlight PDF preview when the section changes, and the Classes-tab `library` hook-order fix.

2026-05-03 — Phase 0 checklist completed; run target and bookmark rules captured in Notes; wording “smoke test” → “lesson-path try.”
