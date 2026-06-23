# Text label chrome — phased plan

**Milestone tie-in:** Phase 1 lesson ritual — teachers can place and edit text on the book without the box feeling wrong (crooked padding, invisible placeholder, lost caret).

**Depends on:** Text tool UX Phases 1–3 (hover/edit rings, placeholder copy, click-away) — **done**.

**Model:** One shared **layout recipe** (line height + padding) drives **three surfaces** that must agree:

1. What you see in the field (plain, filled/pill, sticky note body)
2. What the blue edit/hover/select rings measure
3. What tests assert in `text-label-measure`

**How we ship:** One phase at a time → run the test script → fix regressions → next phase. **Do not stack all phases in one PR.**

**Layout source of truth:** `lib/books/text-label-layout.ts`  
**Ring bounds entry:** `lib/books/text-label-chrome-bounds.ts`

---

## Test script (repeat after every phase)

1. **New plain label** — click page, empty field: ring hugs text evenly top/bottom/left/right; placeholder readable.
2. **Type one line** — ring grows with text; no jump when first character appears.
3. **Multi-line** — Enter adds a line; vertical padding still looks even per line.
4. **Filled/pill style** — empty + typing: same padding feel as plain; ring matches pill.
5. **Pen colors** — try **dark blue**, **red**, **yellow**, **white**: placeholder always readable; caret visible on white PDF.
6. **Hover** — dashed ring on existing text aligns with ink (not fat box).
7. **Select tool** — solid ring matches edit ring sizing rules.
8. **Writable sticky** — “Add a note…” same padding/color rules as plain text.
9. **Writing assist** — ghost word + spell squiggles still line up; no border shift when assist appears.

---

## Phase overview

| Phase | Name | Status | Outcome |
|-------|------|--------|---------|
| **0** | Baseline | Done | UX analysis — asymmetric pad, color issues. |
| **1** | **Layout tokens** | Done | `text-label-layout.ts`; measure + geometry use shared line height + vertical pad. |
| **2** | **DOM fields** | **Done** | Plain + filled editors use shared padding + line height; width fit reads padding from field. |
| **3** | **Ring parity** | **Done** | `text-label-chrome-bounds.ts` unifies hover, edit, select rings. |
| **4** | **Placeholder color** | **Done** | Neutral ghost text — not faded pen color. |
| **5** | **Caret contrast** | **Done** | Light inks get a dark caret while editing. |
| **6** | **Filled empty state** | **Done** | Faint pill tray before first keystroke. |
| **7** | **Cleanup & stickies** | **Done** | One placeholder path; sticky parity; tests. |
| **8** | Whiteboard parity *(optional)* | | Parking lot unless whiteboard text looks broken. |

---

## Phase 1 — Layout tokens (measure first) — implementation notes

- Added `lib/books/text-label-layout.ts` with `TEXT_LABEL_LINE_HEIGHT_RATIO` (1.3), per-side pad constants, and `textLabelBlockHeightNorm`.
- `text-label-measure.ts` and `annotation-geometry.ts` import from layout (no duplicate magic numbers).
- Vertical pad (`TEXT_LABEL_PAD_Y_PX` × 2) included in measured height when `heightPx` is known.
- Horizontal measure totals unchanged (plain 6px, filled 12px) — derived as `2 ×` per-side pad.
- `textTopYFromCenterAnchor` takes `heightPx` so center→top conversion matches measured box.

**Gate:** Unit tests green. Edit ring may still look slightly off vs field until Phase 2 DOM padding.

---

## Phase 2 — DOM fields match tokens — implementation notes

- `plainTextMirrorStyle` / `filledTextMirrorStyle` in `book-page-annotation-dom-layer.tsx` apply `textLabelFieldPaddingCSS` + `textLabelLineHeightPx`.
- Plain textarea, ghost placeholder, spell mirror, and ghost assist share the same style object.
- Filled editor: textarea + mirrors use filled padding (6px sides); pill row backgrounds match horizontal inset.
- `measurePlainTextWidthPx` / `measureFilledLineTextWidth` read horizontal pad from computed field styles (no double-count).

