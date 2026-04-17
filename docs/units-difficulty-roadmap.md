# Units, steps & difficulty — implementation roadmap

This document turns the agreed product direction into **phased tasks**. It complements `milestones.md` and should be updated as scope shifts.

---

## Goals (what we’re building toward)

- **Units** (working name: *unit* or *topic unit*) group ordered **steps** (e.g. timed vocab → matching → gap-fill → writing).
- Completing **all steps** in a unit unlocks the **next unit**.
- Steps can be split into **parts** (e.g. Animals pt1 → pt2 → pt3), always **linear**: part *n* before part *n+1*.
- **Difficulty** (easy / mid / hard) affects **challenge selection** (which words/content), **pass feel**, and **coin payout**. Students have a **default tier** set by the teacher; they may attempt **higher** tiers (harder, more coins) or **lower** tiers (easier pass, fewer coins) and still **progress** when they pass.
- **Retries** are unlimited; **coins** are awarded **once per step** (first qualifying completion that counts for progression — same spirit as current “first completion” rewards).

---

## Locked product decisions (source of truth)

| # | Decision |
|---|-----------|
| 1 | **Default difficulty** is set by the **teacher when the student is created** (and can be edited later). That tier is the baseline for which content variant loads and for default rewards. |
| 2 | Students may play **above** or **below** their default tier. **Lower** tier = easier to pass, **fewer coins**; **higher** tier = harder, **more coins**. Passing **any** tier that counts as “pass” completes the step for **unlock purposes**. |
| 3 | **Unit gating:** the student must complete **every step** in the current unit before the **next unit** unlocks. |
| 4 | **Retries:** unlimited. **Coins:** **once per step** (no farming by repeating the same step). Exact tier used on the **first counted completion** can drive the single payout (see *Economy note* below). |
| 5 | **Parts:** strictly **one after another** (pt1 → pt2 → pt3). No skipping parts out of order. |

### Economy note (to confirm when implementing)

- **Recommended default:** one **coin transaction** on the **first successful pass** of a step (any tier that meets pass threshold). Amount = `f(baseStepReward, tierUsed)` where tier is the one used for that successful run.
- **Alternative (if you want to reward “reach up”):** first pass at **easy** pays X; if the student later clears **hard** on the same step, pay a **one-time bonus** `(Y − X)` — still “once” per step for base + optional bonus row. Pick one variant in the first economy PR and document it in code comments.

---

## Conceptual model (for engineering)

| Concept | Meaning |
|--------|--------|
| **Unit** | Ordered container of steps + metadata (title, theme, e.g. “Animals”). |
| **Step** | One slot in the sequence (activity type + content binding). Has its own pass rules and reward **base**. |
| **Part** | Sub-sequence inside a step or topic slice (pt1, pt2, pt3) when vocabulary is large. Linear only. |
| **Difficulty tier** | `easy` \| `mid` \| `hard` — selects content subset / quiz variant; feeds multiplier for coins. |
| **Student default tier** | Stored on **student**; used as UI default and for “recommended” path. |
| **Attempt** | A play session; may fail; retries allowed. |

### Current codebase touchpoints (today)

- Flat path: `StudentRecord.assignedQuizIds` → `buildChallengeCatalogForQuizIds` → `ChallengeDefinition` + `challenge-${quiz.id}` progress keys (`lib/challenges.ts`, `lib/students/progression.ts`).
- **Next evolution:** introduce a **unit/step graph** (or serialized list) **or** encode units in metadata and **flatten** to a linear challenge list for the engine with stable IDs.

---

## Phase A — Foundations (design + types only)

**Outcome:** shared vocabulary in types/docs; no user-facing change yet.

| Task | Detail |
|------|--------|
| A.1 | Define **difficulty tier** enum and **student default tier** field on `StudentRecord` (create + edit). |
| A.2 | Define **unit** / **step** TypeScript interfaces (ids, order, `activityKind`, `contentRef` or `quizId`, optional `partIndex`, `totalParts`, `baseCoinReward`). |
| A.3 | Decide **ID strategy** for progress rows: e.g. `unitId:stepId:part` or stable composite `challengeId` strings (must survive reordering if possible). |
| A.4 | Document **migration** from flat `assignedQuizIds` → `assignedUnits` (or hybrid: keep flat list as “legacy path” until migration). |

---

## Phase B — Teacher: student level + editing

**Outcome:** teacher sets and can change default difficulty tier.

