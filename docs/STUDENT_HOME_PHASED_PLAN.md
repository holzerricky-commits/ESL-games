# Student home — phased implementation plan

Last updated: 2026-07-26

**Product source of truth:** `STUDENT_HOME_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next phase. Do not skip phases unless a prerequisite is already done and checked.

**Build order (locked):**

```text
0 docs → 1 roster one-door → 1b roster chrome → 2 student shell → 2b Next class UX → 3 kill /plan split → 4 settings+learning tidy → 5 polish if needed
```

Do **not** start Phase 3 until Phase 2b feels teachable. Do **not** start Phase 4 until Phase 2 feels teachable for one student.

**Current codebase baseline (pre–Phase 1):**

- Roster: name → Plan, eye → Preview (`/students/[id]`), trash on the row.
- Two homes: `/students/[id]` (map / avatar / words / info) and `/students/[id]/plan` (Next class / Books + setup).
- Profile header shows challenge / streak / coins / level on both surfaces.

---

## Phase 0 — Documentation ✅

| Item | Status |
|------|--------|
| `STUDENT_HOME_PRODUCT.md` | Done |
| `STUDENT_HOME_PHASED_PLAN.md` | Done |
| Cross-link in `MILESTONE.md` | Done with this pass |

**Your test:** Read both docs; confirm Next class default, Start → map, and Phase 1 Open → plan (temporary) before more UI work.

### Non-goals

- No code required beyond doc + milestone link (roster code may land in the same pass as Phase 1).

---

## Phase 1 — Roster: one door ✅

**Goal:** List only opens one teaching destination. No Plan vs Preview choice.

### Tasks

- [x] Name click and primary **Open** use the same href (`finishSetupHref` when setup needed, else `openPlanHref` — still `/plan` for now).
- [x] Remove eye / Preview button from the roster row.
- [x] Rename Plan / Setup button label to **Open** (setup badge still shows “Set up”).
- [x] Put remove (on break / delete) behind a **⋯** menu; on-break rows: **Restore** + ⋯ for permanent delete.
- [x] Keep next-class and book/page lines; calendar link to schedule may stay as secondary text.

### Files (expected)

- `components/students/student-card.tsx`
- Docs above

### Acceptance (you test)

- [ ] Click three student names → always the same kind of page (class prep / setup), never a separate “preview” from the list.
- [ ] No eye icon on the row.
- [ ] Remove / delete only via ⋯ (or Restore + ⋯ on break).
- [ ] Setup badge still appears when book or schedule is missing; Open still finishes setup.

### Non-goals

- Do not redesign the detail page yet.
- Do not change `/plan` vs `/students/[id]` URLs elsewhere (dashboard, map exit, etc.).

---

## Phase 1b — Roster chrome (header, sort, list/grid) ✅

**Goal:** Standard roster shell — header + toolbar + list/grid — without building the student home.

### Tasks

- [x] Page header: Students · short description · counts · Add student.
- [x] Toolbar: search · status (Active / Needs setup / On break) · sort · list/grid toggle.
- [x] Persist view + sort + status in `localStorage` (`esl_students_roster_prefs`).
- [x] Sort: Name A–Z · Next class soonest · Needs setup first (`nextClassAt` on list view).
- [x] Grid tiles: avatar, name, badge, meta; open-anywhere + ⋯ (same rules as list).
- [x] Empty states for no students / search / status filter.

### Acceptance (you test)

- [ ] Header + Add; search/sort/status/view work in list and grid.
- [ ] List ↔ grid preference survives refresh.
- [ ] Active / Needs setup / On break filters; Restore on break.
- [ ] Whole row/tile opens; ⋯ remove only.

### Non-goals

- Column table, bulk actions, Phase 2 student shell.

---

## Phase 2 — Student shell (empty rooms) ✅

**Goal:** One page that *feels* like the new home; old content plugged in roughly.

### Tasks

- [x] Top: face, name, next class, book/page (no RPG stats as primary header).
- [x] Buttons: **Start class**, **Open book**.
- [x] Four sections: Next class | Books | Learning | Settings; default = Next class.
- [x] Wire: Next class = old Classes tab; Books = Curriculum; Learning = Words; Settings = teacher bits from Info.
- [x] Hide Map / Avatar from main nav (**retired** — no Map & rewards link; no quiz difficulty on home).
- [x] `/students/[id]` is the shell host; `/plan` still works until Phase 3; roster Open points at the home.

### Acceptance (you test)

- [ ] One ready student: Start, Open book, and flip sections without getting lost.
- [ ] Map/avatar not equal tabs on the home.

### Non-goals

- Do not rewrite class-prep editors.
- Do not build phrases / named errors yet.

---

## Phase 2b — Next class UX (hierarchy) ✅

**Goal:** Next class is prep-only; header owns Start / Open book; More and Past stay out of the way.

### Tasks

- [x] Lock Next class product rules in `STUDENT_HOME_PRODUCT.md`.
- [x] Remove duplicate Start / Open book from the spotlight panel.
- [x] Quiet **Generate outline** (not a primary go action).
- [x] Collapse **More scheduled classes** and **Past classes** by default.
- [x] Keep Start on non-spotlight upcoming rows (header only covers the spotlight class).
- [x] Clearer prep stack: section → outline → notes; words / extras collapsed; no date/time or “use Start at top” tip; tighter page preview.

### Acceptance (you test)

- [ ] Next class scrolls as prep (preview + section + outline), not a second start bar.
- [ ] More / Past open only when you expand them.
- [ ] Header Start / Open book still start the spotlight class.

### Non-goals

- Deep rewrite of outline / AI prep editors.
- Phase 3 `/plan` redirect.

---

## Phase 3 — Kill the second home

**Goal:** One URL, one mental model.

### Tasks

- [ ] `/plan` redirects into the student home (right section if needed).
- [ ] Remove “Student preview” / “Class prep” cross-links.
- [ ] Point sidebar / home / reminder / schedule Prep links at the new home.
- [ ] Setup still lands on the same home after finish.
- [ ] Update `openPlanHref` / `finishSetupHref` / class-prep helpers to the canonical URL.

### Acceptance (you test)

- [ ] Old `/plan` bookmarks still work.
- [ ] Dashboard Start still works.
- [ ] No dead Preview path from roster or header.

### Non-goals

- No deep Learning / Settings polish (Phase 4).

---

## Phase 4 — Settings & Learning tidy

**Goal:** Quiet admin + clear learning shelf.

### Tasks

- [ ] Settings: welcome + on break / delete only — no fake “About you”; **do not** re-add Map & rewards or quiz difficulty.
- [ ] Learning: words list usable; short stubs for phrases & errors.

### Acceptance (you test)

- [ ] Put on break / remove without hunting.
- [ ] Words easy to find.

### Non-goals

- Map, avatar, coins, quiz difficulty UI on the student home.

---

## Phase 5 — Polish only if it hurts

**Goal:** Fix friction you hit teaching — not redesign for fun.

### Tasks (pick only if blocking)

- [ ] Clearer empty states (“No next class — book one”).
- [ ] Setup checklist polish.
- [ ] Narrow / mobile layout if you teach on a small screen.

**Park if it isn’t blocking a real lesson.**

---

## Out of scope (don’t pull in)

- Rewriting Next class / prep outline internals
- Lesson board, schedule lifecycle, interactive vocab
- Resurfacing map/avatar/rewards or quiz difficulty on the student home
- AI lesson prep UI
