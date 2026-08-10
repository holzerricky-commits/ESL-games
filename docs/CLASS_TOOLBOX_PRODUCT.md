# Class toolbox — product decisions (locked)

Last updated: 2026-07-28

**Status:** Agreed direction. Implementation phases live in **`CLASS_TOOLBOX_PHASED_PLAN.md`**.

**UI name (teacher-facing):** Toolbox

---

## What this is

Short **in-class helpers** you open while teaching from the **book** (1:1 screen share): coin flip, dice, countdown timer, stopwatch, and similar.

They sit in the **activity layer** — spice for a moment on the curriculum spine — not a separate “games app” and not the main lesson loop.

---

## Where it lives

| Surface | Role |
|---------|------|
| **Book left strip** (fullscreen book overlay) | **Home** — Toolbox button among assist tools (translate, coach, lesson settings). |
| **Map (book closed)** | Optional later — same tools, same open style. Not required for v1. |
| **Sidebar / Games** | **Not** the home for these. Games stays for bigger activities (e.g. Timed Challenge). |

Book stays **visible** underneath. Opening a tool must not navigate away or replace the reader with a full page.

---

## How it opens

1. Tap **Toolbox** on the book left strip → small **menu** (grid of tools).
2. Tap one tool → **one compact floating dock** (phone-widget size), not a full page.
3. **One tool open at a time** — opening another closes the current one.
4. Clear **Close** on the dock; Escape closes menu first, then dock (+ stage).
5. Closing returns you to the book; page position does not jump.

**Class clock vs countdown:** The map/class timer is “how long is class.” The toolbox countdown is “you have N seconds for this activity.” They must not merge or replace each other.

---

## Dock vs stage (coin / dice)

| Piece | Role |
|-------|------|
| **Dock** | Compact floating card bottom-right: title, Close, result, Flip / Roll. Dice: small widget with **2×3 bare die icons** (no chip backgrounds). No big coin/die inside the dock. |
| **Stage** | Spectacle **over the book** — large animated coin or die centered on the page area. |

**During play:** Soft dim (`bg-black/30`) so the prop pops; **book taps blocked only while flipping/rolling + a short settle**, then dim clears. Settled coin/die may stay visible until the next play or Close.

**Timers / stopwatch:** Stay **in-dock only** (no stage). They are ongoing controls, not a one-shot moment.

---

## v1 tools

| Tool | Behavior (intent) |
|------|-------------------|
| **Coin flip** | Dock: Flip + Heads/Tails. Stage: big coin over book with ~1s flip. |
| **Dice** | Small **bottom-right** dock: **2×3** bare die icons (d4–d20, no chip backgrounds), **Roll**, **Total** + per-die values (max **6**). Remove by tapping a die on the stage. Opens with one **d6** auto-roll. Stage: cartoon **d6** faces; Google-style faceted SVGs for other sides. |
| **Countdown timer** | In-dock: presets (e.g. 30s / 1 min / 2 min); start / pause / reset; big digits; clear “time’s up.” |
| **Stopwatch** | In-dock: start / stop / reset; same digit style as countdown. |

---

## Later (not v1)

- D&D-style modifiers (+/− on total), typed `3d8+4` input
- Random name picker, number spinner
- Sound on roll / timer end
- Drag dock position; remember last tool
- Map chrome entry when book is closed
- Rewards / coins / map progress tied to rolls or timers

---

## Explicit non-goals (v1)

- New sidebar “Toolbox” destination
- Full-screen mini apps that leave the book
- Several tools open at once
- Replacing Timed Challenge, lesson board, pen tools, or End class / class clock
- Student-owned devices or sync
- Physics engines / Three.js for coin or dice

---

## Success

You can open Toolbox mid-lesson, flip a coin (or roll) as a moment over the book, close it, and keep teaching from the same book page without fighting the UI.