**Gate:** Run test script items 1–4 — ring and field should align.

---

## Phase 3 — Ring parity — implementation notes

- Added `lib/books/text-label-chrome-bounds.ts` — single `textLabelChromeBounds()` for hover, edit, and select.
- `text-tool-hover.ts`, `getAnnotationBounds` (text), `orientedSelectionFrameForCommand` (text), and text hit tests all route through it.
- Parity tests in `text-label-chrome-bounds.test.ts`: hover === select for committed labels; edit matches select when draft equals saved text.

**Gate:** Test script items 1–2, 6–7.

---

## Phase 4 — Placeholder color

Neutral `textLabelPlaceholderColor()` — not ink @ 45% opacity.

**Gate:** Test script item 5.

**Implementation notes**

- `TEXT_LABEL_PLACEHOLDER_COLOR` + `textLabelPlaceholderFieldCSS()` in `text-label-layout.ts`.
- Ghost placeholder spans (plain, filled, sticky) use neutral color; removed `opacity-45`.
- Native `::placeholder` on `textarea[data-annotation-id]` via `--annotation-placeholder-color` CSS var.

---

## Phase 5 — Caret contrast

`caretColorForInk()` — dark caret when ink luminance is high.

**Gate:** Test script item 5 (white/yellow pens).

**Implementation notes**

- `caretColorForInk()` + `textLabelCaretFieldCSS()` in `text-label-layout.ts` (threshold 0.68).
- Plain, filled, and sticky textareas set `caretColor` explicitly so light pens stay visible on the PDF.

---

## Phase 6 — Filled empty state

Faint pill background while empty + editing.

**Gate:** Test script item 4.

**Implementation notes**

- `filledTextEmptyTrayColor()` in `text-label-layout.ts` (38% alpha of fill swatch).
- `FilledTextUnifiedEditor` shows tray when `showFieldPlaceholder && showTextarea`; full fill on first keystroke.

---

## Phase 7 — Cleanup

One placeholder mechanism per editor; grep stray `1.25`, `py-0`, `opacity-45`; extend tests.

**Gate:** Full test script 1–9.

**Implementation notes**

- `TextLabelPlaceholderGhost` — single ghost layer; removed native `placeholder` attr from plain/sticky textareas.
- `textLabelPlaceholderMirrorStyle`, `textLabelEditableFieldChromeCSS`, `writableStickyBodyMirrorStyle` in `text-label-layout.ts`.
- Sticky body fields use shared 1.3 line height + plain padding (replaced ad-hoc `1.25` / `1.35` / `leading-snug`).

---

## Explicit non-goals (v1)

- DOM `getBoundingClientRect` live ring — defer unless pad tokens fail on one font.
- Toolbar rail hints — removed; do not bring back.
- Changing selection blue (`#3b82f6`).
- Redesigning writing-assist ghost UI — alignment check only.

---

## Progress log

| Date | Phase | Note |
|------|-------|------|
| 2026-06-21 | 0 | UX analysis — asymmetric pad, color issues. |
| 2026-06-21 | 1 | `text-label-layout.ts`; measure height uses 1.3 line height + vertical pad. |
| 2026-06-21 | 2 | DOM plain + filled fields use shared padding/line-height; width fit from computed pad. |
| 2026-06-21 | 3 | `textLabelChromeBounds` unifies hover, edit, and select-tool rings. |
| 2026-06-21 | 4 | `textLabelPlaceholderColor()` — neutral slate ghost; not ink @ 45%. |
| 2026-06-21 | 5 | `caretColorForInk()` — dark caret for white/yellow/light inks. |
| 2026-06-21 | 6 | Faint filled-label tray at 38% fill alpha while empty + editing. |
| 2026-06-21 | 7 | Ghost-only placeholders; sticky body parity; layout helper tests. |
