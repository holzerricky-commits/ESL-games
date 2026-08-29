# Lesson Hub, multi-book layout & teaching shell — product decisions

Last updated: 2026-06-08

**Status:** Agreed direction from design discussion. **Not current sprint** — build **after** Phase 2–3 lesson interactivity (vocab deep panels, reading popups) unless a minimal two-book workaround is needed to unblock live teaching.

**Related:** `PROJECT_CONTEXT.md` (book-first, map timing), `MILESTONE.md` (Phase 2–3), `LESSON_BOARD_PRODUCT.md` (dock/float/minimize for lesson board in reader), `DESIGN_SYSTEM.md` (dark storybook-night tokens), **`CLASSROOM_HOME_PRODUCT.md`** (near-term start/end screen — do not build a second welcome).

**UI names (teacher-facing):** Lesson Hub (landing between teaching blocks); **Workshop** / **Literature** (Wonders track names — map to assigned books in data).

---

## Why this doc exists

Captures decisions about:

1. Replacing the **dimmed forest map** behind the open book with a **calm static backdrop**
2. **Two-book curriculum** (e.g. Wonders Workshop + Literature) without stacking one PDF on another
3. **Lesson Hub** — folder-like landing, carousel lesson cards, class-start welcome
4. **What to build now vs later**

---

## Prioritization (locked)

| Priority | Work | Rationale |
|----------|------|-----------|
| **Now** | Use app for real classes on **book + lesson board + Classes flow** (Phase 1) | Milestone says teach-ready shell is done |
| **Next** | **Phase 2–3 interactivity** — vocab packs for units you teach, reading popup checks | Changes what happens **on screen share** during the lesson |
| **Later** | Full **Lesson Hub**, carousel, streak popup, achievements animation | Lobby/shell polish; does not replace on-page interactivity |
| **Much later** | Map/RPG layer, hub tied to full student memory bank | Phase 6+ in `MILESTONE.md` |

**Exception:** If switching between Workshop and Literature is blocking live classes **this week**, a **1–2 day** minimal fix only (assign both books, resume bookmarks, manual open) — **not** the full Hub.

### When the app is “ready for classes”

| Level | Meaning | Roughly |
|-------|---------|---------|
| **A — Teach today** | Dashboard → class → open book → ink + board → end class + bookmark | **Now** |
| **B — Beats PDF + external tools** | Interactive vocab on **your** Wonders sections + at least one Literature reading check | **Next few weeks** (Phase 2–3) |
| **C — Full vision** | Lesson Hub, smooth two-book UX, streak, checklist tied to unit, student memory on hub | **After B** |

---

## Background: map behind the book

### Decision

- **Do not** show the dimmed/blurred **challenge map** behind the open book during teaching.
- Use a **static full-screen backdrop** (dark “storybook night” — base `#0d1324`, soft blue `#72a8ff` / amber `#f4b37a` accents at low opacity).
- **Keep the map** as its own screen (Map tab, fullscreen map route, challenge path planning) — do not delete map work.

### Rationale

- Mid-class should be **book + overlays** (`PROJECT_CONTEXT.md`).
- Dimmed map implies game progress that is **not wired yet** (Phase 6+).
- Map warm-up, blur, and HUD layering compete with reader/interactivity work.
- Static backdrop is cheaper and clearer on screen share.

### Implementation note (when built)

- Full viewport `cover` image or CSS gradient behind fullscreen lesson shell.
- Center third especially smooth/low-detail (textbook spread sits there).
- See separate ChatGPT background brief (colors, safe zones, 16:9 / 3840×2160) if generating art.

---

## Curriculum spine: unit, not single book

For **Wonders-style** programs (Workshop + Literature):

- The **spine** is **unit/week** (e.g. Grade 3 · Unit 3), not one PDF.
- **Workshop** and **Literature** are **peer sources** — neither is permanently “main” with the other on top.
- **Do not** stack one book overlay on another (implies false hierarchy and hides “where we are”).

### Per-source state (each class session)

Every teaching source (Workshop, Literature, Lesson board, Slides later) is in exactly one **visibility state**:

| State | Meaning | Student sees |
|-------|---------|--------------|
| **Focus** | Main center spread | “We’re here now.” |
| **Dock** | Narrow live column left or right | Reference while another source is focused |
| **Park** | Hidden; icon on **source strip** with label + page | One tap to focus or dock |

