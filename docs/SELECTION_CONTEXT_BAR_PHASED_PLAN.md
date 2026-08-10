# Selection context bar — phased implementation plan

Last updated: 2026-06-09

**How to use:** Implement **one phase at a time**. After each phase, test in the app, fix issues, then continue.

**What we're building:** A small **floating bar** beside selected content to edit **objects already on the board** (not defaults for the next stroke).

**What stays:**
- **Left rail** — pick tools
- **Top bar** — settings for the **next** pen stroke / label / shape

**New piece:** Selection bar — appears only when something is selected; edits **that** object.

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| Text bar when | **Select mode** with text selected (text-tool-on-label in Phase 3) |
| While typing | **Hide** the bar |
| Top bar when text selected | **Hide text options** (Phase 3) |
| Multi text-only select | Allowed; controls show **mixed** when values disagree |
| Surfaces | Book spread + lesson board via `BookSpreadSessionLayer` |

---

## Phase 0 — Scope ✅

- [x] Phased plan documented
- [x] Text-first order: text → sticky → shapes → pen/marker → mixed

---

## Phase 1 — Shared foundation

**Goal:** Reusable resolve/anchor/patch helpers + bar shell (no live UI required).

### Tasks

- [x] `resolveSelectionContext` — kind, commands, anchor, visibility
- [x] `resolveSelectionBarPlacement` — above/below anchor
- [x] `patchSelectedTextCommands` — batch patch with undo via store `patchCommands`
- [x] `SelectionContextBar` shell component
- [x] Unit tests

### Acceptance

- [x] Tests: single text → `kind: 'text'`
- [x] Tests: text + shape → `kind: 'mixed'`
- [x] Tests: `editingId` set → not visible
- [x] Tests: batch patch two text ids

---

## Phase 2 — Text v1 on spread + board

**Goal:** Select one text label → floating bar with **color + delete**.

### Tasks

- [x] `TextSelectionContextBar` — color swatches + delete
- [x] `SelectionContextBarLayer` — resolve + mount
- [x] Wire in `BookSpreadSessionLayer`
- [x] Wire `onPatchSelectedText` / `onDeleteSelected` on spread + whiteboard dom configs

### Acceptance (you test)

- [ ] Select tool → one text label → bar above it
- [ ] Change color → label updates; undo works
- [ ] Delete → label gone
- [ ] Double-click to type → bar hidden
- [ ] Lesson board: same behavior

### Non-goals

- Font, plain/filled, size, duplicate
- Top bar handoff

---

## Phase 3 — Text complete + top bar handoff ✅

- Full text controls on floater; multi-text mixed state; hide top text options when text selected; text tool + existing label.

### Tasks

- [x] Font, plain/filled, fill swatches, size, duplicate on floater
- [x] Multi-text mixed values on controls
- [x] Top bar hides text creation options when text-only selection is active
- [x] Text tool: single click selects + context bar; double-click edits

### Acceptance (you test)

- [ ] Select text → full floater; top bar text options hidden in text mode
- [ ] Text tool click label → selects + floater (no immediate typing)
- [ ] Text tool double-click → edit
- [ ] Duplicate / font / style / size work with undo

## Phase 4 — Sticky / writable stickers ✅

### Tasks

- [x] `StickySelectionContextBar` — fill color, font, size, duplicate, delete
- [x] Sticky tool: single click selects + context bar; double-click edits
- [x] Top bar hides sticky creation options when sticky-only selection is active
- [x] Book spread + lesson board wiring

### Acceptance (you test)

- [ ] Select tool → one sticky → bar above it with color/font/size
- [ ] Sticky tool click existing note → selects + floater
- [ ] Sticky tool double-click → edit
- [ ] Top bar sticky options hidden while note selected in sticky mode

## Phase 5 — Shapes ✅

### Tasks

- [x] Shape selection helpers (`shape-selection.ts`, common values in `selection-context.ts`)
- [x] `patchSelectedShapeCommands` — stroke, dash, thickness, fill mode/color, stroke on/off
- [x] `ShapeSelectionContextBar` — stroke swatches, fill swatches (filled shapes), line/fill chips, thickness, duplicate, delete
- [x] `SelectionContextBarLayer` + spread / whiteboard wiring
- [x] Top bar hides shape creation options when shape-only selection is active
- [x] Unit tests

### Acceptance (you test)

- [ ] Select tool → one shape → bar above it with stroke color, dash, thickness
- [ ] Rectangle / ellipse / triangle → fill color + fill mode controls
- [ ] Line / arrow → stroke controls only (no fill)
- [ ] Multi-shape same kind → mixed when values disagree
- [ ] Top bar shape options hidden while shapes selected in shape mode
- [ ] Duplicate / delete work with undo

## Phase 6 — Pen & marker strokes ✅

### Tasks

- [x] Ink stroke helpers (`stroke-selection.ts`, common values in `selection-context.ts`)
- [x] `patchSelectedInkStrokeCommands` — color (clears effect ink), width, dash, marker decorated edge
- [x] `StrokeSelectionContextBar` — pen/marker color swatches, dash/decorated edge, thickness, group/ungroup, duplicate, delete
- [x] Spread + whiteboard wiring; top bar handoff for pen and marker modes
- [x] Unit tests

### Acceptance (you test)

- [ ] Select tool → one pen stroke → bar with color, dash, thickness
- [ ] Select tool → one highlighter stroke → bar with color, thickness, decorated edge
- [ ] Multi-stroke selection → group / ungroup button (2+ strokes)
- [ ] Picking a solid pen color on a rainbow/effect stroke converts it to solid
- [ ] Top bar pen/marker options hidden while matching strokes selected in that tool mode
- [ ] Duplicate / delete work with undo

## Phase 7 — Mixed selection & polish ✅

### Tasks

- [x] `MixedSelectionContextBar` — duplicate + delete when selection mixes kinds (e.g. text + shape)
- [x] Horizontal edge clamp so the bar stays on-screen at spread edges
- [x] Bottom-edge placement guard (bar stays above selection near page foot)
- [x] Unit tests

### Acceptance (you test)

- [ ] Marquee-select a label and a shape → small bar with duplicate + delete only
- [ ] Selection hugging left/right edge → bar not clipped off-screen
- [ ] Duplicate / delete work with undo on mixed selection

---

## Phase 8 — UI polish (Figma-style light pill) ✅

### Tasks

- [x] Light elevated pill shell (distinct from dark creation top bar)
- [x] Single-row layout with grouped segments (color / style / size / actions)
- [x] Color clusters (active + recents + palette) instead of full inline swatch walls
- [x] Light-tone chips and thickness slider on shared controls
- [x] Shared primitives: Group, Divider, ActionButtons, ColorSection
- [x] Shape stroke hex ↔ swatch id helper + unit tests

### Acceptance (you test)

- [ ] Select a text label → one compact **light** bar, not a multi-row swatch grid
- [ ] Color change still works; palette opens from active swatch
- [ ] Font / style / size / duplicate / delete unchanged in behavior
- [ ] Same checks for sticky, shape, pen line, marker highlight, mixed selection
- [ ] Bar near page edges stays visible and reads clearly on book photos
- [ ] Top creation bar still dark when drawing; no clash when context bar shows while editing selection

---

*Selection context bar phases 1–8 complete.*
