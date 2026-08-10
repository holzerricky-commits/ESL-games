# Class toolbox — phased implementation plan

Last updated: 2026-07-28

**Product source of truth:** `CLASS_TOOLBOX_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next phase. Do not skip phases unless a prerequisite is already done and checked.

**Baseline before Phase 1:** Book left strip has close, page list, lesson board, translate, coach, lesson settings. No shared Toolbox surface. Class session timer lives on the map. Games has a Dice Roll stub (out of scope for this shell).

---

## Phase 0 — Documentation ✅

| Item | Status |
|------|--------|
| `CLASS_TOOLBOX_PRODUCT.md` | Done |
| `CLASS_TOOLBOX_PHASED_PLAN.md` | Done |
| Cross-links in `MILESTONE.md`, `PROJECT_CONTEXT.md` | Done with this pass |

**Your test:** Read both docs; confirm product matches what you want before Phase 1 code.

---

## Phase 1 — Empty toolbox shell ✅

**Goal:** You can open/close the toolbox during a book lesson — no real tools yet.

### Tasks

- [x] Toolbox button on book left strip (assist cluster)
- [x] Tap → small menu listing the four v1 tools (placeholders OK)
- [x] Choosing a tool opens a **blank floating panel** with title + Close
- [x] Only **one** panel at a time
- [x] Escape closes menu first, then panel; Close returns to book; page does not jump
- [x] Active button state while menu or panel is open

### Files (expected)

- `lib/class-toolbox/types.ts` (tool ids + labels)
- `components/students/class-toolbox/*` (menu + panel + host)
- `BookWorkspaceLeftBar.tsx` + fullscreen book overlay view wiring

### Acceptance (you test)

- [ ] Open book mid-“class” → Toolbox → open any listed tool → see blank panel with title
- [ ] Close panel → book still usable on the same page
- [ ] Open another tool → previous panel is gone (one at a time)
- [ ] No real flip / roll / timer logic yet

### Non-goals

- Coin / dice / timer / stopwatch behavior
- Map entry, drag, sounds, Games page rebuild

---

## Phase 2 — Coin flip ✅

**Goal:** First useful tool in under a minute of teaching time.

### Tasks

- [x] Big heads/tails result in the floating panel
- [x] Tap to flip again
- [x] Light motion optional; keep readable on screen share

### Acceptance (you test)

- [ ] Flip several times; result readable from far with book still visible

### Non-goals

- Other tools’ real logic

---

## Phase 2b — Stage: coin over the book ✅

**Goal:** Dock holds Flip + result; the flip plays as spectacle on the book.

### Tasks

- [x] Product: dock vs stage for coin/dice; timers stay in-dock only
- [x] Shared stage portal (soft dim + block book taps while playing)
- [x] Coin dock bottom-right: result + Flip only (no in-dock coin)
- [x] ~1s two-face coin animation on stage; auto-flip on open
- [x] Stage z below dock so Flip stays clickable

### Files (expected)

- `lib/class-toolbox/coin-flip.ts`
- `components/students/class-toolbox/ClassToolboxStage.tsx`
- `ClassToolboxCoinFlip` / coin stage + host state lift
- `docs/CLASS_TOOLBOX_PRODUCT.md` dock/stage section

### Acceptance (you test)

- [ ] Open Coin flip → dock bottom-right; coin auto-flips over book with soft dim
- [ ] After settle, dim clears; dock shows Heads/Tails; Flip again works
- [ ] While flipping, book clicks do not draw / turn pages
- [ ] Close / Escape clears stage + dock; page did not jump

### Non-goals

- Dice behavior (Phase 3), sound, drag dock

---

## Phase 3 — Dice ✅

**Goal:** Same dock + stage pattern as coin; one six-sided die.

### Tasks

- [x] Big face / number 1–6 on stage
- [x] Dock: Roll + result; tap to roll again
- [x] Reuse the same stage shell as coin

### Acceptance (you test)

- [ ] Roll several times; clear 1–6 over the book; dock shows the number

### Non-goals

- Multiple dice, custom sides, Games route rewrite

---

## Phase 3b — Multi-dice (Google-style) ✅

**Goal:** Add multiple dice with d4–d20 sides; roll all together; show total.

### Tasks

- [x] Data model: bag of dice (max 6), per-die sides + value
- [x] Dock: side chips, total, value list, Roll; remove via × or stage tap
- [x] Stage: multiple dice; cartoon d6 images; colored tiles for other sides
- [x] Reset to one d6 on open; auto-roll once

### Acceptance (you test)

- [ ] Add d20 twice → three dice; Roll → total matches sum
- [ ] Tap die on stage or × in dock → removed
- [ ] At 6 dice, add chips disabled

### Non-goals

- Modifiers, 50+ dice, bag persistence across sessions

---

## Phase 4 — Countdown timer

**Goal:** Activity timer, not class timer.

### Tasks

- [x] Presets: 30s / 1 min / 2 min replaced by **custom MM:SS digit stepper** (up to 99:59)
- [x] Start / pause / reset; big digits
- [x] Clear “time’s up” state (visual; sound later)
- [x] Must not confuse with or replace the class clock (in-dock only; separate from session clock)

### Acceptance (you test)

- [ ] Run a 30s countdown with book open; end state obvious; class clock still separate

---

## Phase 5 — Stopwatch

**Goal:** Free timing for speaking / races.

### Tasks

- [x] Start / stop / reset
- [x] Same panel shell and digit style as countdown (big MM:SS + icon controls)

### Acceptance (you test)

- [ ] Start, stop, reset; readable on share

---

## Phase 6 — Polish pass (only after real class use)

**Goal:** Fix real friction after 1–2 classes.

Pick only what actually annoyed you, e.g.:

- [x] Drag the floating panel
- [ ] Remember last tool used
- [ ] Slightly bigger type for share
- [x] Soft beep on timer end

### Non-goals

- New tools in this phase

---

## Explicit non-goals (whole v1)

- New sidebar Toolbox page
- Full-screen mini apps that leave the book
- Several tools open at once
- Linking rolls/timers to coins, map, or student scores
- Replacing Timed Challenge or the class End-class clock