- **Park** during class — not “close” (keep bookmark/place).
- **Rule:** At least **one** source must be **Focus** or **Dock** during active teaching, **or** show **Lesson Hub** intentionally.

### Layout caps (screen share)

- **Max one Focus book** (center spread).
- **Max one Dock book** (one side slot).
- Second book otherwise **Park** only, unless explicit **Split** preset (50/50 or 40/60) for short compare moments.
- **Lesson board:** reuse existing **dock / float / minimize tab** (`LESSON_BOARD_PRODUCT.md`) — dock opposite focused book when possible.

### Common Wonders flows

| Moment | Layout |
|--------|--------|
| Workshop vocab block | Workshop **Focus**, Literature **Park**, board **Dock** or **Park** |
| **Go to Literature** (one action) | Workshop **Park**, Literature **Focus** |
| Reference workshop while reading | Literature **Focus**, Workshop **Dock** |
| Class start / “what’s next?” | **Lesson Hub** (all sources parked or hub as home) |

### Data intent (when implemented)

Per student, per live class session:

- `workshop: { bookId, unitId, page }`
- `literature: { bookId, unitId, page }`
- Optional `unitLink` (e.g. `g3-u3`) for hub + future AI prep
- `lastFocusedSource`: `workshop` \| `literature` \| `board`

Lesson plan time bands can say “0–15 Workshop · 15–45 Literature” without picking a permanent “main” book.

---

## Viewport philosophy: not a full window OS

### Rejected for v1

- Every surface (including the book) as free **minimizable windows** with a desktop taskbar.

### Accepted model: **primary + panels + source switcher**

| Layer | Behavior |
|-------|----------|
| **Primary** | Usually one **focused book** or **fullscreen slides** while presenting |
| **Secondary** | Board, vocab shelf, translate — **dock / float / park** (extend lesson board pattern) |
| **Second book / slides** | **Swap**, **dock**, or **split preset** — not overlapping arbitrary windows |
| **Quick access** | Thin **source strip**: `Workshop · Literature · Board · ⌂ Hub` |

**Rationale:** 1:1 screen share — student needs **one obvious main view**, not window management. Full window manager is large scope vs Phase 2–3.

---

## Lesson Hub (landing area)

### What it is

- **Between teaching blocks** and at **class start** — not where you teach for 40 minutes.
- Combines: **materials folder**, **today’s checklist**, **student context** (review words, patterns to fix, last-lesson wins).
- Shown when sources are **parked** or teacher taps **⌂ Hub** from the reader strip.

### Layout (agreed direction)

```
┌────────────────────────────────────────────────────────────┐
│  Student · Unit 3 · Week 2                    🔥 streak    │
├────────────────────────────────────────────────────────────┤
│              ┌─────────────────────────────┐               │
│              │  TODAY'S LESSON (carousel)  │               │
│              │  title e.g. Vocabulary      │               │
│              │  Unit tag · progress e.g. 2/4 │               │
│              │  ☐ checklist rows           │               │
│              │  [ Start Workshop ]           │               │
│              └─────────────────────────────┘               │
│                    ‹  ● ○ ○ ○ ○  ›                         │
│   Workshop p.42    Literature p.18    Board (3 pages)      │
└────────────────────────────────────────────────────────────┘
```

### Carousel (middle card)

- **3–5 slides** per unit — teacher advances with **Next** (no auto-slide during class).
- Example slides: **Vocabulary** (Workshop checklist) → **Reading** (Literature) → **Words to use again** → **Phrases** → **Fix this pattern**.
- Dots or `2 / 5` under card.

**Example Vocabulary checklist (Workshop):**

- What was done last time (read-only / gray)
- Read words and sentences
- Look at pictures — identify main details
- Use 3–5 new words in a sentence
- Review

Optional on card or side column: **target words/phrases**, **achievements** (+N words last time), **review list**, **named error patterns** (e.g. *I want (to) eat ice cream*).

### Removed from mockup (agreed)

- **“Next lesson”** footer — scheduling stays on **Dashboard / Classes** tab.
- **Dock icons** on hub — materials are **chips/cards** on the hub, not dock metaphor.
- Persistent **“Welcome back”** left column — replaced by **class-start popup** (below).

