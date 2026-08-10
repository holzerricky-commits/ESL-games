# Class schedule lifecycle — phased implementation plan

Last updated: 2026-07-22

**Product source of truth:** `CLASS_SCHEDULE_LIFECYCLE_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next phase. Do not skip phases unless a prerequisite is already done and checked.

**Build order (locked):**

```text
0 docs → R1 Move (planned) → R2 Move while live → 1 schedule clock → 2 auto-start → 3 grace/extend → 4 auto-end → 5 catch-up/Missed → 6 polish
```

**Do not ship auto-start (Phase 2) until R2 works** — otherwise a parent “can we move?” at the bell traps you in a live session.

**Current codebase baseline (pre–R1):**

- Manual Start → `in_progress` + `classStartedAt` = click time.
- Timer = `classStartedAt + durationMin` (late start = wrong end).
- Overtime shows “over”; no auto-end; no `missed` status.
- Schedule: edit / drag / “only this class” vs “every week”; live blocks drag; no dedicated fast **Move** sheet.

---

## Phase 0 — Documentation ✅

| Item | Status |
|------|--------|
| `CLASS_SCHEDULE_LIFECYCLE_PRODUCT.md` | Done |
| `CLASS_SCHEDULE_LIFECYCLE_PHASED_PLAN.md` | Done |
| Cross-links in `CLASS_SESSION_FLOW_TASKS.md`, `MILESTONE.md` | Done with this pass |

**Your test:** Read the product doc; confirm Move chips, grace/extend caps, and Missed match what you want before R1 code.

### Non-goals

- No code in Phase 0.

---

## Phase R1 — Move class (not live yet) ✅

**Goal:** One **Move class** sheet for planned/prepared sessions; days-ahead and minutes-ahead feel the same.

### Tasks

- [x] Add **Move class** entry on Today / home class card and schedule event detail (planned/prepared only in this phase).
- [x] Sheet: chips **+30 min**, **Tomorrow same time**, **Pick date & time**; default scope **this class only**.
- [x] Apply via existing single-occurrence reschedule helpers (or thin wrapper); keep prep on the same session.
- [x] Conflict check + clear error; success toast with new time.
- [x] Cancel remains separate from Move.
- [x] Unit tests for chip target times and reschedule success/conflict.

### Acceptance (you test)

- [ ] Move a class two days ahead with the picker → shows on the new day; weekly slot unchanged.
- [ ] Use **+30 min** a few minutes before start → new time today; prep still there.
- [ ] Overlap with another student → blocked with a clear message.

### Non-goals

- Move while `in_progress` (R2).
- Auto-start / auto-end / Missed status.
- Changing “every week” inside the Move sheet (use existing recurring edit).

---

## Phase R2 — Move instead (live or at the bell)

**Goal:** From a live class, **Move instead** unlives the session and reschedules without marking it completed.

### Tasks

- [x] Live timer (and Today when live): **Move instead** opens the same Move sheet (chips emphasized).
- [x] On confirm: leave `in_progress`; clear live start metadata; **no** `bookmarkAtEnd` / no completed path; set new `scheduledFor`; status → `planned` or `prepared`.
- [x] Idempotent / safe if already not live.
- [x] Tests: live → move → planned at new time; bookmark not written; can start again later.

### Acceptance (you test)

- [ ] Start (or open live) class → **Move instead** → **Tomorrow same time** → not in Past as completed; appears tomorrow.
- [ ] Accidental auto-start later (Phase 2) can be undone the same way.

### Non-goals

- Grace / extend UI.
- Forced navigation away from the map (optional soft return to Today is OK).

---

## Phase 1 — Schedule-based countdown

**Goal:** While live, the timer aims at **scheduled end** (+ extends later), not click time.

### Tasks

- [x] Timer helper: effective end = `scheduledFor + durationMin` (+ `extendedMinutesTotal` when added in Phase 3).
- [x] Keep `classStartedAt` as “became live” for history only.
- [x] Update map timer + any shared live displays; unit tests for late/early start.

### Acceptance (you test)

- [ ] Start 2 min late on a 30 min slot → ~28 left, not 30.
- [ ] Start early → still ends at calendar end.
- [ ] Warning / over styling still work; **no** auto-end yet.

### Non-goals

- Auto-start, grace buttons, Missed.

---

## Phase 2 — Soft auto-start (app open)

**Goal:** At scheduled start, if the app is open, go live without Start — safe because R2 exists.

### Tasks

- [x] Reconcile tick on shell / home / relevant routes: `planned`/`prepared` with start ≤ now and not past end+grace → start (idempotent).
- [x] Enforce **one live class app-wide**; if conflict, leave planned and show a short cue.
- [x] Toast/banner “X’s class is live”; do **not** force-open the book.
- [x] Prep / Open book without Start still does not go live.
- [x] Manual Start early still works.

### Acceptance (you test)

- [ ] Leave home open through :00 → session becomes live; timer correct (Phase 1).
- [ ] Prep only → still not live.
- [ ] Second student’s slot while first is live → no second auto-start.

### Non-goals

- Catch-up after sleep (Phase 5).
- Auto-end.

---

## Phase 3 — Grace + extend UI

**Goal:** Short overtime window with capped extends.

### Tasks

- [x] Persist `extendedMinutesTotal` (sanitize); effective end includes it.
- [x] States: active → grace (0–5 min past effective end) → must_end (Phase 4).
- [x] Timer chrome in grace: overtime + **End now** + **+2 / +5 / +10** (disable if would exceed +15 total).
- [x] Manual End always available.

### Acceptance (you test)

- [ ] At scheduled end → grace UI; tools still work.
- [ ] Extends work until +15 cap; then no further extend.
- [ ] Refresh mid-grace keeps budget.

### Non-goals

- Hard auto-end (Phase 4) — copy may say “will end soon” only.

---

## Phase 4 — Hard auto-end

**Goal:** Ignoring grace / max overtime completes the class safely.

### Tasks

- [x] On grace expiry (with no remaining extend room): same end path as End class (flush ink/annotations, bookmark rule).
- [x] Skip blocking recap; soft “add note later” OK.
- [x] Brief “Class ended (time’s up)” notice; idempotent if already completed.
- [x] Tests for auto-end once.

### Acceptance (you test)

- [ ] Let grace run out → `completed`, bookmark saved, not stuck live.
- [ ] Manual End during grace still works.

### Non-goals

- Map loot / ceremony.

---

## Phase 5 — Catch-up + Missed

**Goal:** Opening the app after sleep / closed tab reconciles reality; no-shows become **Missed**.

### Tasks

- [x] Add status `missed` to types, sanitize, labels, filters (`computeNextClass` ignores missed like completed/cancelled).
- [x] On load reconcile:
  - Still `planned`/`prepared`, now past end+grace → **`missed`**
  - Was `in_progress`, now past end+grace → **auto-end** (Phase 4 → completed)
  - Currently inside slot window → auto-start (Phase 2)
  - Never auto-start a slot that ended hours ago
- [x] Missed UI: **Reschedule** (Move sheet) · **Mark taught anyway** · leave missed.
- [x] Tests for each reconcile branch.

### Acceptance (you test)

- [ ] Never open during a morning slot → afternoon open shows **Missed**, not live.
- [ ] Close mid-class, reopen after end+grace → **completed**, not live.
- [ ] Open mid-slot after being away → live with correct time left.
- [ ] Missed → Reschedule → planned at new time.

### Non-goals

- Server cron; OS notifications.
- Heuristic “live &lt; 2 min = missed” (v1: in_progress past grace → completed).

---

## Phase 6 — Teaching UX polish

**Goal:** Today’s list makes state obvious during a real teaching day.

### Tasks

- [x] Today states: Upcoming / Starting / Live / Grace / Done / Missed (copy + one primary action each).
- [x] If in grace and next student soon → short warning (“Maya in 3 min — End or +2?”).
- [x] Align ~20 min reminder with new states; keep chrome small for screen share.

### Acceptance (you test)

- [ ] One real lesson using schedule + Move + extend; no forgotten Start/End.
- [ ] Overlap warning helpful, not noisy.

### Non-goals

- Full dashboard redesign; Lesson Hub / streak.

---

## Progress checklist

| Phase | Name | Status |
|-------|------|--------|
| 0 | Documentation | ✅ |
| R1 | Move (planned) | ✅ code — awaiting your test |
| R2 | Move while live | ✅ code — awaiting your test |
| 1 | Schedule-based countdown | ✅ code — awaiting your test |
| 2 | Soft auto-start | ✅ code — awaiting your test |
| 3 | Grace + extend | ✅ code — awaiting your test |
| 4 | Hard auto-end | ✅ code — awaiting your test |
| 5 | Catch-up + Missed | ✅ code — awaiting your test |
| 6 | Polish | ✅ code — awaiting your test |

Class schedule lifecycle track complete through Phase 6. Say **“park”** for leftovers, or start another milestone track.
