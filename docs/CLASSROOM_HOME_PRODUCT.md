# Classroom home — product decisions (locked)

Last updated: 2026-08-19

**Status:** Agreed direction from the teacher plan (`tuto_classroom_home_plan_for_cursor.docx`). Implementation phases live in **`CLASSROOM_HOME_PHASED_PLAN.md`**. Do not start code until that plan’s current phase is the active ship track.

**UI names (teacher-facing):** Classroom home · Welcome · Class · Review

Teacher prep is **Today’s class** (`CLASS_PREP_DESK_PRODUCT.md`) — not this yellow screen.

**Source plan:** Turn the current book-selection screen into Tuto’s classroom home. It should feel like the beginning and end of a real lesson, not simply a PDF launcher.

**Related:** `PROJECT_CONTEXT.md` (book-first, class start/end moments), `MILESTONE.md`, `LESSON_HUB_AND_MULTI_BOOK_PRODUCT.md` (later multi-book lobby — not this screen), `READING_CHECKS_PRODUCT.md` (today’s wrap already shows check counts).

---

## Why

Today the start/end screen is a warm book picker with a greeting. That is the right *place*. It is not yet a *classroom*.

The student on screen share should immediately know: **what we are doing today**, **which book to open**, and **after class, what we just did**.

---

## Who this screen is for

- **You (the teacher)** operating the app on a call while screen-sharing.
- The student **sees** Welcome and Review. They do not operate the app in v1.
- **Prepare** opens **Today’s class** (teacher sheet), not this stage. Optional later Preview is this same Welcome, read-only.
- Not a learner-owned dashboard. Not a dense analytics page.

---

## Three states, one home

| State | Student-facing job | When |
|-------|--------------------|------|
| **Welcome** | Let’s begin. | After Start class / Enter / auto-start. Preview from Today’s class (later) is the same screen, read-only. |
| **Class** | Let’s teach. | Book / board open. Mid-class book shelf stays a picker, not a second product. |
| **Review** | Look what we accomplished. | After you confirm End class, before Done returns you to the roster. |

Prep is **not** a yellow state. Editing today’s lines and notes lives on **Today’s class**.

All three share the **same visual language** (warm yellow world, book covers, Tuto’s friendly identity). Class itself stays out of the way once the book is open.

Do **not** rebuild the book viewer as part of this track.

---

## Preserve what already works

- Warm yellow background and friendly atmosphere. Better for children than the dark textbook world.
- Book covers as the main entry into teaching materials.
- Clean, uncluttered layout.
- Existing open-book behavior (today’s book hint, last page, shortcuts).
- Existing first-class vs welcome-back greeting.
- Existing Review goodbye + reading-check counts (when any were marked).
- Existing teacher recap note after class.

---

## Locked defaults (v1)

| Decision | Choice |
|----------|--------|
| Mental model | One **classroom home**, three states: Prep → Class → Review |
| Visual identity | Keep the **warm yellow** start/end world. Do not replace it with the dark teaching shell or a SaaS dashboard. |
| Main action | Open / Continue the relevant book |
| Information density | Compact. Content and actions beat decoration. |
| Greeting | Personal, short, **secondary** to today’s lesson |
| Progress | Lightweight continuity (“last time”, streak, a few review words) — never a wall of stats |
| Honesty | Only show numbers and “you learned X” when the app actually knows. Prefer hide over invent. |
| Age | One product. Younger students: simpler words + optional icons. Older: tighter copy. Not two apps. |
| Lesson Hub | **Not this track.** Hub / carousel / Focus-Dock-Park stays deferred. This home is the near-term start/end screen. |

---

## Welcome — student stage

**Hierarchy** (top to bottom):

1. Welcome / context (student-centered greeting — never the word “Prep”)
2. Today’s lesson
3. What we will learn
4. Continue / open the relevant book
5. Other available books
6. Lightweight progress and continuity (Last time · streak)

The student should immediately understand **what today’s class is about** and why they are here.

### Greeting and dynamic messages

Replace giant **Prep** as the primary visual with a student-centered greeting. The shared title is **Welcome** / **Welcome back** (or a later seasonal/milestone line). Never put “Prep” in that title.

Examples (keep short):

- Normal: “Welcome back, Ella! Ready for another English adventure?”
- Birthday: “Happy Birthday, Ella!”
- Chinese New Year / Christmas / other relevant holidays: a short tasteful seasonal line
- After a long break: “Welcome back! Let’s see what you remember!”
- Milestone: “You’ve learned 100 new words with Tuto!” — **only if word history is real**

Other positive moments can come from actual learning history later.

Messages stay **secondary** to the lesson information. Alive, not the main attraction. Do not make every contextual message visually loud.

### Today’s lesson / learning goals

A compact block of what this class is for. Glanceable. **You edit it on Today’s class**, not here. This screen only shows filled lines.

Suggested lines (hide any that are empty):

- Vocabulary — e.g. 8 new food words
- Grammar — e.g. I like / I don’t like
- Speaking — e.g. talk about favourite food
- Listening — e.g. understand a short conversation

Younger students: simpler wording and optional icons.

Prefer filling this from **prep you already save** for the class (priorities / notes / words to revisit). Do not invent a second prep system if those fields can drive the card.

### Book cards and Continue

Make covers more useful without stuffing them with chrome.

- Cover, title, current unit/lesson, last opened page
- Clear **Continue** / **Open**
- If there is an obvious current lesson, put a **Continue lesson** card above the general library