### Class-start welcome popup

- **Once per started class** (not every return to hub mid-lesson).
- Content: welcome, **streak** (consecutive **completed** classes in a row), optional +N words last lesson.
- **Let’s go** → dismiss → hub on first carousel slide (usually Vocabulary).
- Small streak badge may remain in top bar after dismiss.

### Celebrations (stars, “words mastered”)

- **Hub and welcome popup only** — short (2–3 s), respect `prefers-reduced-motion`.
- **Not** over the open book during reading.
- Trigger examples: welcome popup; landing on “words to review” slide; checking off “Review” on checklist.

### Visual style note

- Early GPT mockups used **light pastel / garden** aesthetic.
- Live app default is **dark storybook-night** (`DESIGN_SYSTEM.md`). Hub art must **match teaching shell** or consciously define a student-facing skin — one coherent look for screen share.

---

## Hub → open book (transitions)

**Replace** hub view with reader — **do not** overlay book on hub.

| Trigger | Result |
|---------|--------|
| **[ Start Workshop ]** (or Literature) on active card | Open that book at saved page; hub slides away / crossfade |
| **Checklist row** tap (v1+ optional) | Open implied source (Workshop/Literature) at relevant section |
| **Material chip** tap | Open that source at saved page |
| **Go to Literature** | Park Workshop, Focus Literature (one step) |
| **⌂ Hub** from reader strip | Return to hub; preserve carousel index + checklist checks |

Reader keeps thin **source strip** + **⌂ Hub** while teaching.

---

## Relation to existing features

| Feature | Relationship |
|---------|----------------|
| **Lesson board** | Dock/float/minimize in **reader**; “Board” card on hub. See `LESSON_BOARD_PRODUCT.md`. |
| **Fullscreen map route** | Map + book today; long term map at **class start/end**, not mid-class backdrop. |
| **Classes tab** | Schedule, start class, spotlight, bookmarks — hub does **not** replace scheduling UI. |
| **Interactive vocab** | Phase 2 — build packs **before** hub; hub checklist can **link** to vocab moments later. |
| **Reading checks** | Phase 3 — same priority as vocab expansion. |
| **`assignedBookIds`** | Already supports multiple books per student — hub/layout is UI on top. |

---

## Build order (when this track starts)

1. Static lesson **backdrop** (replace dimmed map behind book) — small, unblocks calmer reader shell.
2. **Phase 2–3 interactivity** for real units (vocab packs, one reading check) — **before** full hub.
3. Minimal **two-book swap** if needed (strip or library jump) — days, not weeks.
4. **Lesson Hub v1:** one carousel card (Vocabulary) + material chips + **Start Workshop** transition.
5. Carousel slides + checklist persistence per class session.
6. Welcome popup + streak.
7. Hub columns: review words, phrases, error patterns (manual → later from student bank).
8. Full Focus/Dock/Park layout engine + split preset.

---

## Open questions (resolve in implementation)

- Exact **wide split** ratio when comparing two book spreads.
- Checkbox row → **auto-open page** vs button-only in v1.
- Hub on **student-facing** route vs teacher-only fullscreen lesson entry.
- **Streak** definition edge cases (cancelled class, same-day multiple sessions).
- Wonders **unit link** metadata: manual per student vs book-map derived.
- Light student skin vs dark teacher shell — single theme or dual.

---

## Explicit non-goals (this track, until revisited)

- Full desktop **window manager** (resize, z-order, arbitrary overlap).
- **Map as mid-class background** behind book.
- **Student devices** / sync / student-operated hub.
- **AI-generated** full lesson checklist before structured fields exist (Phase 5).
- Replacing **Classes** scheduling with hub “next lesson” UI.

---

## Success criteria (when shipped)

1. Teacher can run Wonders flow: Workshop block → **one tap** to Literature without stacked PDFs.
2. Student on screen share always sees **one clear main surface** or an intentional **hub** — never empty desktop.
3. Hub carousel + checklist support a **real unit** without requiring map/RPG.
4. Class-start welcome + streak appear **once** per session; do not block teaching.
5. Interactivity (vocab panel, reading check) works **before** hub is required for daily teaching.
