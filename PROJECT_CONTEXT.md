# Project context — ESL Timed Challenge

**Purpose:** Stable product and teaching intent. Read alongside `MILESTONE.md` (what ships next) so planning and implementation stay aligned. Update this file when direction changes.

---

## Who this is for

- **Primary user:** You (the teacher)—improve quality and interactivity of **your own** lessons.
- **Class format:** **1:1 online only** (not a classroom product first).
- **How class runs (v1):** You stay on a call (**Voov** or **WeChat**), **share your screen**, the student **tells you what to do**; you operate the app. No expectation that each learner uses their own device in v1.

---

## Curriculum and experience model

### Three layers (keep them separate in design)

1. **Curriculum spine** — Where you are in the **book** (unit, lesson, page). This is the truth for “what we are teaching today.”
2. **Activity layer** — Short interactions: popup checks, vocab drills, sentence tasks, look-and-match, **timed challenge**, dice, etc. These attach to **moments** on the spine (e.g. after a vocab block, after a story chunk), not random wandering.
3. **Student context** — Performance and skills over time (vocab strength, phrases, recurring errors). This **tunes** difficulty, selection, and lesson prep—not “whether we use the book.”

### Book-first rules

- The **book is always central.** “Opening the book” must not feel like leaving the app; the book should stay **one click away** (tab, split view, or persistent entry)—not buried under unrelated navigation that confuses students on screen share.
- **You must always be able to browse the book however you want** (preview, skip ahead, jump pages). No game gate should block **teacher** navigation. If student-facing “quests” lock progress, that applies to **guided student session / map milestones**, not to your free reading of the PDF.

### Timed challenge and legacy quizzes

- **Not the main loop** anymore. They are **extras** or **one way to pass a section / checkpoint**—exact rules TBD.
- They remain valuable as **pressure / variety** after vocab or at checkpoints, not as a replacement for book flow.

### Map, coins, cosmetics, “RPG” framing

- **Map** = **adventure summary** of learning (journey / checkpoints), not a separate arcade menu.
- **Coins / diamonds / future currency** = rewards for **book-linked tasks** you actually complete (including you confirming completion on a call), not for random clicking.
- **Cosmetics, pets, weapons (visual), “beat a monster,” “final boss”** = **motivation and framing** (skin on the same tasks). Bosses = major checkpoint bundles dressed as fights—same curriculum, clearer drama.
- **When to show the map (default suggestion):** short moments at **class start** (where we are, collect rewards), optionally **after a major checkpoint**, **end of class** (loot, streak). **Mid-class:** mostly book + overlays so reading flow is not fragmented.

---

## Interactive book (core product vision)

The **book is not only a passive PDF** where supported: it becomes the **main interactive surface**—overlays, panels, and launches tied to **recognized regions** of the curriculum (vocab blocks, story/reading spans, grammar boxes, etc.). Exact detection can mix manual teacher markup, book map metadata, and later smarter layout understanding; the **intent** is lesson flow that stays visually anchored to the page.

### Vocab sections — per-word “deep study”

- Official **vocab spreads** in the book get a **special mode** (highlight zone, list of words, clear entry/exit so it still feels “on the book”).
- **Each word is openable** into a rich study experience, including (as available per word): **more examples**, **definition**, **synonyms**, **antonyms**, **video samples**, **audio** (model pronunciation / clips), **short practice** (tap, reorder, speak-if-we-add-it, etc.).
- Content can start **teacher- or AI-assisted** and be **edited per student** over time; the smart **vocabulary bank** (strong vs needs practice) should eventually reflect what happens in these interactions, not only separate quizzes.

### Reading / story sections — rhythm and checks

- Longer **reading passages** support **lightweight interruptions on a cadence** (e.g. every *n* pages or at teacher-placed anchors): pop-up comprehension, quick vocabulary in context, “why did the character…”, sentence-level tasks, look-and-match—**enough to stay engaging**, not so dense that flow dies. Density is a tuning knob per student and per lesson length.

### UX shape (open decision)

- Whether deep word study is a **step-through carousel**, a **side drawer** beside the page, or **one scrollable “word sheet”** is **undecided**—optimize for **1:1 screen share** (large type, obvious back-to-book, minimal disorientation). Prototype one path for v1; keep the data model rich enough that the shell can change.

---

## Student knowledge tracking (your spec)

### Smart vocabulary bank (per student)

- Track words with a clear sense of **strong** vs **needs more practice and exposure** (and room for intermediate states later).
- Use this to drive review, spiraling, and future activity generation—not only display.

### Phrases

- A dedicated area (alongside words) for **phrases** / chunks worth tracking the same way (exposure, strength, review).

### Sentence structure and recurring errors

- Many students share **similar mistakes** (e.g. *My parents like watch TV*).
- Store **named issues** (human-readable label + short description / example) so patterns recur across lessons and can be targeted in drills and in your prep.

### Other areas (TBD)

- Leave room to add domains later (e.g. listening habits, discourse, exam skills)—same idea: **named, attributable, actionable** rather than vague “level.”

---

## Lesson length and AI assistant (north star)

- **Class lengths you use:** 25, 30, 50, 55, and 60 minutes.
- **Goal:** An **AI assistant per student** that is aware of **level**, **pace**, **class length**, and accumulated **context** (vocab bank, phrases, named errors, book position, recent sessions) to produce a **lesson plan and pacing guide before each class**.
- **Design principles:** Plans are **drafts** you can adjust in ~60 seconds; pacing in **time bands** (e.g. 0–10 min, 10–25 min) is easier to follow live than minute-by-minute scripts; quality depends on **structured inputs** from the app, not chat alone.

---

## Success (evolving definition)

Success in a lesson is **not** only “random challenges completed.” It includes:

- Meaningful movement along the **book spine** with **interactive** moments at natural seams (vocab deep-dives, reading popups, checkpoints).
- **Student context** improving over time (vocab/phrases/errors visible and acted on).
- Optional: **motivation layer** (map, currency, cosmetics) reinforces book-linked work without replacing it.

Exact “success metrics” can evolve; update this section when you lock them.

---

## Related files

| File | Role |
|------|------|
| `MILESTONE.md` | **Phased roadmap** (0–6+), **current sprint** checklist, next-sprint preview, and notes—execution path to a teachable build. |
| `docs/PHASE0.md` | Operator checklist: run target, backup, one-student lesson-path try (Phase 0). |
| `PARKING_LOT.md` | Deferred polish and ideas (optional). |
| `.cursor/rules/milestone-first.mdc` | Agent behavior: milestone-first, anti-drift, parking-lot handoff. |

---

## Changelog

- **2026-05-03** — Phase 0 marked complete in `MILESTONE.md`; run target = `npm run dev`; bookmark rule (last viewed at end class); renamed “smoke test” → “lesson-path try” in docs.
- **2026-05-02** — Phase 0 tooling: `docs/PHASE0.md`, Settings backup/restore for `esl_*` localStorage (`lib/local-data-backup.ts`).
- **2026-05-02** — `MILESTONE.md` expanded: phased path to teachable app, Phase 0–1 sprint, Phase 2–3 task breakdown for interactive book.
- **2026-05-02** — Interactive book vision: vocab deep-dives, reading popups, UX shell TBD for screen share.
- **2026-05-02** — Removed the “Library” UI/naming idea from this doc; book stays primary, word work lives under normal vocab / activity flows (no separate library concept).
- **2026-05-02** — Initial consolidation from product discussions: 1:1 screen-share v1, book-first three-layer model, map/RPG as motivation spine, teacher book access, vocabulary bank + phrases + named sentence issues, variable class lengths + per-student AI prep vision.
