# Fill tool (paint bucket) — product & implementation plan

Last updated: 2026-06-10

**Status:** Parked — build when coloring hand-drawn shapes becomes a daily pain during lessons.

**User problem:** Students draw closed outlines with the pen, then spend a long time coloring inside with a thin brush. They want a **one-tap fill** inside closed shapes — like a paint bucket in MS Paint or OneNote.

**Milestone tie-in:** Lesson-board / reader annotation polish. Not required for Phase 1 “open book and teach,” but high value for diagram and coloring activities on the **lesson board** and **book spread ink**.

---

## What we want (v1)

| Must have | Nice later |
|-----------|------------|
| New **Fill** tool in the annotation toolbar | Fill the PDF page background (not ink) |
| Pick a color (reuse pen/shape color strip) | Gradient or pattern fill |
| Tap inside a **closed pen outline** → instant solid or semi-transparent fill | Smart upgrade to vector shape when outline is a clean rect/ellipse |
| Fill sits **under** the outline; outline stays visible | Gap-tolerance slider in settings |
| Undo / redo one fill per tap | Refill / replace color on same region |
| Works on **lesson board pages** and **book spread ink** | Student devices |

---

## What already exists (reuse, don’t rebuild)

### Shape tools with fill

Rectangle, ellipse, and triangle already support fill while drawing:

- Types: `ShapeFillMode` (`none` | `transparent` | `solid`) in `lib/books/annotation-command-types.ts`
- UI: fill chips in `components/students/annotation-top-options-bar.tsx` when mode is `rect` / `ellipse` / `triangle`
- Render: `lib/books/annotation-draw.ts` (`case 'rect'`, `'ellipse'`, `'triangle'`)

**Limitation:** Only helps when the teacher/student uses the **shape tool**, not freehand pen loops.

### Hold-to-shape (pen pause → clean shape)

When drawing with the pen, a **pause** can snap a stroke into line / rect / ellipse / triangle:

- Recognition: `lib/books/stroke-shape-recognition.ts` (`recognizeHoldShapeFromStroke`, `isClosedLoop`)
- Commit: `lib/books/hold-shape-commit.ts` → `buildHoldShapeCommand`
- Overlay: `components/students/book-spread-stroke-overlay.tsx`

**Limitation:** Only simple geometry; arbitrary doodles (house, star, blob) are not covered.

### Connected stroke grouping

Pen/marker strokes that touch are grouped for selection:

- `lib/books/annotation-connected-strokes.ts` (`connectedPenMarkerStrokeIds`, `strokesAreConnected`)

**Use for fill v1.5:** treat a connected component as one boundary when tracing a closed loop.

### Ink architecture (constraints for fill)

- Commands are **vector** (`AnnotationCommand` union in `annotation-command-types.ts`) — no raster ink today.
- Book spread: one command list per spread (`docs/SPREAD_INK_PHASED_PLAN.md`); pen/marker on `BookSpreadSessionLayer`.
- Marker ink uses a **separate canvas** with `mix-blend-mode: multiply` — fill must not break marker layering.
- Coordinates are **normalized 0–1** per page or spread width/height.

---

## Why a classic paint bucket is not “one afternoon”

1. **Storage model** — Flood fill produces pixels; we store paths. Need a new command kind or a traced polygon.
2. **Imperfect closures** — Pen loops rarely meet exactly; gaps cause fill to leak or fail.
3. **Z-order** — Fill under outline, above board/PDF; eraser must remove fill and respect marker layer.
4. **Spread seam** — Ink can cross the two-page boundary; fill bounds must use spread-normalized space when spread session is on.
5. **Performance** — Rasterizing a large region for flood fill must be bounded (local bbox around tap, not full page every time).

**Rough effort:** **1–3 focused days** for a shippable v1 on book + lesson board; more if every messy kid doodle must work perfectly.

---

## Recommended approach (phased)

Ship in three layers. Stop after any phase if it solves enough classroom pain.

### Phase 0 — Quick win (optional, ~2–4 hours)

**Goal:** Reduce brush-coloring without new tool.

