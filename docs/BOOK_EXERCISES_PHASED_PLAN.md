# Book exercises — phased implementation plan

Last updated: 2026-08-17

**Product source of truth:** `BOOK_EXERCISES_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, then start the next.

**Baseline before Phase 1:** Fullscreen book reader exists (spread + left strip). Audio pins and reading-check pins already sit on pages. No exercise boxes.

---

## Phase 0 — Documentation

| Item | Status |
|------|--------|
| `BOOK_EXERCISES_PRODUCT.md` | Done |
| `BOOK_EXERCISES_PHASED_PLAN.md` | Done |
| Cross-links in `MILESTONE.md`, `PROJECT_CONTEXT.md` | Done with this pass |

**Your test:** Read both docs; confirm they match the locked decisions before Phase 1 code.

---

## Phase 1 — Box the task ✅ (this slice)

**Goal:** You can draw a box around one exercise on the open book. It is saved. You see it in a list and as a pin on that page. Empty inside.

### Tasks

- [x] Data: book-level task (page + box on the page + label). Always word-bank, always draft, no quiz content yet.
- [x] Persist with the book (reload / leave / come back still shows it).
- [x] Open book: left-strip **Exercises** list + **Box a task**.
- [x] Draw on one page; save; show the box + a pin.
- [x] Delete from the list or the pin.

### Acceptance (you test)

- [ ] Open Compact Key (Prepare or class), box one exercise, close the book, open it again — box and pin still there.
- [ ] List shows the task; you can jump to that page and delete it.

### Non-goals

- Word bank / gaps / answers, Gemini, Check, other types, drag-and-drop, Books Advanced tab.

---

## Phase 2 — Type one quiz by hand ✅

**Goal:** Fill the boxed task: word bank, sentences with gaps, which word goes where. **Approved** vs **draft**. Draft must not appear as a live class activity later.

### Tasks

- [x] Word bank + sentences with `___` + answer from the bank
- [x] Save draft; **Approve** only when complete
- [x] Editing an approved task returns it to draft
- [x] Live-eligible helper: approved + complete only (for Phase 3)

### Acceptance (you test)

- [ ] Open a boxed Compact Key task, type the bank and 2–3 sentences, pick answers, Approve
- [ ] Close and reopen: content still there, list says approved
- [ ] Back to draft works; incomplete tasks cannot Approve

### Non-goals

- Gemini, live Check sheet.

---

## Phase 3 — Play it (the real V1) ✅

**Goal:** Tap pin → focused sheet → tap blank, tap word → **Check** → green/red → close. Page turns stay free.

**Gate:** Does this feel like BlinkLearning on a shared screen? If no, change the player — not the AI.

### Tasks

- [x] Approved pin (Exercises list closed) opens the Check sheet
- [x] Draft pin still opens the editor
- [x] Tap a gap, tap a word (or tap a word to fill the next gap); tap a filled gap to put the word back
- [x] Check → green/red per gap; chime / buzz; Try again
- [x] Close (X, backdrop, Escape) leaves you on the book

### Acceptance (you test)

- [ ] Open Compact Key with a student, tap an **approved** purple pin (list closed) → fill from the word bank → Check → green/red → close → still on the book
- [ ] Draft pins still open the editor, not Check
- [ ] With the Exercises list open, tapping a pin still edits

### Non-goals

- Gemini, scores saved, show answers, extra types

---

## Phase 4 — Gemini draft from the box ✅

**Goal:** Same box → picture of **only that crop** → draft bank + gaps. Always **draft**. You fix, then approve. Type stays word-bank.

### Tasks

- [x] Picture of only the boxed task (not the whole page)
- [x] Gemini fills word bank + gapped sentences as **draft**
- [x] Type stays word-bank (Gemini does not pick another type)
- [x] You still Approve before it can play in class

### Acceptance (you test)

- [ ] Box one Compact Key complete-the-gap exercise → open it → **Draft from box** → bank and sentences appear
- [ ] Fix anything wrong, Approve, then Check still works
- [ ] A crop that is not a word-bank task does not pretend to be ready

### Non-goals

- Other exercise types, whole-unit scan, auto-approve

---

## Phase 5 — Class polish ✅

**Goal:** After Check, you can **Show answers**. Extra unused bank words and two gaps in one sentence are first-class.

### Tasks

- [x] Show answers after a wrong Check (fills the keyed words; Try again still resets)
- [x] Extra unused bank words stay visible after Check (marked extra)
- [x] Two gaps in one sentence already play and now have an explicit test

### Acceptance (you test)

- [ ] Check with a wrong gap → **Show answers** fills the right words → Try again clears
- [ ] A bank with one leftover word shows **extra** after Check
- [ ] A sentence with two `___` plays as two tappable gaps

### Still not this track

Drag-and-drop, type-in, open-ended auto-mark, whole-unit scan, new browser tabs, timed challenge / map rewards.

---

## Choose the correct answer

Word-bank Phases 1–5 stay shipped. This type reuses the same box / pin / draft / Approve / Check loop. Test after each phase before starting the next.

### Phase 1 — Box as choose-answer (this slice)

**Goal:** Pick **Word bank** or **Choose answer**, then box. Choose-answer saves empty. Word-bank boxing still works.

#### Tasks

- [x] Type is `word_bank` or `multiple_choice`. Old saved tasks with no type stay word-bank.
- [x] Exercises list: type toggle, then **Box a task**. Pin + list remember the type.
- [x] Choose-answer opens an empty shell (label + type). No questions, Approve, Check, or Draft from box yet.
- [x] Word-bank editor, Draft from box, and Check stay as they are.

#### Acceptance (you test)

- [ ] Box one Compact Key multiple-choice blob as Choose answer; close and reopen — pin and list still say choose-answer and stay empty.
- [ ] Box a word-bank task the old way — it still drafts and Checks.

#### Non-goals

Questions, choices, Approve, Check sheet, Gemini for this type, merging with reading checks.

### Phase 2 — Type questions by hand ✅

**Goal:** Fill the boxed choose-answer task: questions, 2–4 choices, one correct. **Approved** vs **draft**. Draft must not appear as a live class activity.

#### Tasks

- [x] Question editor: prompt, 2–4 choices, one correct (radio)
- [x] Save draft; **Approve** only when every question is complete
- [x] Editing an approved task returns it to draft
- [x] Approved choose-answer still waits for Phase 3 Check (not live yet)

#### Acceptance (you test)

- [ ] Open a boxed choose-answer task, type 2–3 questions with choices, pick the correct answer, Approve
- [ ] Close and reopen: content still there, list says approved
- [ ] Back to draft works; incomplete tasks cannot Approve
- [ ] Tapping the pin in class still opens the editor, not Check

#### Non-goals

- Live Check sheet, Gemini draft from box, Show answers

### Phase 3 — Play it ✅

**Goal:** Tap an approved choose-answer pin → Check sheet → tap one choice per question → green/red → close. Page turns stay free.

#### Tasks

- [x] Approved pin (Exercises list closed) opens the Check sheet
- [x] Draft pin still opens the editor
- [x] Tap one choice per question, then **Check** → green/red
- [x] Try again; close (X, backdrop, Escape) leaves you on the book

#### Acceptance (you test)

- [ ] Open Compact Key with a student, tap an **approved** choose-answer pin (list closed) → pick choices → Check → green/red → close → still on the book
- [ ] Draft pins still open the editor, not Check
- [ ] With the Exercises list open, tapping a pin still edits

#### Non-goals

- Show answers, Gemini draft from box

### Phase 4 — Draft from box ✅

**Goal:** Crop → Gemini fills **this type only**. Always draft. You Approve. Gemini still does not pick the type.

#### Tasks

- [x] Picture of only the boxed task (not the whole page)
- [x] Gemini fills choose-answer questions + choices as **draft**
- [x] Type stays choose-answer (Gemini does not pick another type)
- [x] You still Approve before it can play in class

#### Acceptance (you test)

- [ ] Box one Compact Key multiple-choice exercise → open it → **Draft from box** → questions and choices appear
- [ ] Fix anything wrong, Approve, then Check still works
- [ ] A crop that is not a choose-answer task does not pretend to be ready

#### Non-goals

- Show answers, whole-unit scan, auto-approve

### Phase 5 — Show answers ✅

**Goal:** After a wrong Check, Show answers (same as word-bank).

#### Tasks

- [x] Show answers after a wrong Check (fills the correct choices; Try again still resets)
- [x] Status line switches to **Answers shown**

#### Acceptance (you test)

- [ ] Check with a wrong choice → **Show answers** highlights the right options → Try again clears
- [ ] All-correct Check never needs Show answers

#### Non-goals

- Whole-unit scan, scores saved elsewhere
