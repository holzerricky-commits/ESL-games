# Class schedule lifecycle — product decisions (locked)

Last updated: 2026-07-30

**Status:** Agreed direction. Implementation phases live in **`CLASS_SCHEDULE_LIFECYCLE_PHASED_PLAN.md`**.

**Builds on:** Manual start/end class ritual in `CLASS_SESSION_FLOW_TASKS.md` (Tasks 1–6 done). This track makes the **calendar** the source of truth for when a class is live, when it ends, and how you move or miss it.

---

## Problem

- Easy to forget **Start class** or **End class**.
- Timer today counts from the Start click, so a late start shows the wrong end time.
- Clients reschedule **days ahead**, **a minute ahead**, or **at the bell** (“can we move?”). The app must support all three without leaving stuck live sessions or fake “completed” classes.
- No-shows should become **Missed**, not Completed.

---

## North star (what you feel)

1. The clock always aims at **when this slot should end** (schedule + any extends you chose).
2. If the app is open at start time, the class can go **live** without a Start tap.
3. You can **Move** a class in a few taps whether it’s tomorrow, in two minutes, or already live.
4. Overtime is allowed briefly; the class **cannot** run forever.
5. Forgotten / never-taught slots become **Missed**, with a way to mark taught or reschedule later.

---

## Locked defaults

| Knob | Value |
|------|--------|
| End time base | `scheduledFor + durationMin` |
| Late start | Does **not** push the end later |
| Grace after effective end | **5 minutes** |
| Extend buttons | **+2 / +5 / +10** |
| Max total overtime | **+15 minutes** beyond original scheduled end |
| After grace / max overtime | **Auto-end** (bookmark + complete; no blocking recap) |
| Auto-start | Only while the **app is open** in the browser |
| One live class | **App-wide** — at most one `in_progress` session at a time |
| No-show outcome | **`missed`** status (not completed, not cancelled) |
| Prepare / Open book | Does **not** start the live clock (unchanged) |

---

## Move class — one flow for all timings

**Decision:** One **Move class** sheet, three entry points. No separate “advanced reschedule wizard.”

### Entry points

1. **Today / home** class card  
2. **Schedule** event detail (and drag stays for calm calendar edits)  
3. **Live timer** chrome → **Move instead** / **Cancel** / **End**

### Live timer chrome (while `in_progress`)

| Action | Meaning |
|--------|---------|
| **Move instead** | Will happen later — leave live, no bookmark-as-taught, new time |
| **Cancel** | Won’t happen this slot — leave live, status → **cancelled**, clear live fields, **no** end bookmark |
| **End** | We taught — **Mark finished?** with optional note → **completed** + bookmark path (even if early) |

Cancel is also available as a quiet **Cancel this class instead** link on the Move sheet when the session is live.

### Sheet behavior

| Rule | Detail |
|------|--------|
| Default scope | **This class only** (one occurrence). Weekly pattern unchanged unless you explicitly change the series from the schedule “every week” path. |
| What moves | Same session row: new `scheduledFor` (+ optional duration). Prep notes / outline stay on that session. |
| Conflict | Block with a clear message if another class overlaps (existing conflict checks). |
| Cancel ≠ Move ≠ End | **Cancel** = will not happen. **Move** = will happen at a new time. **End** = taught / finished (optional note). |

### Shortcuts (always on the sheet; emphasized when urgent)

When the class is **live** or **within 15 minutes of start**, lead with chips; otherwise chips still help but the date/time picker is equally prominent.

| Chip | Meaning |
|------|---------|
| **+30 min** | Same day, start 30 minutes later (clamp if past teaching hours / conflict) |
| **Tomorrow same time** | Next calendar day, same clock time, same length |
| **Pick date & time** | Full day + time + length controls |

Days-ahead moves use the same sheet (picker first is fine; chips still available).

### Move while live or just auto-started

1. Leave `in_progress` (clear `classStartedAt` / live fields as needed).  
2. **Do not** write end-of-class bookmark as a finished lesson.  
3. Apply new schedule; status → **planned** (or **prepared** if prep already existed).  
4. Timer follows the **new** slot.  
5. Optional one-line note later (“parent asked to move”) — not required for v1.

Ink / board already lasting per student+book stays; we are not discarding teaching tools — we are saying **this calendar slot did not complete as a class**.

### Cancel while live

1. Leave `in_progress` → **cancelled**; clear `classStartedAt` / `classEndedAt` / `extendedMinutesTotal`.  
2. **Do not** write end-of-class bookmark.  
3. Prep / board for the student stay; the slot does not count as taught.  
4. Weekly cancelled exception still applies when the session has a `sourceSlotId`.

### End early (mark finished)

Ending from the live timer (including before scheduled end) means **we taught**. Dialog: **Mark finished?** with optional quick note / session log. Primary path: save bookmark + notes → **completed**. No separate status for “finished early.”

### Series changes

Changing **every week** stays on the existing recurring schedule path (edit weekly slot → “Only this class” vs “Every week”). The Move sheet is for **this occurrence** by default so last-minute parent requests stay one decision.

---

## Live clock & overtime

| Phase | Behavior |
|-------|----------|
| Before start | Upcoming; optional existing ~20 min reminder |
| At scheduled start (app open) | Soft auto → `in_progress`; toast/banner OK; **do not** force-navigate into the book |
| During | Countdown to effective end; warning in last ~3 min |
| At end | **Grace** (5 min): tools stay usable; show End + extend chips |
| Extend | Adds to `extendedMinutesTotal`; new countdown; cannot exceed +15 total |
| Grace / cap exhausted | **Auto-end** → `completed`, bookmark from last viewed page rule, soft “add note later” only |

Manual **Start early** and **End now** always remain.

---

## Missed vs completed vs cancelled

| Status | When |
|--------|------|
| **completed** | You ended (or auto-end after a real live session past grace) |
| **missed** | Slot’s end + grace passed and the class was never meaningfully taught — see catch-up rules in the phased plan |
| **cancelled** | Explicit cancel / won’t happen |
| **planned / prepared** | Still ahead (or moved to a future time) |

**After Missed:** actions = **Reschedule** (same Move sheet → future time, status back to planned) or **Mark taught anyway** (→ completed, optional note). Leave as Missed if neither.

---

## What “app open” means

Auto-start and auto-end run while the teacher app is open in the browser (home, schedule, student map, reader). No promise if the laptop sleeps or the tab is closed — **catch-up on next open** reconciles Missed / auto-end / mid-slot live.

**Out of scope for this track**

- OS / phone push notifications  
- Auto-open Voov / WeChat  
- Multi-student rooms  
- Always-on server cron  

---

## Relationship to other docs

- `CLASS_SESSION_FLOW_TASKS.md` — original manual ritual (keep Start/End/prep; timer math and automation supersede Task 3’s “from click” behavior).  
- `MILESTONE.md` — Phase 1 teach ritual; this track reduces friction on that ritual.  
- Schedule drag / recurring dialog — keep for calm edits; Move sheet is the **fast path** for parent-driven changes.
