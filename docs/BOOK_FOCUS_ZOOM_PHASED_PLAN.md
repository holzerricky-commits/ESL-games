# Book focus zoom — phased implementation plan

Last updated: 2026-07-28

**Product:** `docs/BOOK_FOCUS_ZOOM_PRODUCT.md`

**How to use:** One phase at a time → run test script → fix → next phase.

## Test script

1. Open reader → **Z** or Focus tool → drag box on left page → region fills viewport; outside dimmed.
2. **Text tool** → tap blanks → type answers while zoomed.
3. **Esc** → normal spread; text aligned with lines.
4. Reload → text persists.
5. Focus right page and cross-gutter box.
6. Turn page → focus clears.
7. While zoomed: pen letter + marker swipe + rectangle shape → Esc → ink aligned with PDF.
8. While zoomed: undo/redo one stroke.
9. While zoomed: drag dim or Space+drag to pan; content stays on the page.
10. Zoom page 5, Esc, turn away and back, **Z** on page 5 → same box returns (same session).
11. While zoomed: **Save image** → cropped export in student work.

## Phases

| Phase | Name | Status | Outcome |
|-------|------|--------|---------|
| **0** | Scope | Done | Product + plan |
| **1** | Focus + text while zoomed | Done | Box, dim, transform; text + select |
| **2** | Full ink parity | Done | Measured spread scale for pen/marker; sticky delegate; remeasure on focus; tests |
| **3** | UX polish | Done | Adaptive zoom cap, Z restores last zoom, draw vs restore split |
| **4** | Extras | Done | Pan while zoomed, session zones per page, save focus as image |
| **5** | WYSIWYG fill-first | Done | Removed adaptive under-zoom (later superseded) |
| **6** | Exact content crop | Done | Hide hardcover while focused; transform content-sized wrapper; uncapped fill so box = view |

## Phase 6 notes (shipped)

- **Content-exact crop** — while Focus is active, hardcover chrome is hidden and the transform applies to the page cluster (same top-left as the drag measurement). Fixes misaligned crop when the outer frame was transformed instead of the pages.
- **Uncapped fill** — no max-extra ceiling; selected region always fills the ~92% hole. You see only what you boxed.

## Phase 5 notes (shipped)

- **Fill-first zoom** — selected region fills the focus frame. Adaptive under-zoom for small boxes was removed.
- **Single safety ceiling** — ~4× with hole-shrink when capped. **Superseded by Phase 6** (uncapped exact fill + content-aligned transform).

## Phase 4 notes (shipped)

- **Pan** — drag dimmed areas or hold **Space** and drag to nudge the zoomed view; pan resets on new box / preset / exit.
- **Per-page memory (session)** — each spread page remembers its last focus box until you close the reader; **Z** restores the current page’s box first.
- **Save image** — while zoomed, **Save image** exports the focus hole (with ink) to student work files.

## Phase 3 notes (shipped)

- **Adaptive zoom cap** — tiny boxes zoom less (sharper PDF on screen share). **Superseded by Phase 5–6**.
- **`Z`** restores last focus box this session; **Focus button** draws a new box.

## Phase 2 notes (shipped)

- Pen/marker pattern origins use **live DOM scale** (`measuredSpreadScreenScale`) under focus transform.
- **Double rAF remeasure** when focus layout applies.
- **Sticky** tool explicitly delegates pointer to spread session DOM while zoomed.
- Tests: `lib/books/focus-zoom-transform.test.ts`, `lib/books/focus-zoom-ink-parity.test.ts`.
