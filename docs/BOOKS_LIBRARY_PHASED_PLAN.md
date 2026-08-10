# Books library & prep — phased plan

Last updated: 2026-08-10

**Product:** `docs/BOOKS_LIBRARY_PRODUCT.md`  
**Rule:** Implement **one phase at a time**. Test before continuing. Prefer **icons, covers, status dots** over text explanations and dense layouts.

---

## Design language (all phases)

| Do | Don’t |
|----|--------|
| Big covers, one status icon/chip | Walls of subtitle + “detail” copy |
| Cover click → go deeper | Separate Prep vs Browse doors on every card |
| Empty states with simple illustration + one CTA | Multi-step instructional essays |
| Lesson thumbs like Library covers | Dense equal tabs as the main desk |

---

## Phase 0 — Lock docs (done)

- [x] Product + phased plan
- [x] Note in `MILESTONE.md`

---

## Phase 1 — Library shelf (done)

- [x] Cover grid / series rows
- [x] Add book
- [x] No book selected → shelf is the main pane

**Status:** Done 2026-08-09.

---

## Phase 2 — Prep stages (superseded)

Map / Ready / Tools shipped as a temporary desk. **Superseded** by lesson-shelf direction below; old hub kept as temporary escape hatch until part prep lands.

**Status:** Done then superseded 2026-08-09.

---

## Phase A — Lesson shelf after book click (done)

**Goal:** Click a Library book → **lesson shelf**, or empty outline CTA.

- [x] Cover click opens lesson shelf (not Map/Ready/Tools)
- [x] No outline → empty + **Outline this book** (structure wizard)
- [x] Outlined → unit rows + lesson cover thumbs
- [x] Presentation → unit cards (or empty add-PDF CTA)
- [x] Remove Prep / Browse links from Library cards
- [x] Temporary muted link to old prep desk
- [x] Lesson tap does **not** open part prep yet *(superseded by Phase B)*

**Test:** Unmapped book → CTA → outline → lessons appear. Mapped book → unit rows. Library back works. Teach path unchanged.

**Status:** Done 2026-08-09.

---

## Phase B — Lesson → parts

**Goal:** Tap a lesson → parts list; tap a part → simple prep shell (preview + back).

- [x] Lesson tap opens parts row/list for that lesson
- [x] Part list: vertical rows with type icons; story parts get small PDF thumb + slightly taller row
- [x] Part tap → shell with larger page preview + placeholder prep slots
- [x] Back: part → lessons → Library
- [x] URL deep links: `lesson` + `part` query params
- [x] Old prep desk escape still available *(superseded by C4 — Advanced tools on lesson shelf)*

**Test:** Mapped book → lesson → parts → part shell → back. Empty parts lesson shows outline hint.

**Status:** Done 2026-08-09.

---

## Phase C — Part prep module

**C1–C3:** Pages, story text, and reading checks in the part shell. — **Done**

**C4 (this slice):** Shrink old prep hub escape hatch.

- [x] Confirm pages live in part shell (main/paired story)
- [x] Story text (scan / paste / save) lives in part shell for story parts
- [x] Reading checks (draft / generate / approve) live in part shell for story parts
- [x] Old prep hub demoted: removed from part/parts headers; one quiet **Advanced tools** on lesson shelf (opens materials). Deep links `?tab=` still work.

**Status:** C4 done 2026-08-10.

---

## Phase D — Cleanup

- [x] Drop leftover equal-tab / checklist chrome (Map/Ready/Tools → simple Advanced tools pills; deleted unused checklist)
- [x] Update deep links + `book-setup-copy.ts` (default tab Materials when outlined; Stories copy points to part prep; legacy `map`/`ready`/`tools` URLs still resolve)
- [x] Smoke Journeys + Literature (+ Workshop) library shapes; no presentation book in current library (code path still supported)

**Status:** Done 2026-08-10.

---

## Order

```text
0 docs → 1 Library shelf → A Lesson shelf → B Parts → C Part prep → D Cleanup
```

**Park:** Lesson Hub, custom art pack, AI “what to prep next,” separate Browse mode, old Phase 3–5 Ready visual as peer tabs.
