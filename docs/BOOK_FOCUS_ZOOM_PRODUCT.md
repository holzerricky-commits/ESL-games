# Book focus zoom — product (v1)

Last updated: 2026-07-28

**Phased plan:** `docs/BOOK_FOCUS_ZOOM_PHASED_PLAN.md`

## User story

During a 1:1 lesson on screen share, the teacher boxes an area on the book spread (vocab block, fill-in-the-blank lines, grammar box). That region enlarges and the rest of the page dims so the student can read clearly. The teacher can **type text** (and use other annotation tools) while zoomed. **Esc** returns to the normal spread view; ink stays on the page.

## Locked v1 rules

| Rule | Choice |
|------|--------|
| Interaction | Drag a **focus rectangle** — zoomed viewport **matches that shape** (WYSIWYG), up to ~92% of screen |
| Zoom amount | **Exact fill** — selected page region fills the focus window; no max-zoom ceiling. You see only what you boxed. |
| Book frame while zoomed | **Hidden** — hardcover chrome is off while Focus is active so the crop lines up with the page art (frame returns on Esc). |
| Chrome | **Presentation mode** — full-viewport theater scrim; minimal bottom bar (Exit · New area · Save); page nav hidden while zoomed |
| While zoomed | **Annotate** (text first; pen/marker in Phase 2) |
| Persistence | **None** — live view only; clears on Esc, page turn, close reader |
| Shortcut | **`Z`** or **Focus button** — draw a new box; **Esc** / click dim exits zoom; **`W`** (lesson board) exits zoom then opens board at normal scale |
| Exit | **Esc** |
| Pan while zoomed | **Space+drag** to nudge; **click dimmed area** to exit |
| Per-page recall | Removed — **Z** always starts a new box after exit (session storage unused for restore) |
| Export | **Save image** while zoomed → cropped focus region (Phase 4) |
| Spread model | One rect in **spread-normalized** space (0…1 across both pages) |

## Presentation mode (shipped)

While focus zoom is active:

- **Theater scrim** — full-viewport opaque black (`#0a0a0a`) with a clip-path hole aligned to the focus frame; map route uses the same solid surround (no blur peek).
- **Larger focus window** — zoom fill cap **92%** of viewport.
- **Quiet chrome** — page nav, top controls, translate dock, and annotation options bar hidden; left rail keeps annotation tools only (page-list button hidden).
- **Minimal bottom bar** — icon-only Exit · New area · Save; pan hint only while Space is held.
- **Hairline frame** — thin white border on the focus hole (no corner brackets).
- **No hardcover** — decorative book frame hidden so the zoomed crop matches the drawn box on the pages.

## Non-goals (v1)

- Magnifying glass cursor
- Saved focus zones **across classes** (session-only per page is OK)
- Lesson board parity
- Keeping the hardcover visible while Focus is active
