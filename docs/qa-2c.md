# Milestone 2C — Classroom validation (QA)

Manual checks + code guarantees for progression, coins, and unlock rules.

## Rules (implemented)

| Rule | Where |
|------|--------|
| Challenge pass = **score % ≥** `ChallengeDefinition.passThreshold` (default **70%**) | `applyChallengeAttempt` in `lib/students/progression.ts` |
| **Coins** only on **first** completion of a challenge | `isFirstCompletion` + single `CoinTransaction` |
| **Unlock next** only after first completion of current | Unlocks next row when `isFirstCompletion` |
| **Locked** rows: no progress update for that challenge | Early return when `status === 'locked'` |
| **Empty path**: quiz not on path → no `applyChallengeAttempt` | `play-mode.tsx` only runs when `challengeForQuiz` exists |
| **Stale progress**: rows out of sync with catalog | `ensureProgressAlignsWithCatalog` before apply (`lib/students/progression.ts`, used in `play-mode.tsx`) |

## Known limitations (by design)

- **Student not in registry** but name matches a **known result** / play: path comes from `getStudents` + `assignedQuizIds`. If there is no registry row, `getChallengeCatalogForStudentKey` returns **[]** → no path progress (teacher should add student or assign after sync).
- **Two browser tabs**: last write to `localStorage` wins; refresh to see the other tab’s changes.
- **Quiz pass** in Timed Challenge UI uses `quiz.passThreshold` as **count of correct** for the “Passed” label; **challenge completion** for progression uses **percentage %** vs `ChallengeDefinition.passThreshold` (default 70%). Align quiz design with that expectation.

## Manual checklist (run in dev)

Use a **clean profile** or note existing `localStorage` keys: `esl_student_progress`, `esl_students`, `esl_quizzes`, `esl_student_results`.

### A. Retry + coins

1. Assign **one** quiz to a student on `/students/[id]/plan`; open profile → Challenges shows one unlocked step.
2. **Timed Challenge** → that quiz → challenge mode → name **exactly** as in registry.
3. Finish with **&lt; 70%** correct (if enough questions): expect **not** completed, **no** coin increase on list.
4. **Retry** until **≥ 70%** correct: expect **completed**, **coins** increase once, next challenge unlocks if a second exists.
5. **Play same challenge again** with pass: expect **no second coin** for that challenge (attempts may still increment).

### B. Unlock order

1. Assign **two** quizzes in order. First run: only first is **unlocked**.
2. Fail first: second stays **locked**.
3. Pass first: first **done**, second **unlocked**.

### C. Edge cases

1. **Empty path**: student with no assignments → play challenge in library → **no** path progress (coins/path unchanged for that path key).
2. **Refresh**: after a completion, reload student profile → statuses and coins persist.
3. **Deleted quiz** (optional): assign quiz A, delete A from library, reload plan → path shrinks; open progress in DevTools and confirm no crash; re-assign valid quizzes if needed.

## Sign-off

- [ ] A — Retry + coins  
- [ ] B — Unlock order  
- [ ] C — Edge cases  

**Verified by:** _______________ **Date:** _______________
