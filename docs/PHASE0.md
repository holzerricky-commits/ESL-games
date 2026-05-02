# Phase 0 — Teach-ready shell

Full intent lives in **`PROJECT_CONTEXT.md`**. The execution checklist lives in **`MILESTONE.md`** (current sprint). This doc is the **operator guide** for Phase 0.

## 1. Run target

Choose how you will open the app while on a call:

| Option | When to use | Caveat |
|--------|-------------|--------|
| **`npm run dev`** (localhost) | Everyday teaching + development | Hot reload *can* interrupt mid-lesson; many teachers still prefer this until it ever bites. |
| **`npm run build` + `npm run start`** | Optional calmer run | Closer to production; run **`build` again** after code changes before the next “show” session. |
| **Hosted URL** (e.g. Vercel) | Link without running commands on the PC | Same browser = same `localStorage`; books on disk need their own story. |

**Do:** Write your chosen command or URL in **`MILESTONE.md` → Notes** so future you (and agents) know the canonical teaching setup. **`npm run dev` only is a valid choice.**

## 2. Data safety

- App data for quizzes, students, results, book annotations, reader progress, etc. is stored under browser **`localStorage`** keys starting with `esl_`.
- Clearing site data or using another browser **drops** that data unless you have a backup.

**Built-in backup (Settings):**

1. Open **`/settings`** in the teacher app.
2. Use **Download backup JSON** before risky changes or weekly.
3. To move machines or recover: **Restore from JSON** (confirms, then reloads).

Backups include every `esl_*` key present at export time. Session-only data (e.g. map pan/zoom in `sessionStorage`) is **not** in the file.

## 3. One student lesson-path try (manual)

On your **run target** browser:

1. Open a student (create one if needed).
2. Assign curriculum / book as you normally would.
3. Open the **book reader** from that student’s flow; turn several pages; exit cleanly.
4. Note anything awkward for **screen share** (tiny controls, too many clicks).

## 4. Optional activity

If you still use **Timed Challenge** or the **student map** in lessons, try them once on a call. If you do **not** plan to use them, mark this item **skipped** in `MILESTONE.md` and move on.

## 5. Phase 1 entry criteria

In **`MILESTONE.md` → Notes`**, write what **bookmark / resume** must mean for you (e.g. “reopen last PDF page per student per book”). That becomes the acceptance bar for Phase 1.

---

When 1–5 are satisfied, check the boxes in `MILESTONE.md` and start Phase 1.
