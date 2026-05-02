# Class session flow — implementation tasks

**Progress:** Task **6** of **7** complete. Say **“next”** to start Task 7.

Teaches: start class → map + timer → end class → past classes + log fields → bookmark → (later) AI on log.

| # | Task | Status |
|---|------|--------|
| 1 | **Data model** — `in_progress` status; session fields (`classStartedAt`, `classEndedAt`, `classEndNote`, `bookmarkAtEnd`); sanitize + `computeNextClass` ignores `in_progress` for “next upcoming”. | [x] |
| 2 | **Start class** — Button next to Prepare; set `in_progress` + `classStartedAt`; navigate to student map with session context (query or store). | [x] |
| 3 | **Timer on map** — Countdown from `durationMin` + wall clock; yellow blink in last N min; red when over (no hard stop). | [x] |
| 4 | **End class** — Sticky control + confirm; set `completed`, `classEndedAt`, optional `classEndNote`, `bookmarkAtEnd`. | [x] |
| 5 | **Past classes UI** — Section listing `completed` sessions (newest first), expandable rows. | [x] |
| 6 | **Bookmark → reader** — On end class, persist last page to reader progress / curriculum per your rule. | [x] |
| 7 | **AI hook (stub)** — Placeholder or “Suggest updates” from session log with teacher confirm (no auto-write). | [ ] |

---

## Task 1 — Done criteria

- [x] Types and `sanitizeClassSession` round-trip unknown JSON safely.
- [x] `normalizeClassStatus` accepts `in_progress`.
- [x] `computeNextClass` excludes `in_progress` from the “next upcoming by schedule” pick.

Update the `[ ]` / `[x]` in the table above as tasks complete.