### Continuity from the previous class

Welcome should remember the last class.

- Small **Last time** line — e.g. recap note, or “You practiced these words”
- 1–3 items that need review (words that still need practice), if any exist
- Use that to introduce today naturally
- Do not overwhelm with analytics

Goal: every class feels like part of a journey, not an isolated session.

### Class streak

A tasteful attendance habit — **completed classes in a row**, not app logins.

- Small rewarding chip, e.g. 7 classes in a row
- Celebrate milestones without turning Tuto into a game
- **Never shame** when a streak breaks
- Gentle copy such as “Keep your streak going!” only when the streak is alive
- Also show on Review so finishing class feels meaningful

---

## Review — End class state

After End class, return to the **same** classroom home, transformed into a concise recap.

**Student-facing hierarchy:**

1. “Great work, Ella!”
2. Today’s class — duration / book / lesson
3. You learned — new vocabulary and concepts (only if known)
4. You practiced — speaking, grammar, listening, etc. (from today’s goals if set)
5. Your answers — e.g. reading-check and exercise scores **when any happened**
6. Words to review
7. Small progress / streak celebration

Feel like an achievement summary, not a corporate report.

**Teacher-facing extra (same underlying facts, more detail):**

- Class duration
- Activities completed
- Correct answers
- New vocabulary
- Vocabulary needing review
- Areas of strength / needing practice
- Teacher notes (existing recap / session log)

Student and teacher can share the same data. The teacher sees more. Private teacher pages stay teacher-only; the shared Review is what the student sees on screen share.

Existing reading-check wrap counts stay. Expand them into this recap — do not replace the ceremony with a different world.

---

## Class (during the lesson)

Once a book is open: **get out of the way**.

- Book / board / split workspace with the usual thin classroom controls
- Mid-class book shelf is for switching materials, not a second home redesign
- Do not hang celebrations, streak popups, or recap chrome over the open book

---

## Visual and UX principles

- Warm, friendly, premium — not childish, not corporate
- Comfortable scale; avoid oversized controls
- Use whitespace on purpose, but reduce the current empty-stage feeling
- Prioritize content and actions over decoration
- Same type, spacing, radii, icons, and interaction language as the rest of Tuto
- When books are present, the **book remains the strongest visual**
- Avoid excessive cards, badges, gradients, animations, or gamification
- Animations: subtle and purposeful; respect reduced motion

---

## Age considerations

| Ages | Tone |
|------|------|
| **5–8** | Simpler wording, stronger visual cues, fewer competing elements |
| **9–14** | More compact information, less decorative UI |
| **Teacher** | More controls and detail than the student-facing view |

One product; adapt density and language. Do not fork into two designs.

---

## What NOT to do

- Do not use this screen as the teaching-prep desk (that is Today’s class)
- Do not put scan / generate / approve here
- Do not turn Welcome into a generic SaaS dashboard
- Do not cover the screen with analytics
- Do not make the greeting larger than the actual lesson information
- Do not add gamification everywhere
- Do not replace the warm identity with a cold corporate interface
- Do not redesign the book viewer as part of this task
- Do not make every contextual message visually loud
- Do not invent progress (“8 new words”, “100 words learned”) the app did not record
- Do not build Lesson Hub, map-behind-book, or RPG loot on this screen
- Do not shame a broken streak

---

## Definition of success

- A student immediately knows what today’s class is about
- A student can open the correct book/lesson without searching
- The teacher sees a useful starting point rather than an empty launcher
- The screen feels personal without becoming distracting
- The student sees tangible evidence of progress from previous classes (when we have it)
- Completing a class feels rewarding through Review
- Welcome, Class, and Review feel like one coherent Tuto experience
- The implementation feels like an evolution of the existing product, not a disconnected redesign

**Design direction in one sentence:** Make Tuto feel like a personal classroom: the yellow screen tells the student what they are about to learn, during class it gets out of the way, and after class it shows them what they achieved. Teacher prep is a separate desk.

---

## Relationship to other tracks

| Track | Relationship |
|-------|----------------|
| **Current welcome / wrap screen** | This *is* that screen, grown up. Evolve it; do not replace the route. |
| **Lesson Hub** | Later, larger lobby (carousel, two-book Focus/Dock/Park). Do not build a second welcome popup. If Hub ships later, it should reuse this home’s greeting / streak / last-time — not fork them. |
| **Student home** | Roster and teacher page per kid. Classroom home is the **live lesson** stage (Welcome / Wrap), not the roster. |
| **Today’s class** | Prepare destination — teacher sheet, clock off. Not this yellow screen. |
| **Reading checks / book exercises** | Feed honest “your answers” into Review. Do not merge those products into this screen. |
| **Student knowledge (vocab bank)** | Unlocks richer “you learned / words to review.” Until then, Last time can use recap notes + the thin word-review list. |
| **AI lesson prep** | Can later draft today’s goals. v1 goals are teacher-typed or pulled from saved prep. |

---

## Changelog

- **2026-08-19** — Split: yellow home is Welcome / Wrap. Teacher desk is Today’s class (`CLASS_PREP_DESK_PRODUCT.md`).
- **2026-08-19** — End-class Review recap on the yellow home (Phase 4). Compact scores; no teacher notes on the shared goodbye.
- **2026-08-19** — Locked from classroom-home plan: Prep → Class → Review on the existing warm start/end screen.
