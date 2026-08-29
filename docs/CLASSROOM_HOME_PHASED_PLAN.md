# Classroom home — phased implementation plan

Last updated: 2026-08-19

**Product source of truth:** `CLASSROOM_HOME_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next. Do not skip phases unless a prerequisite is already done and checked.

**Build order (locked):**

```text
0 docs → 1 Prep hierarchy + book cards → 2 Today’s lesson / goals
     → 3 Last time + streak → 4 Review recap → 5 contextual greetings → 6 polish
```

Do **not** start Phase 1 code until this is the **active ship track** (you say so). Book exercises and other in-progress tracks stay first unless you switch.

**Later split:** Tapping **Prepare** now opens **Today’s class** (`CLASS_PREP_DESK_PRODUCT.md`), not yellow-as-desk. This plan’s Phases 1–4 (hierarchy, goals, last time, Review) stay done on Welcome / Wrap. Teacher editing on yellow is superseded.

Do **not** start Phase 3 until Prep already shows today’s lesson without hunting. Do **not** start Phase 5 until Review feels like the same home as Prep.

---

## Current codebase baseline (pre–Phase 1)

What already exists — **reuse this, don’t rebuild:**

- One start/end screen with four tones: **Prep** (teacher, giant “Prep”), **Welcome** (live class greeting + name), **Pick** (mid-class shelf), **Wrap** (Great work + reading-check counts + Done).
- Warm yellow world, book covers, today’s-plan hint, last-page line, open shortcuts.
- First-class vs welcome-back greeting (student setting).
- End class → wrap ceremony; hard auto-end still skips wrap.
- Teacher recap note + longer session log on the class.
- Saved class prep fields (priorities, notes, words to revisit, and related lists).
- Thin per-student word-review list (strong / needs practice) — not a full vocab bank yet.
- Reading-check wrap counts when any were marked this class.

What is **missing** (this track adds, in order):

- Classroom-home information hierarchy (today’s lesson, goals, Continue, last time)
- Attendance streak
- Review as a real recap (not only check counts)
- Birthday / holiday / long-break / milestone greetings

---

## Phase 0 — Documentation ✅

| Item | Status |
|------|--------|
| `CLASSROOM_HOME_PRODUCT.md` | Done |
| `CLASSROOM_HOME_PHASED_PLAN.md` | Done |
| Cross-links in `MILESTONE.md`, `PROJECT_CONTEXT.md` | Done with this pass |

**Your test:** Read both docs. Confirm: keep the yellow world; evolve the existing start/end screen; no Lesson Hub; no fake stats.

### Non-goals

- No code in this phase.

---

## Phase 1 — Prep hierarchy and book cards ✅

**Goal:** The start screen already feels like a classroom home using **data you already have**. No new streak, no new goals editor, no new greetings.

### Tasks

- [x] Shrink giant **Prep**. Student-centered greeting is the header (Welcome / Welcome back + first name). No “Prep” in the title.
- [x] Same layout language for Prep and live Welcome (one home, two tones).
- [x] Book cards: cover + title + unit/lesson + last page + clear **Continue** / **Open**.
- [x] If one book is today’s plan, lead with that **Continue lesson** card; other books sit below.
- [x] Reduce empty-stage feeling without adding decorative cards.
- [x] Leave Pick (mid-class shelf) mostly as-is — only match card chrome if it comes for free.
- [x] Do not change open-book behavior or the reader.

### Acceptance (you test)

- [ ] Prepare a class: you see the student’s name and books you can open without hunting. No “Prep” in the title.
- [ ] Start class: same home, welcome greeting, today’s book is obvious.
- [ ] Two assigned books: today’s book is first; the other is still one tap.
- [ ] Last page / unit line is visible on the card when known.
- [ ] Exit still works. Opening a book still goes to the saved place.

### Non-goals

- Learning-goals block, Last time, streak, Review redesign, holidays, birthday field.

**After you test:** If this feels like a classroom home, say so and we start Phase 2 (today’s lesson / goals). If something is wrong, we fix this first.

---

## Phase 2 — Today’s lesson / learning goals ✅

**Goal:** Compact “what we will learn today” on Prep and Welcome. Teacher-editable. Empty lines stay hidden.

### Tasks

- [x] Show a **Today’s lesson** block: short title/context (book · unit · lesson you already know) plus optional goal lines (vocab / grammar / speaking / listening).
- [x] Prefer **existing saved prep** for this class (priorities, notes, words to revisit). Add a small editor only if those fields cannot drive a glanceable card.
- [x] Hide any category with nothing in it. No placeholder lorem.
- [x] Younger-friendly wording is fine; optional icons only if they stay quiet.
- [x] Mid-class Pick shelf does **not** need the full goals block.

### Acceptance (you test)

- [ ] Prepare a class: Add / Edit today’s lines (vocab / grammar / speaking / listening). They show under the greeting.
- [ ] Start class: the same lines appear; no Edit button on the student-facing welcome.
- [ ] Empty goals: no fake section on live welcome; books still dominate. Prep still offers Add.
- [ ] Saved priorities / review words appear if you haven’t typed categorized lines yet.
- [ ] Opening the book still one tap from Continue.

### Non-goals

- AI-generated goals, full checklist, Lesson Hub carousel, Review changes.

**After you test:** If today’s lesson is clear at a glance, we start Phase 3 (last time + streak). If something is wrong, we fix this first.

---

## Phase 3 — Last time + class streak ✅

**Goal:** Light continuity. Honest data only.

### Tasks

- [x] **Last time:** previous completed class recap note, and/or 1–3 needs-practice words from the existing word-review list. Cap at three items.
- [x] If there is no previous class / no recap / no review words, hide the section.
- [x] **Streak:** count consecutive **completed** classes (not logins, not cancelled, not missed). Show a small chip on Prep, Welcome, and later Review.
- [x] Broken streak: no guilt copy, no “you lost it.” Just omit or show a calm “Ready for class.”
- [x] Optional gentle “Keep your streak going!” only while a streak is alive.
- [x] Do not invent “You learned 8 new words” unless a real count exists for that class.

### Acceptance (you test)

- [ ] After one completed class with a recap, next Prep shows a Last time line.
- [ ] Two or more completed classes in a row → streak chip. Skip/miss a class → chip disappears, no shaming.
- [ ] Student with no history: home still looks complete (goals + books), not broken.
- [ ] End class: if the streak is 2+, the chip appears on the goodbye screen too.

### Non-goals

- Full vocab bank, coins, map loot, Review layout (chip only is enough until Phase 4).

**After you test:** If last time and streak feel kind and true, we start Phase 4 (end-class recap). If something is wrong, we fix this first.

---

## Phase 4 — Review (End class recap) ✅

**Goal:** End class returns to the **same** home, now a short achievement summary.

### Tasks

- [x] Keep “Great work, {name}” and Done → roster.
- [x] Add what we know: duration, book/lesson, today’s goals as “you practiced,” reading-check (and later exercise) scores **when any happened**, words to review, streak chip.
- [x] Reading-check counts stay; they become one row in the recap, not the whole screen.
- [x] Teacher extra detail can stay on Past classes / recap note — do not dump teacher-only fields on the shared Review.
- [x] Hard auto-end may still skip the ceremony (same as today) unless you later decide otherwise.
- [x] Empty Review (no checks, no goals): still a warm goodbye + streak if any + Done. Never a blank dashboard.

### Acceptance (you test)

- [ ] End a class that had reading checks: goodbye + compact scores + Done, still yellow home.
- [ ] End a class with no checks but with goals: “you practiced” those lines; no fake 8/10.
- [ ] End a class with nothing extra: still feels like a closing, not an error.
- [ ] Recap note you type at end still saves on the class for next time’s Last time.

### Non-goals

- New analytics engine, strength/weakness AI, redesign of the book viewer, Lesson Hub.

**After you test:** If the goodbye feels like the same classroom, we can later add holiday/birthday greetings (Phase 5) — or stop here and teach with it. Phase 6 polish waits until after a real class.

---

## Phase 5 — Contextual greetings

**Goal:** Occasional living messages. Always smaller than today’s lesson.

### Tasks

- [ ] Birthday: only after an optional birthday exists on the student. Add that field in Settings if you want this line.
- [ ] Holidays: short tasteful lines for dates you actually teach around (e.g. Christmas, Chinese New Year). Hard-coded calendar is enough; no content CMS.
- [ ] Long break: if last completed class was a long gap (pick a simple rule, e.g. 3+ weeks), use the “let’s see what you remember” line.
- [ ] Milestone: “100 words” only if the word-review list can honestly support it.
- [ ] One message at a time. Priority: birthday → holiday → milestone → long break → default welcome.
- [ ] Never larger or louder than Today’s lesson / Continue.

### Acceptance (you test)

- [ ] Normal day: default welcome, lesson info still wins.
- [ ] Birthday set to today: birthday line, still not bigger than the lesson.
- [ ] Long gap between classes: long-break line once, then back to normal.

### Non-goals

- Animated mascots, daily random quotes, push notifications.

---

## Phase 6 — Polish (only after real class use)

**Goal:** Age density, empty states, transitions. Only after you have taught with Phases 1–4.

### Tasks

- [ ] Tighten empty states (no book, first class, no last time).
- [ ] Subtle Prep ↔ Welcome ↔ Review transitions; respect reduced motion.
- [ ] Optional slightly simpler copy when you mark a student as younger — only if you already have a place for age; otherwise skip.
- [ ] Teacher vs student density: edit lives on Today’s class; live Welcome/Review stay student-facing.

### Acceptance (you test)

- [ ] One real 25–60 min class: start home → teach → Review feels like one product.
- [ ] Nothing new fights the book once class is underway.

### Non-goals

- Visual identity rewrite, Hub, map, RPG.

---

## Honest-data rules (all phases)

Show a fact only if one of these is true:

- You typed it (prep, recap, goals)
- The class session recorded it (times, bookmark, reading-check / exercise marks)
- The student’s word-review list contains it

If not, **hide**. Do not pad with zeros or marketing copy.

---

## Explicit non-goals (whole track)

- Lesson Hub carousel, Focus/Dock/Park, map-behind-book
- Student-owned device / student tapping the home
- Full vocabulary bank / AI lesson generator (those are later milestone rows; this home may *display* them when they exist)
- Redesigning the book reader
- Shame, guilt, or “you broke your streak” UI
