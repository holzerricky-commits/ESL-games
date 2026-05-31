# Infinite Whiteboard V1 — Implementation Plan

Last updated: 2026-05-28

## Product summary (locked for V1)

**One session board per live class** — ink does not change when the book page turns.

**Spread-first layout** — the board occupies **one spread slot** (left or right page width), not a third column beside the spread.

**Placement**

- Default: board on the **non-active** side (opposite `annotationTargetPage` / reader focus).
- **Drag** board between left and right slots (snap at gutter; no free-floating over the book).
- **Fullscreen** board covers the entire spread area; book dimmed or hidden until exit.

**Infinite vertical scroll** inside the board viewport — no wipe-to-continue; hidden native scrollbar; hand tool / wheel to pan vertically.

**Out of scope for V1**

- Single-page + fixed right rail (V2).
- OneNote-style stacked book + margin scroll (V3 / future lesson scroll).
- Notebook reshape (keep “Save to notebook” working; no new notebook UX).

---

## Current architecture (baseline)

| Piece | Location | Behavior today |
|-------|----------|----------------|
| Whiteboard toggle | `TopOverlayControls.tsx` | `W` shortcut, `isWhiteboardOpen` |
| Board UI | `BookCanvasStage.tsx` ~985–1037 | Centered overlay, fixed `spreadPageWidth × pageCanvasHeightPx`, `overflow-hidden` |
| Ink | `BookPageAnnotationLayer` | `storageChannel="whiteboard"`, key `wb:{pageNumber}` via `annotationStoragePageKey()` |
| Page tabs | `WhiteboardHeader.tsx` | Switch `whiteboardPage` between left/right PDF pages |
| Sync on unit change | `useWhiteboardOnBookUnitChange.ts` | Resets `whiteboardPage` to `pageNumber` |
| Capture | `useWhiteboardNotebookCapture.ts` | html-to-image of `wbCaptureRootRef` |
| Spread layout | `SpreadPageCluster` | `leftPage` + `rightPage` with gutter pull |
| Coordinates | `AnnotationCommand` | Normalized **0–1** relative to layer `widthPx` / `heightPx` |

---

## Target architecture

```text
SpreadPageCluster
├── leftSlot:  ReaderPageSlot (PDF)  OR  InfiniteWhiteboardPanel
├── rightSlot: ReaderPageSlot (PDF)  OR  InfiniteWhiteboardPanel
└── (fullscreen mode: single InfiniteWhiteboardPanel over entire cluster)

InfiniteWhiteboardPanel
├── header: drag handle, Left | Right | Full, Close, Save to notebook (optional)
├── viewport: fixed height = pageCanvasHeightPx, overflow-y auto (scrollbar hidden)
└── content: dot-paper runway + BookPageAnnotationLayer (tall canvas)

Storage key: wb:session:{classSessionId}
  (fallback when no live class: wb:session:orphan:{bookId}:{unitId} — see Phase 1)
```

### Placement state

```ts
type WhiteboardLayoutMode = 'slot' | 'fullscreen'
type WhiteboardSlotSide = 'left' | 'right'

// Persist in sessionStorage per student+book+unit (survives refresh within lesson)
interface WhiteboardPlacementPrefs {
  layoutMode: WhiteboardLayoutMode
  slotSide: WhiteboardSlotSide
}
```

### Session vs book page

| Field | Purpose |
|-------|---------|
| `activeClassSessionId` | Storage partition for ink |
| `pageNumber` / `annotationTargetPage` | Which PDF slot stays visible when board is open |
| `bookPageAtCapture` | Metadata on notebook save / future lesson summary (current `whiteboardPage`) |

**Remove** `whiteboardPage` as storage identity. **Keep** `bookPageAtCapture` (or rename) only for capture metadata and coach context.

---

## Implementation phases

### Phase 1 — Session storage key

**Goal:** One ink document per class session; no `wb:12` / `wb:13` split.

#### Tasks

- [x] Add `annotationStorageSessionKey(sessionId: string): string` → `wb:session:{sessionId}` in `lib/books/whiteboard-storage.ts`.
- [x] Add `resolveWhiteboardStorageKey({ classSessionId, bookId, unitId })`.
- [x] Update `BookPageAnnotationLayer` with `storagePageKey` override for load/save.
- [ ] **Migration (read path):** On first load of `wb:session:{id}`, if empty, optionally merge commands from `wb:{pageNumber}` for pages visited this session (V1 can skip merge — document as known limitation).
- [ ] **Fallback** when `activeClassSessionId` is null: use `wb:session:local:{bookId}:{unitId}` so practice mode still works; show subtle hint “Start a live class to sync board.”

