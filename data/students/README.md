# Student records (local dev)

When you run the app locally (`npm run dev` or `npm run start` on your machine), **students, class sessions, and challenge progress** for the plan are stored here instead of only in the browser.

| File | Contents |
|------|----------|
| `students.json` | All `StudentRecord` rows (classes, notebooks, curriculum, etc.) |
| `student-progress.json` | Map/challenge progress per student key |

On first load after an update, data is **copied out of** `localStorage` keys `esl_students` and `esl_student_progress` when those keys still hold data and these files are empty — that frees browser quota.

**Not in git:** personal teaching data stays on your PC. Back up via **Settings → Download backup JSON** or copy this folder.

**Hosted deploys** (e.g. Vercel) do not use this folder; they keep using browser storage only.