| Task | Detail |
|------|--------|
| B.1 | Add **default tier** to student **create** (form + validation). |
| B.2 | Add **default tier** to student **profile / info** edit (reuse same control). |
| B.3 | Persist in `esl_students` (or equivalent) and expose in `StudentProfileView` / list views as a label (e.g. “Level: Mid”). |

---

## Phase C — Content & assignment: units + steps

**Outcome:** teachers assign **units** (with ordered steps and parts), not only a flat quiz list.

| Task | Detail |
|------|--------|
| C.1 | **Authoring:** define where units live (JSON, DB later, or admin UI). MVP: **static curriculum** file or small CRUD in Settings. |
| C.2 | **Plan** UI (`/students/[id]/plan`): replace or extend “assign quizzes” with **assign units** / reorder units / see steps inside a unit. |
| C.3 | **Quiz mapping:** each step still points at a **Timed Challenge quiz** (or future activity) **per tier** if tiers differ — e.g. `quizIdByTier: { easy, mid, hard }` or three quizzes linked to one step. |
| C.4 | **Parts:** for steps with multiple parts, show pt1 → pt2 → pt3 as **sequential** progress in UI. |

---

## Phase D — Progression engine

**Outcome:** unlock rules match **every step**, **every part**, **unit gating**.

| Task | Detail |
|------|--------|
| D.1 | Build **flattened catalog** from assigned units + student tier default (for display) + all tier variants (for play). |
| D.2 | **Unlock:** only **next** step/part unlocked when previous **passed**; **next unit** when all steps in unit **passed**. |
| D.3 | `applyChallengeAttempt` (or successor): inputs include **tier used** and **step/part id**; update `StudentChallengeProgress` (or new shape). |
| D.4 | `reconcileProgressWithCatalog` extended for **unit/step** changes (teacher edits path). |
| D.5 | **Lower tier pass:** marks step complete for **progression**; stores **tier used** for that completion. |

---

## Phase E — Play + coins

**Outcome:** tier-aware play, single coin grant per step, tier multipliers.

| Task | Detail |
|------|--------|
| E.1 | **PlayMode** (or launcher): load quiz for **selected tier** (default = student default; UI to switch before start). |
| E.2 | **Coin formula:** `coins = round(baseStepReward * tierMultiplier)`; document constants in one module (`lib/economy.ts` or `lib/challenges.ts`). |
| E.3 | **CoinTransaction:** extend `reason` or metadata to include **tier** and **unit/step id** for auditing. |
| E.4 | Ensure **first completion only** once per step (same as current first-completion behavior, but keyed by step identity). |

---

## Phase F — Student UI

**Outcome:** students see units, steps, parts, tiers, and lock states clearly.

| Task | Detail |
|------|--------|
| F.1 | **Challenges tab:** group by **unit**; show steps inside each unit; show **part** progress. |
| F.2 | **Start** flow: choose tier (default highlighted) or hide advanced behind “Change difficulty”. |
| F.3 | Overview / wallet: optional copy that explains **tier** and **coins once per step**. |

---

## Phase G — New activity types (deferred)

**Outcome:** matching, gap-fill, writing — not only timed quiz.

| Task | Detail |
|------|--------|
| G.1 | `activityKind` enum + router per kind. |
| G.2 | Implement **one** new kind (e.g. matching) end-to-end. |
| G.3 | Wire into **step** definitions in units. |

---

## Phase H — QA & docs

| Task | Detail |
|------|--------|
| H.1 | Extend `docs/qa-2c.md` (or add `docs/qa-units.md`) with: tier change, part order, unit unlock, coin once. |
| H.2 | Update `milestones.md` when a phase ships; **Milestone 3** economy should align with Phase E. |

---

## Suggested order of execution

1. **A → B** (types + teacher level) — small, visible win.  
2. **C.1–C.2** (minimal unit model + plan UI) — unlocks real structure.  
3. **D** (engine) — core risk; do before heavy UI polish.  
4. **E** (coins + tier) — after step identity is stable.  
5. **F** (student UI) — polish on top.  
6. **G** when Timed-only path is stable.

---

## Open items (not blocking the plan)

- **Exact tier multipliers** and **base rewards per step** — product numbers; wire as constants.  
- **Whether** “first pass at easy” blocks a later **hard bonus** — pick one rule in Phase E.  
- **Naming:** ship “Unit” in UI or “Topic” / “Module” for younger students.

---

## How to use this file

- Check off tasks in PRs or copy rows into GitHub issues.  
- When a phase completes, add a short **“Done”** subsection with date and any deviations.