#### Files

- `lib/books/annotation-storage.ts`
- `components/students/book-page-annotation-layer.tsx` (storage key resolution only)
- `components/students/fullscreen-book-overlay/hooks/useFullscreenBookOverlayController.ts`

#### Acceptance

- [ ] Draw on board, turn book pages → same ink visible.
- [ ] Change unit → new storage key (empty board), old unit ink unchanged when returning.
- [ ] Two class sessions → separate boards.

#### Tests

- [ ] Unit test: `annotationStorageSessionKey` / resolver.
- [ ] Unit test: load/save round-trip on session key.

---

### Phase 2 — Spread slot layout (fixed height)

**Goal:** Board lives in a spread slot; draggable L/R; fullscreen toggle.

#### Tasks

- [x] Add `useWhiteboardPlacement.ts` — state + `sessionStorage` persistence + `setSlotSide`, `toggleFullscreen`.
- [x] Create `InfiniteWhiteboardPanel.tsx`:
  - Props: `widthPx`, `viewportHeightPx`, `contentHeightPx` (= viewport for this phase), `placement`, `onPlacementChange`, chrome props.
  - Renders dot paper + `BookPageAnnotationLayer` + `wbCaptureRootRef`.
- [ ] Refactor `BookCanvasStage.tsx`:
  - Remove centered absolute overlay block (~985–1037).
  - When `isWhiteboardOpen && layoutMode === 'slot'`:
    - Render board in **left** or **right** `SpreadPageCluster` slot.
    - Other slot: single `ReaderPageSlot` for active book page (hide opposite PDF page).
  - When `layoutMode === 'fullscreen'`:
    - Board absolutely covers cluster (`spreadOverlayWidthPx × pageCanvasHeightPx`).
    - Optional dim layer under board (`bg-black/20`).
  - When board closed: existing two-page spread unchanged.
- [ ] Replace `WhiteboardHeader.tsx`:
  - Remove left/right **page** tabs.
  - Add: **← Left slot | Right slot →**, **Fullscreen**, **Close**, **Save to notebook** (unchanged behavior).
  - Drag handle on header (pointer down → track X → snap to nearest slot on release).
- [ ] Update `useWhiteboardOnBookUnitChange.ts` — stop setting `whiteboardPage`; reset placement prefs optional (default slot = opposite active page).
- [ ] `useEyedropperPick.ts` — target whiteboard layer ref, not `whiteboardPage`.
- [ ] Spread stroke capture / PDF annotations: ensure `isWhiteboardOpen` still disables conflicting pointer routes (`BookCanvasStage` already gates some paths).

#### Slot / book pairing rules

| `slotSide` | Left cluster child | Right cluster child |
|------------|-------------------|---------------------|
| `right` (board on right) | Active book page (usually `pageNumber`) | Board |
| `left` (board on left) | Board | Active book page (usually `spreadRightPage` or `pageNumber`) |

When only one PDF page exists in spread (`spreadRightPage == null`), board takes the only slot pattern that fits (single-page cluster branch).

#### Files

- `components/students/fullscreen-book-overlay/sections/InfiniteWhiteboardPanel.tsx` (new)
- `components/students/fullscreen-book-overlay/hooks/useWhiteboardPlacement.ts` (new)
- `components/students/fullscreen-book-overlay/sections/BookCanvasStage.tsx`
- `components/students/fullscreen-book-overlay/sections/WhiteboardHeader.tsx`
- `components/students/fullscreen-book-overlay/hooks/useWhiteboardOnBookUnitChange.ts`
- `components/students/fullscreen-book-overlay/hooks/useEyedropperPick.ts`

#### Acceptance

- [ ] Open board → one book page + one board page width; spread total width unchanged.
- [ ] Drag header → board snaps to other side; book page stays readable on the other slot.
- [ ] Fullscreen → board covers spread; exit restores slot layout.
- [ ] Page turn → book slot updates; board slot and ink unchanged.
- [ ] Close board → two-page spread restored.

---

### Phase 3 — Infinite vertical scroll

**Goal:** Scrollable runway inside board viewport; coordinates correct; no visible scrollbar.

#### Tasks

- [x] Add `useInfiniteWhiteboardRunway.ts`:
  - `viewportHeightPx` from `pageCanvasHeightPx`.
  - Initial `contentHeightPx = max(viewport * 2.5, 2400)`.
  - Grow runway when ink/strokes approach bottom band (e.g. lowest command y > 0.85 → extend by one viewport).
