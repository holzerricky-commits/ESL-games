# Lesson-aware reading checks — phased plan

Last updated: 2026-08-05

**Product intent:** Checks should practice **this lesson’s skill** (cause & effect, predictions, etc.), not only plot recall. Use **lesson frame** + later **Stop and Check** as fuel — same pattern as story text.

**Scope first:** Journeys (one book). Wonders Workshop↔Literature link later.

**Prerequisite:** Reading checks Phases 0–7 + beat/density drafting.

---

## Architecture

| Fuel | Job |
|------|-----|
| Outline | Part types + page ranges |
| **Lesson frame** | Skill, strategy, EQ, target vocab |
| Story text | Prose + page markers |
| **Stop and Check** | Publisher pause questions (harvest + Generate anchors) |
| Check pack | Draft → approved |

---

## Phase 9a — Lesson frame fuel ✅ (this slice)

**Goal:** Scan opener / comprehension / vocab pages; save editable frame; soft-warn on Generate if missing.

### Done

- [x] `LessonFrameRecord` + store under `data/lesson-frames/`
- [x] Resolve scan pages from outline tags (`comprehension`, vocab, …)
- [x] PDF-backed scan API `POST /api/reading-lessons/frame` (`plan` / `scan` / `save` / `mark-ready`)
- [x] Stories desk **Frame** row (outline-linked stories only)
- [x] Generate soft confirm when frame not ready (does not block)

### Your test

- [ ] Open a Journeys story with a lesson → **Scan frame** → see skill / EQ / vocab
- [ ] Edit → **Mark ready**
- [ ] Generate without ready frame → confirm dialog, still generates
- [ ] Manual story (no lesson) → no Frame row

---

## Phase 9b — Skill-aware Generate ✅

**Goal:** Generate uses a **ready** lesson frame so questions practice the week’s skill.

### Done

- [x] Load ready frame in checks `generate` API (body `lessonId` / override / story id parse)
- [x] Inject `formatLessonFrameForPrompt` into draft user message
- [x] System rules: ≥50% skill, ≥1 EQ, vocab only from target list
- [x] Toast + UI copy when frame was used

### Your test

- [ ] Mark frame ready on a Journeys story → Generate → most checks practice that skill
- [ ] Generate without ready frame → same as before (plot/beats only)
- [ ] Toast says draft was skewed to the lesson skill when frame was used

---

## Phase 9c — Stop and Check harvest ✅

**Goal:** Find publisher **Stop and Check** boxes in story text; import or use as Generate anchors.

### Done

- [x] Tagged `<<<stop_check>>>` markers + loose “Stop and Check” heading harvest
- [x] Story scan Gemini prompt keeps Stop and Check boxes
- [x] Stories **Stops** row: list + Import into check pack
- [x] Generate treats harvested items as must-cover beats

### Your test

- [ ] Re-scan a story that has Stop and Check at page bottoms → Stops row appears
- [ ] **Import new** → checks appear in pack (set answers, Approve)
- [ ] **Generate** → toast mentions Stop and Check anchors when found

---

## Phase 9d — Part content fuel (optional, deferred)

Extra fuel from Workshop part pages beyond the lesson frame. **Parked** until 9e is used in real prep.

---

## Phase 9e — Literature → Workshop lesson link ✅

**Goal:** On a Literature anthology story, pick the matching Workshop week so Generate loads that **Workshop** lesson frame (not Literature’s own outline week).

### Done

- [x] Separate workshop link store (does not overwrite Literature `story.lessonId`)
- [x] API `GET/POST /api/reading-stories/workshop-link`
- [x] Generate prefers ready Workshop frame when a link exists; else same-book frame
- [x] Literature Stories **Link** row + scan Workshop frame; Journeys keeps local **Frame**
- [x] Soft Generate warn when linked but Workshop frame not ready

### Your test

- [ ] Open a Literature book → Stories → **Link** → pick Workshop book / unit / week → Save
- [ ] **Scan frame** on the linked Workshop week → Mark ready
- [ ] Generate → toast / copy says skill frame was used
- [ ] Journeys story still shows local Frame (no Link row)

---

## Non-goals (this track)

- Full Lesson Hub / Focus-Park alternating UI
- Teacher edition indexing
- Auto-scan every lesson in the book
- Syncing Literature story `lessonId` to Workshop (link stays separate)
