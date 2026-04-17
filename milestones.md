# ESL Timed Challenge — milestones & build checklist

Teacher-first classroom app. Use this file to **finish one task at a time**; tick items in your editor or PRs as you go.

---

## Product guardrails

- **Teacher control is primary** (assign paths, run class, see progress).
- Student motivation features must **support learning**, not derail the lesson.
- Every new feature should improve at least one of: **speed to run class**, **student engagement**, **progress visibility**.

---

## Current foundation (already in the repo)

- **Nav:** Dashboard, Students, Games, Settings (`lib/navigation.ts`).
- **Students:** list, add student, profile with tabs; **teacher plan** at `/students/[studentId]/plan` (assign ordered quizzes from Timed Challenge library).
- **Progression:** challenge states `locked` / `unlocked` / `completed`; linear unlock after pass threshold; **coins on first completion**; `CoinTransaction` history on record; persisted in **localStorage** (`esl_student_progress`, `esl_students`).
- **Play:** Timed Challenge challenge mode applies attempts via `getChallengeCatalogForStudentKey` + `applyChallengeAttempt` (`components/play-mode.tsx`, `lib/students/progression.ts`).
- **Student Challenges tab:** real cards from assigned path + optional **mystery locked** filler slots (grid up to 24) for motivation.

---

## Milestone 2 — Progression engine (close the loop)

**Goal:** Milestone 2 is “game system” complete: data + UI + a quick validation pass.

### 2A — Data & logic (done)

- [x] Challenge definitions built from quiz library (`lib/challenges.ts`).
- [x] Per-student ordered path (`assignedQuizIds`) + catalog merge.
- [x] `StudentProgressRecord` + `createInitialProgressRecord` / `reconcileProgressWithCatalog` / `applyChallengeAttempt`.
- [x] First-completion coin reward + `coinTransactions`; `totalCoins`.
- [x] Persist `esl_student_progress` reliably.

### 2B — Wire to UI (mostly done)

- [x] Students list: progress, coins, current challenge labels (`lib/students/selectors.ts`).
- [x] Profile Challenges tab: statuses + quiz-backed cards + filler slots (`components/students/tabs/student-challenges-tab.tsx`).
- [x] **Overview tab** — placeholder cards removed; empty state until real summary is designed (see Milestone 2b / later for level, snapshot, quick actions).
- [x] Optional: **coin / transaction summary** on profile (read-only list).

### 2C — Classroom validation (QA pass)

- [x] Retry: multiple attempts update scores; **only first completion** awards coins (`applyChallengeAttempt` + `docs/qa-2c.md`).
- [x] Unlock: next step opens only after **pass** on current (threshold in `ChallengeDefinition`).
- [x] Edge cases: documented (registry empty path, `ensureProgressAlignsWithCatalog` for stale rows; two-tab refresh note in `docs/qa-2c.md`). **Manual sign-off** in that doc when you run the checklist.

---

## Milestone 2b — Run class faster (pick after 2C)

**Goal:** fewer clicks from “I’m with this student” → “they’re playing the right challenge.”

- [x] **Start current challenge** from student Overview (or Challenges): deep-link to Timed Challenge with correct quiz + challenge mode (only if current step is unlocked).
- [x] Optional: **Dashboard v1** — Today / quick actions / snapshot from existing storage (defer full “at-risk” + feed if needed).

---

## Milestone 3 — Wallet + reward economy

**Goal:** spend loop + clearer rules (align with your original +50 / bonus ideas or document the tiered `coinReward` in `lib/challenges.ts`).

- [ ] Wallet UI (total + optional transaction list).
- [ ] Rules: perfect-score bonus, practice coins (if Practice mode exists), document constants.
- [ ] **Shop:** categories, buy / owned / equipped states; persist purchases.
- [ ] Pricing table (starter numbers from product spec).

---

## Milestone 4 — Avatar & cosmetics

- [ ] Avatar preview + equip slots (hat, top, bottom, accessory, pet, background).
- [ ] Wire shop purchases to avatar (cosmetics only, no gameplay stats).

---

## Milestone 5 — Polish & analytics

- [ ] Unlock / “level up” motion when a challenge flips to completed (build on `data-status` in challenge cards).
- [ ] Stronger progress map visuals (optional vertical path).
- [ ] Teacher analytics: at-risk, “stuck on same challenge”, weekly completions (needs derived metrics from progress + results).
- [ ] Optional: **Rewards** top-level nav or embed under Students.

---

## Session / classroom layer (when you need it)

- [ ] Current **class / session** indicator (name, quick note).
- [ ] **Quick search** student (global or Students page).
- [ ] **Quick “Start game”** (Timed Challenge entry) from header or Dashboard.

---

## Reference — key routes

| Route | Purpose |
|-------|--------|
| `/students` | Student list |
| `/students/[studentId]` | Profile (future student-facing play view) |
| `/students/[studentId]/plan` | Teacher-only: assign / reorder path |
| `/games` | Games hub; Timed Challenge is primary |
| `/dashboard` | Command center (to be expanded) |

---

## How to use this file

1. Pick **one unchecked box** in order (or the smallest risk item first).
2. Implement + manually test.
3. Check the box and commit with a short note.

When Milestone 2 (including 2C) is done, move focus to **Milestone 2b** or **Milestone 3** based on whether you want **speed** (2b) or **economy** (3) next.