- Default **shape fill** to `transparent` or `solid` for rect/ellipse/triangle (teacher pref in `student-annotation-tool-prefs.ts`).
- Short tooltip: “Draw a box or circle with fill on instead of coloring by hand.”
- Optional: when hold-to-shape recognizes a **closed** loop, commit with `shapeFillMode !== 'none'` from current pen color.

**Test:** Draw rough circle with pen → pause → filled ellipse appears.

### Phase 1 — Fill tool v1 (paint bucket)

**Goal:** Toolbar **Fill** mode; tap inside closed pen outline → new filled region command.

#### 1a — Data model

Add to `lib/books/annotation-command-types.ts`:

```ts
export interface RegionFillAnnotationCommand {
  kind: 'region-fill'
  id: string
  /** Simplified boundary polygon in normalized coords (spread or page space). */
  points: [number, number][]
  fillColor: string
  fillAlpha: number // reuse SHAPE_FILL_ALPHA_* or same 0.42 / 1 as shapes
  /** Optional: ids of pen/marker strokes that formed the boundary (for v1.5 smart replace). */
  boundaryStrokeIds?: string[]
}
```

Extend `AnnotationCommand` union, `annotation-storage.ts` parse/sanitize, `annotation-draw.ts` render (filled path with `evenodd` or `nonzero`), `annotation-select.ts` hit-test (point-in-polygon), scale/rotate helpers if selection should support fill objects.

Persist in lesson board page `commands[]` and spread session store like any other command.

#### 1b — Flood fill pipeline

New module e.g. `lib/books/region-fill.ts`:

1. **Input:** tap `[x, y]` norm, command list, `widthPx`, `heightPx`, spread vs page scope.
2. **Local raster:**
   - Compute bbox: expand from tap until hit ink or max radius (e.g. 40% of short side).
   - Offscreen canvas at modest resolution (e.g. 512px on long edge).
   - White background; draw **pen strokes only** as black boundaries (ignore marker multiply for boundary detection, or draw pen + shape outlines).
3. **Flood fill** at tap pixel with tolerance (e.g. RGB distance ≤ 32) — standard stack/queue BFS on `ImageData`.
4. **Trace boundary:** walk fill mask edge → simplify (RDP) → normalize back to 0–1 polygon.
5. **Validate:** min area, max point count; if leak (touches raster edge), abort with subtle toast “Close the shape first.”
6. **Output:** `RegionFillAnnotationCommand`.

Unit tests: square loop, circle loop, open line (should fail), small gap (tolerance on/off).

#### 1c — UI & interaction

- Add `'fill'` to `BookAnnotationInteractionMode` in `annotation-storage.ts`.
- Toolbar button in `components/students/book-annotation-toolbar.tsx` (paint-bucket icon).
- Color from active fill color (reuse shape fill color state in `useAnnotationController.ts`).
- Pointer down in fill mode → run pipeline → `appendCommand` (spread session or page layer).
- Cursor: `lib/books/annotation-tool-cursor.ts`.
- Keyboard shortcut: e.g. `F` (check conflicts in `useBookOverlayKeyboardShortcuts.ts`).
- Top options bar: fill opacity chip (none / transparent / solid), same as shapes.

Wire through:

- `book-spread-stroke-overlay.tsx` (spread tap)
- `book-page-annotation-layer` / lesson board ink layer (page tap)
- `useAnnotationController.ts` mode + prefs patch in `student-annotation-tool-prefs.ts`

#### 1d — Layer order & eraser

- **Paint order:** region fills **before** pen/marker strokes in `annotation-draw.ts` replay order (or dedicated fill slice under ink).
- **Eraser:** rubber eraser removes fill if hit (point-in-polygon or bbox pad); eraser-line can clip/delete fill commands like shapes.
- **Undo:** one append per tap (already matches spread session undo).

### Phase 2 — Smarter boundaries (v1.5)

**Goal:** Better results on common classroom shapes without full bitmap every time.

1. On tap, first try **vector path:**
   - Find pen/marker stroke under tap; expand via `connectedPenMarkerStrokeIds`.
   - If single closed polyline (`isClosedLoop` from `stroke-shape-recognition.ts`), fill with `ctx.fill(path)` directly → store polygon from simplified points.
