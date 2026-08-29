# Student records (local dev)

When you run the app locally (`npm run dev` or `npm run start` on your machine), **students, class sessions, challenge progress, book annotations, weekly schedule, and timed challenges** for the plan are stored here instead of only in the browser.

| File | Contents |
|------|----------|
| `students.json` | All `StudentRecord` rows (classes, notebooks, curriculum, etc.) |
| `student-progress.json` | Map/challenge progress per student key |
| `book-annotations.json` | Book page marks + live ink checkpoints (pen, text, stickies, lesson board) |
| `weekly-schedule.json` | Teacher weekly hours + recurring student slots |
| `challenge-data.json` | Timed-challenge quizzes and student results |
| `saved-words.json` | Words saved from the book (per student) |
| `lesson-board-links.json` | Pins from book pages to lesson-board pages |
| `reader-progress.json` | Last-read PDF page per book/unit |
| `roster-prefs.json` | Students page list/grid, sort, and status filter |

On first load after an update, data is **copied out of** browser storage when those keys still hold data and these files are empty — that frees browser quota.

**Not in git:** personal teaching data stays on your PC. Back up via **Settings → Download backup JSON** or copy this folder.

**Hosted deploys** (e.g. Vercel) do not use this folder; they keep using browser storage only.
