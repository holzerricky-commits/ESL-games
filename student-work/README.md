# Student work (local teacher folder)

This directory holds per-student exports, homework placeholders, and other files written by the app when you run it **locally** (`npm run dev` / `npm run start` on your machine).

## Layout

After the first save for a student, you will see:

- `student-work/<studentId>/exports/book-review/<YYYY-MM-DD>/` — book screenshots and PDF packets for review
- `student-work/<studentId>/homework/assigned/<YYYY-MM-DD>/` — materials you assign (future uploads)
- `student-work/<studentId>/homework/submitted/<YYYY-MM-DD>/` — scans or files from students
- `student-work/<studentId>/materials/`, `audio/`, `lesson-notes/` — dated subfolders as needed

Each image or PDF may have a sidecar `<same-name>.meta.json` (book id, page, caption, etc.).

## Privacy and git

Large or personal files should stay **out of git**. Patterns in the repo `.gitignore` ignore most contents here while keeping this README.

## Hosted deployments

On serverless hosts (e.g. Vercel), the filesystem is **not** a durable place to store teacher files. Treat disk export as a **local workflow** unless you add cloud storage later.