2. If that fails, fall back to Phase 1 raster flood fill.
3. If closed loop **and** high shape score (rect/ellipse/triangle), optionally replace with proper `RectAnnotationCommand` / etc. with fill (cleaner for resize later).

### Phase 3 — Polish (park unless needed)

- Gap closing morphological dilate on boundary mask before fill.
- “Fill again” replaces last fill in same connected region.
- Thumbnail preview includes fills (`lesson-board-page-thumbnail.ts`).
- Select + move fill with selection chrome.

---

## Test script (run after Phase 1)

1. **Simple box** — Pen draws closed rectangle → Fill tap inside → solid color, outline visible.
2. **Circle** — Rough closed circle → fill works.
3. **Open line** — Fill tap → no fill; gentle message.
4. **Small gap** — Outline with 2–3px gap → document whether tolerance fixes or fails (expected v1 limitation).
5. **Undo** — One undo removes fill; outline remains.
6. **Eraser** — Rub over fill removes it.
7. **Marker on top** — Highlight over filled shape still multiplies correctly.
8. **Spread seam** — Closed shape crossing page gutter fills correctly in spread session mode.
9. **Lesson board** — Same tests on a board page (standard + wide orientation).
10. **Reload** — Fill persists after close/reopen session.

---

## Edge cases & explicit non-goals (v1)

| Case | v1 behavior |
|------|-------------|
| Outline not closed | Fail with hint to close the shape |
| Nested shapes (donut) | Fill inner region only (even-odd); outer ring optional Phase 3 |
| Fill over PDF text | Allowed on board; on book, fill is ink layer only (does not recolor PDF) |
| Rainbow / effect pen outline | Boundary uses rendered stroke width; fill color is solid from picker |
| Multiple disconnected strokes as one “shape” | v1: may need strokes to connect; Phase 2 uses connected component |
| Very large fill area | Cap polygon points / simplify aggressively |

**Non-goals for v1:** filling arbitrary scanned worksheet pixels, AI shape detection, animation.

---

## Files to touch (checklist)

| Area | Files |
|------|--------|
| Types & storage | `annotation-command-types.ts`, `annotation-storage.ts` |
| Fill algorithm | `lib/books/region-fill.ts` (+ `.test.ts`) |
| Draw / hit-test | `annotation-draw.ts`, `annotation-select.ts`, `annotation-scale.ts` |
| Mode & prefs | `annotation-storage.ts`, `useAnnotationController.ts`, `student-annotation-tool-prefs.ts` |
| Toolbar / shortcuts | `book-annotation-toolbar.tsx`, `annotation-top-options-bar.tsx`, `useBookOverlayKeyboardShortcuts.ts`, `book-overlay-keyboard-shortcuts.ts` |
| Pointer targets | `book-spread-stroke-overlay.tsx`, page/board annotation layers |
| Session append | spread session store, lesson board page store |
| Thumbnails | `lesson-board-page-thumbnail.ts` (Phase 3) |

---

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Only promote shape tool + fill | Too weak for freehand-first students |
| Huge marker swipe “fill” | Still manual; messy |
| Store raw flood-fill bitmap | Bad for undo, scale, and storage size |
| Full vector-only (no raster) | Too fragile on gaps; hybrid in Phase 1→2 is better |

---

## Relation to other docs

| Doc | Relationship |
|-----|----------------|
| `LESSON_BOARD_PRODUCT.md` | Fill is a board + reader tool; same `commands[]` per page |
| `SPREAD_INK_PHASED_PLAN.md` | Spread session append + layer order must match |
| `WHITEBOARD_INK_UNIFIED_PLAN.md` | One ink engine; fill is another command kind |
| `BRUSH_PATTERNS_PHASES.md` | Effect pens stay outline-only; fill uses solid picked color |

---

## When to start

**Start Phase 1 when:**

- You are actively doing “color the shape” activities and the brush workaround costs real lesson time, **or**
- Lesson board phases that touch ink are stable and you have a half-day to test.

**Skip or stay at Phase 0 when:**

- Shape tool + fill covers most of your lessons, or
- Higher-priority milestone work (vocab v0, reading checks) is not yet shippable.

---

## Changelog

| Date | Note |
|------|------|
| 2026-06-10 | Plan created from product discussion; parked for later implementation. |
