# Today’s class — phased implementation plan

Last updated: 2026-08-19

**Product:** `CLASS_PREP_DESK_PRODUCT.md`

Implement **one phase at a time**. Test, then continue. Do not skip.

```text
0 docs → 1 desk shell (Prepare ≠ yellow)
     → 2 lesson parts list
     → 3 Preview welcome
     → 4 content on parts (this class)
     → 5 ready dots + jump to Stories
     → 6 yellow display-only
     → STOP
```

---

## Baseline (already built)

- Prepare opens the class route, clock off, no auto-open.
- That route used to show **yellow** with teacher chrome (Save & exit, Checks, Add/Edit).
- Enter / auto-start → live Welcome, clock on.
- Same reader; last page; notes field on the class; next lesson piece.

---

## Phase 0 — Docs ✅

Product + this plan + cross-links. No UI in that pass.

---

## Phase 1 — Prepare opens Today’s class ✅ (this ship)

**Goal:** Tapping Prepare lands on a **teacher sheet**, not yellow Welcome.

### Tasks

- [x] First screen = Today’s class: who / when, book · unit · lesson, last page, notes, Continue, Done.
- [x] Light teacher chrome (Apple-like). Not yellow. No “Prep” title.
- [x] Continue → book at last page, clock still off.
- [x] Enter near class time still goes to live Welcome, not the desk.
- [x] Auto-start while on the desk → Welcome (existing live flip).
- [x] Closing the book in Prepare returns to the desk, not yellow.

### Non-goals

- Parts list, Preview, ready-status row, killing the Checks panel on the open book, moving Add/Edit off live Welcome.

**Your test:** Prepare from dashboard → desk. Continue does not start the clock. Enter still starts class.

---

## Phase 2 — This lesson’s parts ✅

**Goal:** The desk is this hour on the outline — not a skinny name-and-notes card.

### Tasks

- [x] Wide working area. Parts list is the main block.
- [x] Show this lesson’s parts in outline order. Mark **start here**.
- [x] Tap a row to change start here (same lesson only).
- [x] Continue still = last page, clock off.
- [x] Remove **Start class** from Prepare. Enter / auto-start still start class.

### Non-goals

- Preview, ready dots, Stories jump, ticking several parts for the hour.

**Your test:** Prepare → see the lesson parts. Tap a different row → Start here moves. Continue does not start the clock. No Start class on this page.

---

## Phase 3 — Preview welcome ✅

**Goal:** From the desk, see what the kid will see. Clock stays off.

### Tasks

- [x] **Preview** on the desk opens yellow Welcome, read-only (no Add/Edit).
- [x] **Back** (or Escape) returns to the desk. Still not live.
- [x] Continue on that yellow screen still opens the book with the clock off; closing the book returns to the desk.

### Non-goals

- Ready dots, Stories jump, greeting polish.

**Your test:** Prepare → Preview → yellow Welcome / Welcome back. No Edit. Back → desk. Clock never starts.

---

## Phase 4 — What’s in this part ✅ (this ship)

**Goal:** Prepare shows the **content** of a part, not only its title. You can mark this hour without editing the book.

### Tasks

- [x] Tap a part to open its saved fuel (words, story excerpt, grammar/writing notes when they exist).
- [x] Honest empty + **Open in Books** (Stories / part prep). No scan or generate on the desk.
- [x] This class only: **start here**, **skip**, **star words**, notes. Do not fork packs.

### Non-goals

- Ready-status chips, yellow Add/Edit move, rewriting word meanings on Prepare.

**Your test:** Prepare → tap Vocabulary / Story / Grammar. See real words or text if saved; empty + Books if not. Star a word and skip a part; they stick for this class. Continue still does not start the clock.

---

## Phase 5 — Ready row

Checks: approved / Needs review / None. Tap → Stories. Retire Prepare as a scan factory. Workbook ready/not only if cheap.

---

## Phase 6 — Yellow is display-only — then stop

Add/Edit today’s lines leaves yellow. Welcome only **shows** what you set. Then teach with it.

---

## Explicit non-goals (whole track)

AI planner, Lesson Hub, second reader, skill-category form, greeting polish, dumping every Books tool onto the desk.