- [ ] `InfiniteWhiteboardPanel` structure:

```text
div.viewport [h=pageCanvasHeightPx, overflow-y:auto, scrollbar-hidden]
  div.runway [h=contentHeightPx]
    BookPageAnnotationLayer [widthPx, heightPx=contentHeightPx]
```

- [ ] **Pointer / coordinate fix** in `BookPageAnnotationLayer` (or panel wrapper):
  - New optional `contentOffsetYPx` / read scroll parent `scrollTop` on pointer events.
  - Map client Y → norm Y: `(localY + scrollTop) / contentHeightPx`.
  - Hit-testing, eraser, select, shapes: same adjustment.
- [ ] Scroll affordances (lightweight):
  - CSS: `scrollbar-width: none`, `::-webkit-scrollbar { display: none }`.
  - Optional edge fade pseudo-elements at top/bottom when `scrollTop > 0` / not at end.
  - Optional “↓ More board” chip when not at bottom (Phase 3b polish).
- [ ] **Hand tool / scroll mode:** When `annotationMode` is not drawing (or dedicated `hand` mode): wheel and drag on viewport scroll; pen modes prevent scroll-default on draw surface.
- [ ] Auto-grow: after stroke commit, scan max Y of commands; extend runway if needed.

#### Performance (V1 acceptable)

- Single tall canvas for `contentHeightPx` up to ~3–4 viewports (≈10k–15k px) — OK for MVP.
- **Phase 3b (if slow):** Virtualize — render only commands intersecting `[scrollTop, scrollTop + viewport]`; optional chunk keys `wb:session:{id}:band:{n}`.

#### Files

- `components/students/fullscreen-book-overlay/hooks/useInfiniteWhiteboardRunway.ts` (new)
- `components/students/fullscreen-book-overlay/sections/InfiniteWhiteboardPanel.tsx`
- `components/students/book-page-annotation-layer.tsx` (scroll-aware coords)
- `components/students/fullscreen-book-overlay/constants.ts` (shared scrollbar-hidden class)

#### Acceptance

- [ ] Draw at bottom of viewport → scroll or extend → continue drawing without wipe.
- [ ] Scroll up → earlier ink visible and editable.
- [ ] No native scrollbar visible; wheel/trackpad scroll works.
- [ ] Fullscreen + slot modes both scroll correctly.

#### Tests

- [ ] Unit test: norm Y mapping with `scrollTop` offset.
- [ ] Unit test: runway growth threshold.

---

### Phase 4 — Capture, coach, cleanup

#### Tasks

- [ ] `useWhiteboardNotebookCapture.ts`:
  - Capture **visible viewport** by default (crop scroll container).
  - Optional later: “Capture all” (tall export).
  - Metadata: `bookPageAtCapture` = current `pageNumber` / span key (not storage page).
- [ ] Lesson coach: `storageChannel === 'whiteboard'` field — confirm session board sync path (`lesson-coach-cockpit.tsx`).
- [ ] Remove dead state: `whiteboardPage` / `setWhiteboardPage` from controller (or alias to `bookPageAtCapture` only).
- [ ] `TopOverlayControls` open whiteboard: set default slot to opposite `annotationTargetPage`.
- [ ] Keyboard: `W` toggle; consider `F` for fullscreen while board open (optional).
- [ ] Update `docs/NOTEBOOK_REBUILD_PHASES.md` cross-link — whiteboard capture still valid.

#### Acceptance

- [ ] Save to notebook produces image of what teacher sees in board viewport.
- [ ] Coach mirror shows whiteboard strokes (if coach session active).

---

### Phase 5 — Polish & QA

- [ ] Persist placement in `sessionStorage` (already Phase 2).
- [ ] Thin position rail (4px) on board edge — optional.
- [ ] `prefers-reduced-motion`: instant snap, no drag animation.
- [ ] Tablet: drag handle min 44px touch target.
- [ ] Manual QA matrix (below).

---

## Manual QA matrix

| Scenario | Expected |
|----------|----------|
| Open board on spread | Book one side, board other; no horizontal squeeze |
| Drag board L ↔ R | Snaps; ink moves with panel |
| Fullscreen ↔ slot | Layout restores; ink preserved |
| Turn page while board open | PDF updates; board ink unchanged |
| Scroll board, draw, scroll back | Ink aligned, no drift |
| Switch unit | New empty session key (or orphan key) |
| End class / no session | Orphan key + hint |
| Save to notebook | Image + page metadata |
| Close board | Two-page spread returns |
| Pen vs hand | Pen draws; hand/wheel scrolls |

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Pointer Y wrong after scroll | Phase 3 dedicated coord mapping + tests |
| Tall canvas GPU/memory | Cap runway; virtualize in 3b |
| Old `wb:{n}` ink orphaned | Optional one-time merge; or leave for archive |
| Spread stroke capture fights board | Keep `isWhiteboardOpen` gating; board slot not in spread overlay |
| Drag vs draw gesture conflict | Drag only from header handle |
| No live class | `wb:session:local:…` fallback |

---

## Suggested PR order

1. **PR1 — Phase 1** storage key only (behind flag optional); still old UI.
2. **PR2 — Phase 2** slot layout + placement (fixed height).
3. **PR3 — Phase 3** infinite scroll + coord fix.
4. **PR4 — Phase 4–5** capture metadata, cleanup, QA fixes.

Each PR should be shippable without breaking book annotations.

---

## File checklist (new / major touch)

| File | Action |
|------|--------|
| `docs/INFINITE_WHITEBOARD_V1.md` | This plan |
| `lib/books/annotation-storage.ts` | Session key API |
| `lib/books/annotation-storage.test.ts` | Tests |
| `lib/books/infinite-whiteboard-coords.ts` | Optional pure helpers for Y mapping |
| `components/.../InfiniteWhiteboardPanel.tsx` | New UI shell |
| `components/.../useWhiteboardPlacement.ts` | Placement state |
| `components/.../useInfiniteWhiteboardRunway.ts` | Runway height |
| `components/.../BookCanvasStage.tsx` | Slot integration |
| `components/.../WhiteboardChrome.tsx` | Persistent header bar (`WhiteboardHeader`) |
| `components/students/book-page-annotation-layer.tsx` | Scroll offset support |
| `components/.../useFullscreenBookOverlayController.ts` | Wire state |
| `components/.../useWhiteboardNotebookCapture.ts` | Viewport capture |

---

## Deferred (explicitly not V1)

- Merge legacy `wb:{page}` → session board.
- Single-page reader + permanent right rail.
- OneNote stacked lesson scroll view.
- Auto-save board strips to lesson summary.
- Board segment markers (“Part 2”) in header.
- Chunked storage / multi-band virtualization (unless perf requires in 3b).

---

## Definition of done (V1)

- [ ] Session-scoped whiteboard ink survives page turns within a class.
- [ ] Board uses one spread slot, draggable L/R, with fullscreen mode.
- [ ] Vertical infinite scroll inside board; no wipe required to continue teaching.
- [ ] No ugly scrollbar; scroll via wheel/hand.
- [ ] Save to notebook captures viewport with book page metadata.
- [ ] No regression to PDF annotations or spread page turning.

---

## Chrome v2 — Persistent header bar

**Goal:** Card-style board with a clear top header and subtle border; controls always visible in the header (not hover-only).

### UI

| Control | Placement | Behavior |
|---------|-----------|----------|
| Board icon | Header left | Decorative; matches annotation-rail board button |
| Drag grip | Header center (slot mode) | Drag toward gutter to snap to other slot |
| Move side | Header right (`ArrowLeftRight`, slot mode) | Snap board to other spread slot |
| Clear | Header right (`Trash2`) | Clears all board ink |
| Fullscreen | Header right (`Maximize2` / `Minimize2`) | Toggle fullscreen layout |
| Minimize | Header right (`Minus`) | Collapses to `WhiteboardCollapsedTab` on spread edge |

Panel shell: `rounded-xl`, light border (`#e5e2dc`), soft shadow; dot-grid canvas below header separator.

### Keyboard (board expanded only)

| Key | Action |
|-----|--------|
| `W` | Open / expand / close session (with launch animation) |
| `F` | Toggle fullscreen |
| `Alt+←` / `Alt+→` | Move board to left / right slot |

### Files

- `sections/WhiteboardChrome.tsx` — exports `WhiteboardHeader` (persistent header bar)
- `sections/WhiteboardCollapsedTab.tsx` — minimized edge tab
- `hooks/useWhiteboardSlotMotion.ts` — header grip drag + slot snap animation
- `hooks/useWhiteboardToolbarLaunch.ts` — FLIP enter/exit from annotation-rail button
- `hooks/useFullscreenBookOverlayController.ts` — `isWhiteboardMinimized`, launch helpers, keyboard `W`

### Persistence note

- Stroke ink auto-saves via `BookPageAnnotationLayer` + session storage key.
- Notebook “Save” removed from board UI.
- `TODO(post-class)` in `lib/books/whiteboard-storage.ts` for future student analytics export.
